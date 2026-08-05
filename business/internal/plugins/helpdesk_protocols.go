package plugins

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// publicProtocolURL builds the absolute link to the public protocol tracking
// page, same-origin with whatever host served this request (business embeds
// the frontend — see Dockerfile.business/CLAUDE.md). Honors
// X-Forwarded-Proto so it resolves correctly behind the Cloudflare Tunnel.
func publicProtocolURL(c *gin.Context, token string) string {
	scheme := "http"
	if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	} else if c.Request.TLS != nil {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/public/protocols/%s", scheme, c.Request.Host, token)
}

// priorityLabelPtBR mirrors the frontend's PRIORITY_LABELS map
// (frontend/src/pages/Helpdesk/helpdeskTypes.ts) — keep both in sync.
func priorityLabelPtBR(priority string) string {
	switch priority {
	case "low":
		return "Baixa"
	case "high":
		return "Alta"
	case "urgent":
		return "Urgente"
	default:
		return "Média"
	}
}

// generateProtocolToken devolve 32 chars hex (16 bytes) — credencial do link
// público (GET /public/protocols/:token), nunca reaproveitado.
func generateProtocolToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// protocolNumberLetters is the alphabet for the 4-letter uniqueness suffix —
// uppercase A-Z only (no digits), so it's visually distinct from the
// date/time prefix at a glance.
const protocolNumberLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// generateProtocolNumber builds ANOMESDIAHORARIO (YYYYMMDDHHMMSS, 14 digits,
// second-precision) + 4 random uppercase letters. The timestamp alone isn't
// enough to dedupe two protocols opened in the same second (e.g. two agents
// clicking "Abrir Protocolo" simultaneously); the letter suffix — not
// derived from the clock — is what actually prevents the collision.
func generateProtocolNumber() string {
	return time.Now().Format("20060102150405") + randomProtocolLetters(4)
}

func randomProtocolLetters(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand failing is effectively unreachable in practice; fall
		// back to a nanosecond-seeded pick rather than block protocol
		// creation on it.
		for i := range b {
			b[i] = byte(time.Now().UnixNano() >> uint(i*8))
		}
	}
	letters := make([]byte, n)
	for i, v := range b {
		letters[i] = protocolNumberLetters[int(v)%len(protocolNumberLetters)]
	}
	return string(letters)
}

// handleListProtocols — GET /helpdesk/protocols?searchParam=&status=&priority=
func handleListProtocols(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := auth.TenantUUIDFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
			return
		}

		query := core.GetDB().Preload("Contact").Preload("Contact.Client").
			Where(`"tenantId" = ?`, tenantID)

		if search := c.Query("searchParam"); search != "" {
			query = query.Where("subject ILIKE ?", "%"+search+"%")
		}
		if status := c.Query("status"); status != "" {
			query = query.Where("status = ?", status)
		}
		if priority := c.Query("priority"); priority != "" {
			query = query.Where("priority = ?", priority)
		}

		var protocols []models.Protocol
		if err := query.Order(`"createdAt" DESC`).Find(&protocols).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list protocols"})
			return
		}

		items := make([]protocolListItemDTO, 0, len(protocols))
		for _, p := range protocols {
			items = append(items, toListItemDTO(p))
		}
		c.JSON(http.StatusOK, gin.H{"protocols": items})
	}
}

type createProtocolRequest struct {
	Subject     string `json:"subject" binding:"required"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Priority    string `json:"priority"`
	Category    string `json:"category"`
	ContactID   int    `json:"contactId" binding:"required"`
	// TicketID is optional — set when the protocol is opened from within a
	// ticket conversation (HelpdeskSection), so we know which WhatsApp
	// session to notify. Absent when created from the standalone /helpdesk
	// page, where there's no ticket in context.
	TicketID *int `json:"ticketId"`
}

// handleCreateProtocol — POST /helpdesk/protocols
func handleCreateProtocol(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := auth.TenantUUIDFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
			return
		}

		var req createProtocolRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		db := core.GetDB()

		var contact models.Contact
		if err := db.Where(`id = ? AND "tenantId" = ?`, req.ContactID, tenantID).First(&contact).Error; err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "contact not found for this tenant"})
			return
		}

		token, err := generateProtocolToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		status := req.Status
		if status == "" {
			status = "open"
		}
		priority := req.Priority
		if priority == "" {
			priority = "medium"
		}

		protocol := models.Protocol{
			ProtocolNumber: generateProtocolNumber(),
			Subject:        req.Subject,
			Description:    req.Description,
			Category:       req.Category,
			Status:         status,
			Priority:       priority,
			Token:          token,
			ContactID:      req.ContactID,
			TenantID:       tenantID,
		}
		if err := db.Create(&protocol).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create protocol"})
			return
		}
		protocol.Contact = contact

		userID := userIDFromGinContext(c)
		db.Create(&models.ProtocolLog{
			ProtocolID: protocol.ID,
			UserID:     userID,
			Action:     "create",
			NewValue:   status,
			TenantID:   tenantID,
		})

		core.EmitSocketEvent("tenant:"+tenantID.String(), "protocol", gin.H{
			"action":   "create",
			"protocol": toKanbanProtocolDTO(protocol),
		})

		// Best-effort WhatsApp notification — mirrors the geocode pattern
		// (CLAUDE.md): never block/fail protocol creation on this. The
		// protocol already exists and its kanban card already emitted;
		// a failed notify just means the agent has to tell the customer
		// manually.
		if req.TicketID != nil {
			link := publicProtocolURL(c, protocol.Token)
			msg := fmt.Sprintf(
				"Olá! Seu protocolo de atendimento foi criado com sucesso.\n\n"+
					"*Protocolo:* #%s\n"+
					"*Assunto:* %s\n"+
					"*Prioridade:* %s\n\n"+
					"🔗 Acompanhe seu protocolo clicando aqui:\n%s",
				protocol.ProtocolNumber, protocol.Subject, priorityLabelPtBR(protocol.Priority), link,
			)
			if err := core.SendTicketMessage(tenantID, *req.TicketID, msg); err != nil {
				log.Printf("[handleCreateProtocol] failed to notify ticket %d: %v", *req.TicketID, err)
			}
		}

		// Best-effort Activity creation (Fase 1, issue #538/#542) — mesmo
		// padrão best-effort da notificação WhatsApp acima, mas SEM o guard
		// de req.TicketID: helpdesk_auto_create_activity é política do
		// tenant, não característica do canal de origem — vale tanto para
		// protocolos abertos a partir de um ticket quanto pela tela
		// standalone /helpdesk.
		if activities, ok := core.(sdk.WatinkCoreActivities); ok && helpdeskAutoCreateActivityEnabled(db, tenantID) {
			var assigneeIDs []int
			if userID != nil {
				assigneeIDs = []int{*userID}
			}
			if _, err := activities.CreateActivity(c.Request.Context(), tenantID, sdk.ActivityInput{
				Title:       fmt.Sprintf("Protocolo #%s — %s", protocol.ProtocolNumber, protocol.Subject),
				Description: protocol.Description,
				Priority:    protocol.Priority,
				ProtocolID:  &protocol.ID,
				AssigneeIDs: assigneeIDs,
			}); err != nil {
				log.Printf("[handleCreateProtocol] failed to create activity for protocol %d: %v", protocol.ID, err)
			}
		}

		c.JSON(http.StatusCreated, toDetailDTO(protocol, nil))
	}
}

// handleGetProtocol — GET /helpdesk/protocols/:id
func handleGetProtocol(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := auth.TenantUUIDFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
			return
		}

		var protocol models.Protocol
		db := core.GetDB()
		if err := db.Preload("Contact").Preload("Contact.Client").
			Where(`id = ? AND "tenantId" = ?`, c.Param("id"), tenantID).
			First(&protocol).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "protocol not found"})
			return
		}

		var history []models.ProtocolLog
		db.Preload("User").Where(`"protocolId" = ?`, protocol.ID).
			Order(`"createdAt" ASC`).Find(&history)

		c.JSON(http.StatusOK, toDetailDTO(protocol, history))
	}
}

// handleUpdateProtocol — PUT /helpdesk/protocols/:id (multipart/form-data:
// status, priority, comment, subject, description, category, files[]).
func handleUpdateProtocol(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := auth.TenantUUIDFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
			return
		}

		db := core.GetDB()
		var protocol models.Protocol
		if err := db.Where(`id = ? AND "tenantId" = ?`, c.Param("id"), tenantID).First(&protocol).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "protocol not found"})
			return
		}

		userID := userIDFromGinContext(c)
		previousStatus := protocol.Status

		newStatus := c.PostForm("status")
		newPriority := c.PostForm("priority")
		comment := c.PostForm("comment")

		if newStatus != "" && newStatus != protocol.Status {
			db.Create(&models.ProtocolLog{
				ProtocolID: protocol.ID, UserID: userID, Action: "status",
				PreviousValue: protocol.Status, NewValue: newStatus, TenantID: tenantID,
			})
			protocol.Status = newStatus
		}
		if newPriority != "" && newPriority != protocol.Priority {
			db.Create(&models.ProtocolLog{
				ProtocolID: protocol.ID, UserID: userID, Action: "priority",
				PreviousValue: protocol.Priority, NewValue: newPriority, TenantID: tenantID,
			})
			protocol.Priority = newPriority
		}
		if comment != "" {
			db.Create(&models.ProtocolLog{
				ProtocolID: protocol.ID, UserID: userID, Action: "comment",
				Comment: comment, TenantID: tenantID,
			})
		}

		if subject := c.PostForm("subject"); subject != "" {
			protocol.Subject = subject
		}
		protocol.Description = c.PostForm("description")
		protocol.Category = c.PostForm("category")

		if err := db.Save(&protocol).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update protocol"})
			return
		}

		if form, err := c.MultipartForm(); err == nil {
			saveUploadedAttachments(db, protocol.ID, form.File["files"])
		}

		db.Preload("Contact").Preload("Contact.Client").First(&protocol, protocol.ID)

		core.EmitSocketEvent("tenant:"+tenantID.String(), "protocol", gin.H{
			"action":         "update",
			"protocol":       toKanbanProtocolDTO(protocol),
			"previousStatus": previousStatus,
			"newStatus":      protocol.Status,
		})

		var history []models.ProtocolLog
		db.Preload("User").Where(`"protocolId" = ?`, protocol.ID).Order(`"createdAt" ASC`).Find(&history)
		c.JSON(http.StatusOK, toDetailDTO(protocol, history))
	}
}

// helpdeskAutoCreateActivityEnabled lê a Setting helpdesk_auto_create_activity
// do tenant — ausência ou valor diferente de "true" (mesma convenção de
// aiPipelineEnabled em controllers/pipeline.go) cai no default false: por
// padrão, abrir um Protocol NÃO cria Activity. Session(NewDB:true) porque db
// já foi usado em queries anteriores na mesma requisição (Contact lookup,
// Protocol/ProtocolLog create) — reusar o handle sem sessão nova acumula
// Where e faz esta leitura casar zero linhas (mesmo bug documentado em
// activity_sla.go).
func helpdeskAutoCreateActivityEnabled(db *gorm.DB, tenantID uuid.UUID) bool {
	var setting models.Setting
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`key = ? AND "tenantId" = ?`, "helpdesk_auto_create_activity", tenantID).First(&setting).Error; err != nil {
		return false
	}
	return setting.Value == "true"
}

// userIDFromGinContext lê o userId numérico já injetado por middleware.IsAuth
// (mesmo padrão de business/pkg/auth/permission.go userIDFromContext, não
// exportado dali) — nil quando ausente (ex.: chamada de teste sem middleware).
func userIDFromGinContext(c *gin.Context) *int {
	v, ok := c.Get("userId")
	if !ok {
		return nil
	}
	switch id := v.(type) {
	case int:
		return &id
	case float64:
		i := int(id)
		return &i
	default:
		return nil
	}
}
