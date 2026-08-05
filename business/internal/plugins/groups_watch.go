package plugins

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// registerGroupWatchEvents wires the "monitoramento de frase" feature: a
// tenant registers phrases (GroupWatchTag) and every inbound group message
// gets checked against them (case-insensitive substring) via the
// "message.received" domain event (published by
// usecases.ReceiveMessageUseCase.Execute, same event class as
// assistant_pipeline_events.go's "pipeline.deal.*"). Silently disabled
// (logged once) if the core doesn't support sdk.WatinkCoreScheduler --
// mirrors registerAssistantPipelineEvents, never panics OnActivate.
func registerGroupWatchEvents(core sdk.WatinkCore) {
	scheduler, ok := core.(sdk.WatinkCoreScheduler)
	if !ok {
		log.Printf("[groups] WatinkCoreScheduler não disponível — monitoramento de frase desabilitado")
		return
	}
	db := core.GetDB()
	if err := scheduler.Subscribe("message.received", func(ctx context.Context, payload map[string]any) {
		handleGroupWatchMessage(ctx, core, db, payload)
	}); err != nil {
		log.Printf("[groups] subscribe message.received falhou: %v", err)
	}
}

// handleGroupWatchMessage is the "message.received" subscriber. Skips fast
// (no query at all) for the overwhelming majority of traffic: non-group
// messages and tenants with zero active tags.
func handleGroupWatchMessage(ctx context.Context, core sdk.WatinkCore, db *gorm.DB, payload map[string]any) {
	isGroup, _ := payload["isGroup"].(bool)
	if !isGroup {
		return
	}
	tenantIDStr, _ := payload["tenantId"].(string)
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return
	}
	ticketID, _ := payload["ticketId"].(int)
	messageID, _ := payload["messageId"].(string)
	if ticketID == 0 || messageID == "" {
		return
	}

	var tags []models.GroupWatchTag
	if err := db.Where(`"tenantId" = ? AND active = ?`, tenantID, true).Find(&tags).Error; err != nil || len(tags) == 0 {
		return
	}

	var msg models.Message
	if err := db.Where(`id = ? AND "tenantId" = ?`, messageID, tenantID).First(&msg).Error; err != nil || msg.Body == "" {
		return
	}
	bodyLower := strings.ToLower(strings.TrimSpace(msg.Body))

	matched := make([]models.GroupWatchTag, 0, len(tags))
	for _, t := range tags {
		if tagMatches(t, bodyLower) {
			matched = append(matched, t)
		}
	}
	if len(matched) == 0 {
		return
	}

	var ticket models.Ticket
	if err := db.Preload("Contact").Where(`id = ? AND "tenantId" = ?`, ticketID, tenantID).First(&ticket).Error; err != nil {
		return
	}

	snippet := msg.Body
	if len(snippet) > 280 {
		snippet = snippet[:280]
	}

	writeDB := db.Session(&gorm.Session{NewDB: true})
	for _, t := range matched {
		match := models.GroupWatchMatch{
			TenantID:       tenantID,
			TagID:          t.ID,
			Phrase:         t.Phrase,
			TicketID:       ticket.ID,
			MessageID:      msg.ID,
			GroupSubject:   ticket.Contact.Name,
			ContactName:    messagePushName(msg.DataJson),
			Snippet:        snippet,
			NotifyGlobally: t.NotifyGlobally,
			CreatedAt:      time.Now(),
		}
		if err := writeDB.Create(&match).Error; err != nil {
			log.Printf("[groups] falha ao salvar watch match (tag %d, msg %s): %v", t.ID, msg.ID, err)
			continue
		}
		core.EmitSocketEvent("tenant:"+tenantID.String(), "group-watch-match", match)
	}
}

// tagMatches applies t.MatchMode against an already-lowercased/trimmed
// message body. "exact" requires the WHOLE message to equal the phrase
// (also lowercased/trimmed) — anything else (including empty/unknown
// MatchMode, e.g. rows created before this field existed) falls back to
// "contains", the original behavior.
func tagMatches(t models.GroupWatchTag, bodyLower string) bool {
	phraseLower := strings.ToLower(strings.TrimSpace(t.Phrase))
	if t.MatchMode == models.GroupWatchMatchExact {
		return bodyLower == phraseLower
	}
	return strings.Contains(bodyLower, phraseLower)
}

// messagePushName pulls the sender's push name out of Message.DataJson
// (persisted by receive_message.go as "pushName") -- best-effort, empty
// string on any decode failure. Never the group subject (that's
// Ticket.Contact.Name).
func messagePushName(dataJSON string) string {
	if dataJSON == "" {
		return ""
	}
	var data struct {
		PushName string `json:"pushName"`
	}
	if err := json.Unmarshal([]byte(dataJSON), &data); err != nil {
		return ""
	}
	return data.PushName
}

// ── CRUD: tags ──────────────────────────────────────────────────────────

type createGroupWatchTagRequest struct {
	Phrase         string                     `json:"phrase" binding:"required"`
	NotifyGlobally bool                       `json:"notifyGlobally"`
	MatchMode      models.GroupWatchMatchMode `json:"matchMode" binding:"omitempty,oneof=contains exact"`
}

type updateGroupWatchTagRequest struct {
	Phrase         string                     `json:"phrase" binding:"required"`
	Active         bool                       `json:"active"`
	NotifyGlobally bool                       `json:"notifyGlobally"`
	MatchMode      models.GroupWatchMatchMode `json:"matchMode" binding:"omitempty,oneof=contains exact"`
}

func handleListGroupWatchTags(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		var tags []models.GroupWatchTag
		if err := db.Session(&gorm.Session{NewDB: true}).
			Where(`"tenantId" = ?`, tenantID).
			Order(`"createdAt" DESC`).
			Find(&tags).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load watch tags"})
			return
		}
		c.JSON(http.StatusOK, tags)
	}
}

func handleCreateGroupWatchTag(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		var req createGroupWatchTagRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		phrase := strings.TrimSpace(req.Phrase)
		if phrase == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phrase não pode ser vazia"})
			return
		}
		matchMode := req.MatchMode
		if matchMode == "" {
			matchMode = models.GroupWatchMatchContains
		}
		tag := models.GroupWatchTag{
			TenantID:       tenantID,
			Phrase:         phrase,
			Active:         true,
			MatchMode:      matchMode,
			NotifyGlobally: req.NotifyGlobally,
			CreatedAt:      time.Now(),
		}
		if err := db.Session(&gorm.Session{NewDB: true}).Create(&tag).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create watch tag"})
			return
		}
		c.JSON(http.StatusCreated, tag)
	}
}

// handleUpdateGroupWatchTag edits phrase/active/notifyGlobally/matchMode of
// an existing tag. Past matches keep their OWN snapshot of phrase/
// notifyGlobally (models.GroupWatchMatch doc comment) — editing a tag never
// rewrites history.
func handleUpdateGroupWatchTag(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
			return
		}
		var req updateGroupWatchTagRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		phrase := strings.TrimSpace(req.Phrase)
		if phrase == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phrase não pode ser vazia"})
			return
		}
		matchMode := req.MatchMode
		if matchMode == "" {
			matchMode = models.GroupWatchMatchContains
		}
		writeDB := db.Session(&gorm.Session{NewDB: true})
		result := writeDB.Model(&models.GroupWatchTag{}).
			Where(`id = ? AND "tenantId" = ?`, id, tenantID).
			Updates(map[string]interface{}{
				"phrase":         phrase,
				"active":         req.Active,
				"notifyGlobally": req.NotifyGlobally,
				"matchMode":      matchMode,
			})
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update watch tag"})
			return
		}
		if result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "tag não encontrada"})
			return
		}
		var tag models.GroupWatchTag
		if err := writeDB.Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&tag).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reload watch tag"})
			return
		}
		c.JSON(http.StatusOK, tag)
	}
}

func handleDeleteGroupWatchTag(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
			return
		}
		if err := db.Session(&gorm.Session{NewDB: true}).
			Where(`id = ? AND "tenantId" = ?`, id, tenantID).
			Delete(&models.GroupWatchTag{}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete watch tag"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// ── Feed: matches ───────────────────────────────────────────────────────

const groupWatchMatchesLimit = 100

// handleListGroupWatchMatches supports an optional ?tagId= filter so the
// feed can be narrowed server-side — with a fixed window of the 100 most
// recent matches, filtering client-side alone would hide older matches of
// the selected tag once total volume passes 100 across ALL tags combined.
func handleListGroupWatchMatches(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		query := db.Session(&gorm.Session{NewDB: true}).
			Where(`"tenantId" = ?`, tenantID)
		if tagIDRaw := c.Query("tagId"); tagIDRaw != "" {
			tagID, err := strconv.Atoi(tagIDRaw)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "tagId inválido"})
				return
			}
			query = query.Where(`"tagId" = ?`, tagID)
		}
		var matches []models.GroupWatchMatch
		if err := query.
			Order(`"createdAt" DESC`).
			Limit(groupWatchMatchesLimit).
			Find(&matches).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load watch matches"})
			return
		}
		c.JSON(http.StatusOK, matches)
	}
}
