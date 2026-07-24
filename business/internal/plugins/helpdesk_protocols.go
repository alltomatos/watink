package plugins

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/gin-gonic/gin"
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

// generateProtocolToken devolve 32 chars hex (16 bytes) — credencial do link
// público (GET /public/protocols/:token), nunca reaproveitado.
func generateProtocolToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func generateProtocolNumber() string {
	return "PROTO-" + strconv.FormatInt(time.Now().UnixNano(), 36)
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
			msg := fmt.Sprintf("Protocolo *%s* aberto: %s\nAcompanhe em: %s", protocol.ProtocolNumber, protocol.Subject, link)
			if err := core.SendTicketMessage(tenantID, *req.TicketID, msg); err != nil {
				log.Printf("[handleCreateProtocol] failed to notify ticket %d: %v", *req.TicketID, err)
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
