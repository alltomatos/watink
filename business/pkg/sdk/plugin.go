package sdk

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PluginStatus defines the current state of a plugin license
type PluginStatus string

const (
	StatusActive   PluginStatus = "active"
	StatusBlocked  PluginStatus = "blocked"
	StatusReadOnly PluginStatus = "readonly"
)

// PluginManifest defines the metadata and requirements of a plugin
type PluginManifest struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Type        string `json:"type"` // "free" | "premium"
}

// WatinkCore defines the interface for plugins to interact with the core system
type WatinkCore interface {
	GetDB() *gorm.DB
	// RegisterRoute mounts an authenticated, tenant-scoped, license-gated route
	// (ADR 0024) — the handler runs after IsAuth/TenantMiddleware, so
	// auth.TenantUUIDFromContext/auth.GetScoped work inside it.
	RegisterRoute(method string, path string, handler gin.HandlerFunc)
	// RegisterPublicRoute mounts a route with NO authentication and NO license
	// gating (the caller has no session — tenant, if any, is only known once
	// the handler resolves it from the request itself, e.g. a public share
	// token). Use only for surfaces meant to work without login.
	RegisterPublicRoute(method string, path string, handler gin.HandlerFunc)
	EmitSocketEvent(room string, event string, payload interface{})
	GetStatus() PluginStatus
	// SendTicketMessage sends an outbound WhatsApp text message through the
	// ticket's session — same pipeline as POST /messages/:ticketId (publishes
	// to engine-go, persists the Message, emits real-time events). Returns an
	// error if the ticket doesn't belong to tenantID or has no contact.
	SendTicketMessage(tenantID uuid.UUID, ticketID int, body string) error
}

// WatinkCoreScheduler is an OPTIONAL extension of WatinkCore (ADR 0027) for
// plugins that need periodic jobs or internal domain-event subscriptions —
// capabilities the base WatinkCore does not provide. It is intentionally a
// separate interface, not added to WatinkCore directly, so existing plugins
// (HelpdeskPlugin, WebchatPlugin) keep compiling untouched. A plugin that
// needs it type-asserts:
//
//	if scheduler, ok := core.(sdk.WatinkCoreScheduler); ok {
//	    scheduler.RegisterCron("assistant-idle-sweep", 5*time.Minute, sweep)
//	}
type WatinkCoreScheduler interface {
	// RegisterCron runs fn every interval, guarded by a Redis leader-lock
	// (same SetNX pattern as the FlowBuilder scheduler) so exactly one node
	// executes a given job name at a time in a multi-node deployment. fn
	// errors are logged, never panic the process. Returns an error if name is
	// already registered.
	RegisterCron(name string, interval time.Duration, fn func(ctx context.Context) error) error
	// Subscribe registers fn against an internal domain event type (e.g.
	// "pipeline.deal.stage_changed", published by DomainEventBus). Delivery is
	// in-process, best-effort — no persistence/replay. Returns an error if the
	// event type has no publisher wired.
	Subscribe(eventType string, fn func(ctx context.Context, payload map[string]any)) error
}

// WatinkPlugin is the interface that every backend plugin must implement
type WatinkPlugin interface {
	GetManifest() PluginManifest
	OnInstall(core WatinkCore) error
	OnActivate(core WatinkCore) error
	OnDeactivate(core WatinkCore) error
}
