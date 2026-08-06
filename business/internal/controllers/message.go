package controllers

import (
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/mediawait"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MessageController struct {
	rabbit      domain.CommandPublisher
	broadcast   domain.Broadcaster
	engines     domain.WhatsAppEngineResolver
	db          *gorm.DB
	mediaWaiter *mediawait.Waiter
}

func NewMessageController(r domain.CommandPublisher, b domain.Broadcaster, engines domain.WhatsAppEngineResolver) *MessageController {
	return &MessageController{rabbit: r, broadcast: domain.BroadcastOrNop(b), engines: engines}
}

// WithTranscription attaches the dependencies used only by the on-demand
// audio transcription endpoint (message_transcription.go) — kept out of the
// main constructor so every existing call site (including tests) stays
// unchanged; nil-safe (TranscribeAudio fails closed with a clear error if
// called on a controller that never got these wired).
func (mc *MessageController) WithTranscription(db *gorm.DB, mediaWaiter *mediawait.Waiter) *MessageController {
	mc.db = db
	mc.mediaWaiter = mediaWaiter
	return mc
}

// ListMessages returns all messages for a given ticket.
// @Summary      Listar mensagens do ticket
// @Tags         messages
// @Produce      json
// @Param        ticketId  path      int  true  "ID do ticket"
// @Param        pageNumber query int false "Página"
// @Success      200       {array}   map[string]interface{}
// @Security     BearerAuth
// @Router       /messages/{ticketId} [get]
func (mc *MessageController) ListMessages(c *gin.Context) {
	db, _, ok := auth.GetScoped(c, "Messages")
	if !ok {
		return
	}
	ticketID := c.Param("ticketId")

	pageNumber := 1
	if p, err := strconv.Atoi(c.Query("pageNumber")); err == nil && p > 0 {
		pageNumber = p
	}
	pageSize := 20
	offset := (pageNumber - 1) * pageSize

	var messages []models.Message
	if err := db.
		Where("\"ticketId\" = ?", ticketID).
		// WhatsApp timestamps (createdAt) only carry second precision, so
		// messages exchanged within the same second tie — without a
		// deterministic tiebreak, Postgres returns them in arbitrary heap
		// order, corrupting the reply/reply-back flow (issue #414). `id DESC`
		// mirrors the tiebreak the frontend sort applies after reversing.
		Order("\"createdAt\" DESC, id DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&messages).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListMessages")
		return
	}

	// Reverse to chronological order for the client
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	var count int64
	if err := db.Model(&models.Message{}).Where("\"ticketId\" = ?", ticketID).Count(&count).Error; err != nil {
		count = int64(len(messages))
	}

	c.JSON(http.StatusOK, gin.H{
		"messages": messages,
		"count":    count,
		"hasMore":  int64(offset+pageSize) < count,
	})
}
