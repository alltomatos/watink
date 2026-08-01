package plugins

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PluginManager struct {
	plugins map[string]sdk.WatinkPlugin
	core    *coreImpl
	mu      sync.RWMutex
}

type coreImpl struct {
	db     *gorm.DB
	router *gin.RouterGroup
	// publicRouter is the raw, unauthenticated group — RegisterPublicRoute
	// mounts here, never through the license-gating wrapper in RegisterRoute
	// (there is no tenant to check before the handler runs).
	publicRouter *gin.RouterGroup
	slug         string
	registry     *PluginRegistry
	broadcaster  domain.Broadcaster
	rabbit       domain.CommandPublisher
	// scheduler backs sdk.WatinkCoreScheduler (ADR 0027) — nil in constructors
	// that don't wire redis (e.g. tests via NewPluginManager), in which case
	// RegisterRoute/EmitSocketEvent/SendTicketMessage still work but
	// RegisterCron/Subscribe fail closed with a clear error.
	scheduler *cronScheduler
}

// RegisterCron implements sdk.WatinkCoreScheduler.
func (c *coreImpl) RegisterCron(name string, interval time.Duration, fn func(ctx context.Context) error) error {
	if c.scheduler == nil {
		return errors.New("scheduler not configured for this plugin manager")
	}
	return c.scheduler.register(name, interval, fn)
}

// Subscribe implements sdk.WatinkCoreScheduler.
func (c *coreImpl) Subscribe(eventType string, fn func(ctx context.Context, payload map[string]any)) error {
	return eventBus.subscribe(eventType, fn)
}

func (c *coreImpl) GetDB() *gorm.DB {
	return c.db
}

// GetStatus is the zero-arg, tenant-agnostic method required by the
// sdk.WatinkCore interface (plugins may call it directly, without a
// request context). It always reports Active. The REAL, tenant-aware
// enforcement — cross of license x allocation (ADR 0024) — happens in the
// RegisterRoute wrapper below via c.registry.GetStatus(tenantId, slug),
// never through this method.
func (c *coreImpl) GetStatus() sdk.PluginStatus {
	return sdk.StatusActive
}

func (c *coreImpl) RegisterRoute(method string, path string, handler gin.HandlerFunc) {
	c.router.Handle(method, path, func(ctx *gin.Context) {
		status := sdk.StatusActive
		if c.registry != nil {
			tenantID, err := auth.TenantUUIDFromContext(ctx)
			if err != nil {
				// Sem tenantId resolvido no contexto: fail-closed — nunca
				// liberar uma rota de plugin sem saber qual tenant a está
				// chamando (ADR 0024, alocação é sempre por tenant).
				status = sdk.StatusBlocked
			} else {
				status = c.registry.GetStatus(tenantID, c.slug)
			}
		}
		if status == sdk.StatusBlocked {
			ctx.JSON(http.StatusPaymentRequired, gin.H{"error": "Plugin Blocked - License required"})
			ctx.Abort()
			return
		}
		if status == sdk.StatusReadOnly && method != "GET" {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "Plugin in Read-Only mode - Action not allowed"})
			ctx.Abort()
			return
		}
		handler(ctx)
	})
}

// RegisterPublicRoute mounts an unauthenticated route on publicRouter — no
// license gating, no tenant resolved yet (see sdk.WatinkCore doc).
func (c *coreImpl) RegisterPublicRoute(method string, path string, handler gin.HandlerFunc) {
	c.publicRouter.Handle(method, path, handler)
}

// EmitSocketEvent delivers a real-time event via the injected Broadcaster
// (domain.Broadcaster — SSE/Redis fan-out). Nil-safe: a manager built without
// a broadcaster (tests, NewPluginManager) keeps this a no-op, matching the
// prior stub behavior.
func (c *coreImpl) EmitSocketEvent(room string, event string, payload interface{}) {
	if c.broadcaster == nil {
		return
	}
	c.broadcaster.EmitToRoom("/", room, event, payload)
}

// pluginWAMessageID and pluginContactJID mirror controllers.newWAMessageID /
// controllers.contactJID exactly (message_send.go) — duplicated here instead
// of imported because controllers already imports plugins (plugin_manager.go),
// so the reverse import would cycle.
func pluginWAMessageID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("3EB0%016X", time.Now().UnixNano())
	}
	return "3EB0" + strings.ToUpper(hex.EncodeToString(b))
}

func pluginContactJID(contact models.Contact) string {
	if contact.IsGroup {
		return contact.Number + "@g.us"
	}
	if contact.Lid != nil && *contact.Lid != "" {
		return *contact.Lid
	}
	return contact.Number
}

// SendTicketMessage implements sdk.WatinkCore — see its doc comment. Mirrors
// the outbound pipeline of controllers.MessageController.SendMessage (text-only,
// no media) so plugin-originated messages behave identically to agent-sent ones.
func (c *coreImpl) SendTicketMessage(tenantID uuid.UUID, ticketID int, body string) error {
	if c.rabbit == nil {
		return errors.New("command publisher not configured")
	}

	var ticket models.Ticket
	if err := c.db.Preload("Contact").Where(`id = ? AND "tenantId" = ?`, ticketID, tenantID).First(&ticket).Error; err != nil {
		return err
	}
	if ticket.Contact.ID == 0 {
		return errors.New("contact not found for ticket")
	}

	messageID := pluginWAMessageID()
	to := pluginContactJID(ticket.Contact)
	command := map[string]interface{}{
		"type": "message.send.text",
		"payload": map[string]interface{}{
			"sessionId": ticket.WhatsappID,
			"messageId": messageID,
			"to":        to,
			"ticketId":  ticketID,
			"body":      body,
		},
	}
	routingKey := fmt.Sprintf("wbot.%s.%d.%s", tenantID.String(), ticket.WhatsappID, "message.send.text")
	if err := c.rabbit.PublishCommand(routingKey, command); err != nil {
		return err
	}

	writeDB := c.db.Session(&gorm.Session{NewDB: true})
	now := time.Now()
	contactID := ticket.ContactID
	outgoing := models.Message{
		ID:        messageID,
		Body:      body,
		Ack:       0,
		TicketID:  ticketID,
		FromMe:    true,
		ContactID: &contactID,
		TenantID:  tenantID,
		Reactions: "[]",
		DataJson:  "{}",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := writeDB.Create(&outgoing).Error; err != nil {
		log.Printf("[SendTicketMessage] persist outgoing message failed (ticket %d): %v", ticketID, err)
	}
	writeDB.Model(&models.Ticket{}).
		Where(`id = ? AND "tenantId" = ?`, ticketID, tenantID).
		Updates(map[string]interface{}{"lastMessage": body, "updatedAt": now})

	if c.broadcaster != nil {
		ticketRoom := "chat:" + strconv.Itoa(ticketID)
		msgPayload := map[string]interface{}{"action": "create", "message": outgoing}
		c.broadcaster.EmitToRoom("/", ticketRoom, "appMessage", msgPayload)
		c.broadcaster.EmitToTenantRoom(tenantID.String(), "appMessage", msgPayload)
		c.broadcaster.EmitToTenantRoom(tenantID.String(), "ticket", map[string]interface{}{
			"action": "update",
			"ticket": map[string]interface{}{
				"id":          ticketID,
				"lastMessage": body,
				"updatedAt":   now,
			},
		})
	}

	return nil
}

// NewPluginManager builds the manager via constructor injection. registry
// may be nil (e.g. in tests using NewPluginManager(db, group) directly) —
// RegisterRoute then falls back to StatusActive, preserving prior
// zero-registry test behavior. router doubles as publicRouter here (no
// authenticated/public split needed for this simpler constructor).
func NewPluginManager(db *gorm.DB, router *gin.RouterGroup) *PluginManager {
	return &PluginManager{
		plugins: make(map[string]sdk.WatinkPlugin),
		core: &coreImpl{
			db:           db,
			router:       router,
			publicRouter: router,
		},
	}
}

// NewPluginManagerWithRegistry is the DI-pura constructor used by routes.go —
// it plugs the real PluginRegistry (license x allocation) into every
// plugin's coreImpl so RegisterRoute's gating is real, not hardcoded. router
// MUST be the authenticated group (IsAuth + TenantMiddleware already
// applied) — otherwise auth.TenantUUIDFromContext never resolves inside a
// plugin's handlers. publicRouter is the raw, unauthenticated group, for
// RegisterPublicRoute. broadcaster wires EmitSocketEvent to real delivery;
// nil keeps it a no-op. rabbit wires SendTicketMessage to the real engine
// dispatch; nil makes it fail-closed (returns an error, never silently drops).
// redis, when non-nil, backs sdk.WatinkCoreScheduler.RegisterCron's
// multi-node leader-lock (ADR 0027) — nil keeps RegisterCron/Subscribe
// fail-closed with an error rather than silently no-op.
func NewPluginManagerWithRegistry(db *gorm.DB, router *gin.RouterGroup, publicRouter *gin.RouterGroup, registry *PluginRegistry, broadcaster domain.Broadcaster, rabbit domain.CommandPublisher, redis domain.RedisService) *PluginManager {
	var scheduler *cronScheduler
	if redis != nil {
		scheduler = newCronScheduler(redis)
	}
	return &PluginManager{
		plugins: make(map[string]sdk.WatinkPlugin),
		core: &coreImpl{
			db:           db,
			router:       router,
			publicRouter: publicRouter,
			registry:     registry,
			broadcaster:  broadcaster,
			rabbit:       rabbit,
			scheduler:    scheduler,
		},
	}
}

func (pm *PluginManager) Register(p sdk.WatinkPlugin) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	manifest := p.GetManifest()
	if pm.plugins[manifest.Slug] != nil {
		log.Printf("Plugin already registered, skipping: %s", manifest.Slug)
		return
	}
	log.Printf("Registering plugin: %s (%s)", manifest.Name, manifest.Slug)
	pluginCore := &coreImpl{
		db:           pm.core.db,
		router:       pm.core.router,
		publicRouter: pm.core.publicRouter,
		slug:         manifest.Slug,
		registry:     pm.core.registry,
		broadcaster:  pm.core.broadcaster,
		rabbit:       pm.core.rabbit,
		scheduler:    pm.core.scheduler,
	}
	if err := p.OnActivate(pluginCore); err != nil {
		log.Printf("Error activating plugin %s: %v", manifest.Slug, err)
		return
	}
	pm.plugins[manifest.Slug] = p
}

func (pm *PluginManager) GetInstalled() []sdk.PluginManifest {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	manifests := []sdk.PluginManifest{}
	for _, p := range pm.plugins {
		manifests = append(manifests, p.GetManifest())
	}
	return manifests
}
