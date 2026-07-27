package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/mediastore"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// newWAMessageID generates a WhatsApp-compatible outgoing message ID
// (uppercase hex, "3EB0" prefix — the de-facto format for bot-sent messages).
func newWAMessageID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("3EB0%016X", time.Now().UnixNano())
	}
	return "3EB0" + strings.ToUpper(hex.EncodeToString(b))
}

// contactJID builds the destination JID for a contact. Groups use the "@g.us"
// server. LID contacts use the full "@lid" JID stored in the Lid field.
// Regular users are sent bare (the engine appends "@s.whatsapp.net").
func contactJID(contact models.Contact) string {
	if contact.IsGroup {
		return contact.Number + "@g.us"
	}
	if contact.Lid != nil && *contact.Lid != "" {
		return *contact.Lid
	}
	return contact.Number
}

// SendMessage envia uma mensagem via engine WhatsApp.
// Aceita JSON (texto) ou multipart/form-data (mídia com arquivo binário).
//
// @Summary      Enviar mensagem
// @Description  Envia mensagem de texto ou mídia via engine WhatsApp
// @Tags         messages
// @Accept       json
// @Accept       mpfd
// @Produce      json
// @Param        ticketId  path      int     true  "ID do ticket"
// @Param        body      body      object  false "Corpo JSON para texto"
// @Param        medias    formData  file    false "Arquivo de mídia (multipart)"
// @Param        fromMe    formData  string  false "true/false"
// @Success      200       {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /messages/{ticketId} [post]
func (mc *MessageController) SendMessage(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Messages")
	if !ok {
		return
	}

	ticketIDStr := c.Param("ticketId")
	ticketID, err := strconv.Atoi(ticketIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	// Preload the contact so we can resolve the destination JID. We must not reuse
	// the (already tenant-scoped) db for a second .First() — GORM would accumulate
	// the ticket's id filter into the contact query (id = ticketID AND id = contactID).
	var ticket models.Ticket
	if err := db.Preload("Contact").Where("id = ? AND \"tenantId\" = ?", ticketID, tenantID).First(&ticket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	contact := ticket.Contact
	if contact.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"})
		return
	}

	ct := c.ContentType()
	var body, mediaType, mediaURL, mimeType string

	if ct == "application/json" || ct == "" {
		var input struct {
			Body      string `json:"body"`
			MediaType string `json:"mediaType"`
			MediaUrl  string `json:"mediaUrl"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		if _, err := utils.ValidateStringField(input.Body, "body", 65535); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if _, err := utils.ValidateStringField(input.MediaType, "mediaType", 50); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if _, err := utils.ValidateStringField(input.MediaUrl, "mediaUrl", 2048); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		body = input.Body
		mediaType = input.MediaType
		mediaURL = input.MediaUrl
	} else {
		// multipart/form-data: arquivo(s) de mídia
		body = c.PostForm("body")
		file, header, err := c.Request.FormFile("medias")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "medias file required for multipart"})
			return
		}
		defer func() { _ = file.Close() }()

		mimeType = sanitizeMimeType(header.Header.Get("Content-Type"))

		savedURL, err := mediastore.SaveMediaReader(file, mimeType)
		if err != nil {
			log.Printf("[SendMessage] media save failed (ticket %d)", ticketID)
			utils.RespondWithInternalError(c, err, "SendMessage.SaveMedia")
			return
		}

		mediaURL = savedURL
		mediaType = mimeTypeToMediaType(mimeType)
	}

	messageID := newWAMessageID()
	to := contactJID(contact)

	var whatsapp models.Whatsapp
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where("id = ? AND \"tenantId\" = ?", ticket.WhatsappID, tenantID).First(&whatsapp).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Connection not found"})
		return
	}

	if whatsapp.EngineType != "" && whatsapp.EngineType != "whatsmeow" {
		// Non-AMQP engines (e.g. izapia) are dispatched via domain.WhatsAppEngine
		// instead of the raw wbot.<tenant>.<session>.<cmd> command below.
		if mc.engines == nil {
			utils.RespondWithInternalError(c, fmt.Errorf("no engine resolver configured"), "SendMessage")
			return
		}
		engine, err := mc.engines.EngineFor(whatsapp)
		if err != nil {
			utils.RespondWithInternalError(c, err, "SendMessage")
			return
		}
		if mediaURL != "" {
			err = engine.SendMedia(c.Request.Context(), whatsapp, to, messageID, mediaType, mediaURL, mimeType)
		} else {
			err = engine.SendText(c.Request.Context(), whatsapp, to, messageID, body)
		}
		if err != nil {
			utils.RespondWithInternalError(c, err, "SendMessage")
			return
		}
	} else {
		commandType := "message.send.text"
		if mediaURL != "" {
			commandType = "message.send.media"
		}

		command := map[string]interface{}{
			"type": commandType,
			"payload": map[string]interface{}{
				"sessionId": ticket.WhatsappID,
				"messageId": messageID,
				"to":        to,
				"ticketId":  ticketID,
				"body":      body,
				"mediaType": mediaType,
				"mediaUrl":  mediaURL,
				"mimeType":  mimeType,
			},
		}

		// The engine dispatches by routing-key segment (wbot.<tenant>.<session>.<cmd>),
		// so the command type MUST be encoded in the key — not just the body.
		routingKey := fmt.Sprintf("wbot.%s.%d.%s", tenantID.String(), ticket.WhatsappID, commandType)
		if err := mc.rabbit.PublishCommand(routingKey, command); err != nil {
			utils.RespondWithInternalError(c, err, "SendMessage")
			return
		}
	}

	// Persist the outgoing message so it appears in the UI immediately and the
	// later ack event (event_listener_msg_ack) can find and update it.
	// Use a clean session for writes — the scoped `db` already carries the tenant
	// Where clause and a finished SELECT statement, which corrupts the generated
	// SQL when reused for Create/Updates. NewDB clears accumulated conditions
	// while keeping the same connection; tenant safety is preserved because the
	// inserted row and the update filter both set tenantId explicitly.
	writeDB := db.Session(&gorm.Session{NewDB: true})
	contactID := ticket.ContactID
	now := time.Now()
	outgoing := models.Message{
		ID:        messageID,
		Body:      body,
		Ack:       0,
		MediaType: mediaType,
		MediaUrl:  mediaURL,
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
		log.Printf("[SendMessage] persist outgoing message failed (ticket %d): %v", ticketID, err)
	}

	lastMessage := body
	if lastMessage == "" && mediaURL != "" {
		lastMessage = "📎 Mídia"
	}
	writeDB.Model(&models.Ticket{}).
		Where("id = ? AND \"tenantId\" = ?", ticketID, tenantID).
		Updates(map[string]interface{}{"lastMessage": lastMessage, "updatedAt": now})

	// Emit socket events so the frontend updates in real-time without a page refresh.
	// Pattern mirrors event_listener.go: appMessage to the ticket room + tenant room,
	// and ticket:update to the tenant room so the sidebar lastMessage refreshes.
	ticketRoom := "chat:" + strconv.Itoa(ticketID)
	msgPayload := map[string]interface{}{"action": "create", "message": outgoing}
	mc.broadcast.EmitToRoom("/", ticketRoom, "appMessage", msgPayload)
	mc.broadcast.EmitToTenantRoom(tenantID.String(), "appMessage", msgPayload)
	mc.broadcast.EmitToTenantRoom(tenantID.String(), "ticket", map[string]interface{}{
		"action": "update",
		"ticket": map[string]interface{}{
			"id":          ticketID,
			"lastMessage": lastMessage,
			"updatedAt":   now,
		},
	})

	c.JSON(http.StatusOK, gin.H{"message": "Message sent", "messageId": messageID})
}

// sanitizeMimeType strips newlines and control characters from a user-supplied
// Content-Type header to prevent log injection. Falls back to
// "application/octet-stream" when the value is empty after sanitization.
func sanitizeMimeType(raw string) string {
	safe := strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r < 0x20 {
			return -1
		}
		return r
	}, raw)
	if safe == "" {
		return "application/octet-stream"
	}
	return safe
}

func mimeTypeToMediaType(mimeType string) string {
	switch {
	case len(mimeType) >= 5 && mimeType[:5] == "image":
		return "image"
	case len(mimeType) >= 5 && mimeType[:5] == "video":
		return "video"
	case len(mimeType) >= 5 && mimeType[:5] == "audio":
		return "audio"
	default:
		return "document"
	}
}
