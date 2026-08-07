package controllers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var validQuickAnswerTypes = map[string]bool{
	"text": true, "interactive_buttons": true, "list": true,
	"media": true, "poll": true, "carousel": true, "pix": true,
}

func validateQuickAnswerType(t string) error {
	if t == "" || t == "text" {
		return nil
	}
	if !validQuickAnswerTypes[t] {
		return fmt.Errorf("invalid type %q: must be one of text, interactive_buttons, list, media, poll, carousel, pix", t)
	}
	return nil
}

func validateQuickAnswerContent(content string) error {
	if content == "" || content == "null" {
		return nil
	}
	var js json.RawMessage
	if err := json.Unmarshal([]byte(content), &js); err != nil {
		return fmt.Errorf("content must be valid JSON: %w", err)
	}
	return nil
}

func isUniqueViolation(err error, indexName string) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, indexName) || (strings.Contains(msg, "unique") && strings.Contains(msg, "shortcut"))
}

// buildInteractiveDataJSON foi movida para flow.BuildInteractiveDataJSON
// (business/internal/flow/quickanswer_normalize.go) -- internal/plugins não
// pode importar internal/controllers (controllers já importa plugins,
// ciclo reverso), e internal/flow já é a casa compartilhada de
// BuildQuickAnswerCommand para exatamente esse tipo de função. Ver issue
// #592.

// QuickAnswerController encapsulates quick answer operations with RLS-scoped DB from auth middleware.
// All queries are automatically tenant-scoped via auth.GetDB(c).
type QuickAnswerController struct {
	rabbit    domain.CommandPublisher
	broadcast domain.Broadcaster
	db        *gorm.DB
	engines   domain.WhatsAppEngineResolver
}

func NewQuickAnswerController(r domain.CommandPublisher, b domain.Broadcaster, db *gorm.DB, engines domain.WhatsAppEngineResolver) *QuickAnswerController {
	return &QuickAnswerController{rabbit: r, broadcast: domain.BroadcastOrNop(b), db: db, engines: engines}
}

// @Summary      Listar respostas rápidas
// @Tags         quick-answers
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Security     BearerAuth
// @Router       /quickAnswers [get]
func (qac *QuickAnswerController) List(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "QuickAnswers")
	if !ok {
		return
	}

	query := db.Where("\"tenantId\" = ?", tenantID)
	// Filtro opcional usado pelo autocomplete "/" no chat e pela busca da página.
	if search := strings.TrimSpace(c.Query("searchParam")); search != "" {
		like := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(shortcut) LIKE ? OR LOWER(slug) LIKE ? OR LOWER(message) LIKE ?",
			like, like, like,
		)
	}

	var quickAnswers []models.QuickAnswer
	if err := query.Order("shortcut ASC").Find(&quickAnswers).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListQuickAnswers")
		return
	}

	c.JSON(http.StatusOK, quickAnswers)
}

// @Summary      Detalhar resposta rápida
// @Tags         quick-answers
// @Produce      json
// @Param        quickAnswerId  path      int  true  "ID da resposta rápida"
// @Success      200            {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /quickAnswers/{quickAnswerId} [get]
func (qac *QuickAnswerController) Show(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "QuickAnswers")
	if !ok {
		return
	}
	id := c.Param("quickAnswerId")

	var quickAnswer models.QuickAnswer
	if err := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).First(&quickAnswer).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ShowQuickAnswer")
		return
	}

	c.JSON(http.StatusOK, quickAnswer)
}

type updateQuickAnswerInput struct {
	Shortcut  string `json:"shortcut"`
	Slug      string `json:"slug"`
	Message   string `json:"message"`
	MediaType string `json:"mediaType"`
	DataJson  string `json:"dataJson"`
	Type      string `json:"type"`
	Content   string `json:"content"`
}

// maxQuickAnswerMessageLen is the maximum allowed length for a quick answer message body.
const maxQuickAnswerMessageLen = 65535

// @Summary      Criar resposta rápida
// @Tags         quick-answers
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados da resposta"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /quickAnswers [post]
func (qac *QuickAnswerController) Create(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "QuickAnswers")
	if !ok {
		return
	}

	var qa models.QuickAnswer
	if err := c.ShouldBindJSON(&qa); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	if _, err := utils.ValidateStringField(qa.Shortcut, "shortcut", 100); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(qa.Slug, "slug", 120); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(qa.Message, "message", maxQuickAnswerMessageLen); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(qa.MediaType, "mediaType", 50); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateQuickAnswerType(qa.Type); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateQuickAnswerContent(qa.Content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	qa.TenantID = tenantID
	if qa.Type == "" {
		qa.Type = "text"
	}
	if err := db.Create(&qa).Error; err != nil {
		if isUniqueViolation(err, "idx_quick_answers_tenant_shortcut") {
			c.JSON(http.StatusConflict, gin.H{"error": "shortcut already exists for this tenant"})
			return
		}
		utils.RespondWithInternalError(c, err, "CreateQuickAnswer")
		return
	}

	c.JSON(http.StatusOK, qa)
}

// @Summary      Atualizar resposta rápida
// @Tags         quick-answers
// @Accept       json
// @Produce      json
// @Param        quickAnswerId  path      int                     true  "ID da resposta"
// @Param        body           body      map[string]interface{}  true  "Campos a atualizar"
// @Success      200            {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /quickAnswers/{quickAnswerId} [put]
func (qac *QuickAnswerController) Update(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "QuickAnswers")
	if !ok {
		return
	}
	id := c.Param("quickAnswerId")

	var qa models.QuickAnswer
	if err := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).First(&qa).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateQuickAnswer-Fetch")
		return
	}

	var input updateQuickAnswerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	shortcut, err := utils.ValidateStringField(input.Shortcut, "shortcut", 100)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	message, err := utils.ValidateStringField(input.Message, "message", maxQuickAnswerMessageLen)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	mediaType, err := utils.ValidateStringField(input.MediaType, "mediaType", 50)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateQuickAnswerType(input.Type); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateQuickAnswerContent(input.Content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	slug, err := utils.ValidateStringField(input.Slug, "slug", 120)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	qa.Shortcut = shortcut
	qa.Slug = slug
	qa.Message = message
	qa.MediaType = mediaType
	if input.DataJson != "" {
		qa.DataJson = input.DataJson
	}
	if input.Type != "" {
		qa.Type = input.Type
	}
	if input.Content != "" {
		qa.Content = input.Content
	}

	if err := db.Session(&gorm.Session{NewDB: true}).Save(&qa).Error; err != nil {
		if isUniqueViolation(err, "idx_quick_answers_tenant_shortcut") {
			c.JSON(http.StatusConflict, gin.H{"error": "shortcut already exists for this tenant"})
			return
		}
		utils.RespondWithInternalError(c, err, "UpdateQuickAnswer-Save")
		return
	}

	c.JSON(http.StatusOK, qa)
}

// @Summary      Disparar resposta rápida
// @Tags         quick-answers
// @Accept       json
// @Produce      json
// @Param        quickAnswerId  path      int                     true  "ID da resposta"
// @Param        body           body      map[string]interface{}  true  "ticketId e variables opcionais"
// @Success      200            {object}  map[string]string
// @Security     BearerAuth
// @Router       /quickAnswers/{quickAnswerId}/send [post]
func (qac *QuickAnswerController) Send(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "QuickAnswers")
	if !ok {
		return
	}
	qaID := c.Param("quickAnswerId")

	var input struct {
		TicketID  int               `json:"ticketId"`
		Variables map[string]string `json:"variables"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if input.TicketID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ticketId is required"})
		return
	}

	var qa models.QuickAnswer
	if err := db.Where("id = ? AND \"tenantId\" = ?", qaID, tenantID).First(&qa).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "quick answer not found"})
		return
	}

	var ticket models.Ticket
	if err := db.Session(&gorm.Session{NewDB: true}).Preload("Contact").Where("id = ? AND \"tenantId\" = ?", input.TicketID, tenantID).First(&ticket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
		return
	}

	autoVars := map[string]string{
		"contact_name": ticket.Contact.Name,
		"ticket_id":    strconv.Itoa(ticket.ID),
		"agent_name":   tenantID.String(),
		"company_name": tenantID.String(),
	}
	for k, v := range input.Variables {
		autoVars[k] = v
	}

	content := utils.InterpolateVariables(qa.Content, autoVars)
	message := utils.InterpolateVariables(qa.Message, autoVars)

	qaType := qa.Type
	if qaType == "" {
		qaType = "text"
	}

	to := contactJID(ticket.Contact)

	msgID := newWAMessageID()
	sessionID := ticket.WhatsappID

	var contentMap map[string]interface{}
	if content != "" {
		_ = json.Unmarshal([]byte(content), &contentMap)
	}

	commandType, payload := flow.BuildQuickAnswerCommand(qaType, message, contentMap, sessionID, msgID, to)

	var whatsapp models.Whatsapp
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where("id = ? AND \"tenantId\" = ?", ticket.WhatsappID, tenantID).First(&whatsapp).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Connection not found"})
		return
	}

	if whatsapp.EngineType != "" && whatsapp.EngineType != "whatsmeow" {
		// Non-AMQP engines (e.g. izapia) are dispatched via domain.WhatsAppEngine.
		// text/media go through SendText/SendMedia; rich types (interactive/
		// list/poll/carousel/pix) go through RichMessageEngine when the engine
		// implements it. An engine with neither fails loud instead of silently
		// publishing to a routing key it will never consume (see
		// message_send.go/whatsapp_adapter.go for the same pattern).
		if qac.engines == nil {
			utils.RespondWithInternalError(c, fmt.Errorf("no engine resolver configured"), "SendQuickAnswer")
			return
		}
		engine, err := qac.engines.EngineFor(whatsapp)
		if err != nil {
			utils.RespondWithInternalError(c, err, "SendQuickAnswer")
			return
		}
		switch commandType {
		case "message.send.text":
			body, _ := payload["body"].(string)
			err = engine.SendText(c.Request.Context(), whatsapp, to, msgID, body)
		case "message.send.media":
			mediaURL, _ := payload["mediaUrl"].(string)
			mediaType, _ := payload["mediaType"].(string)
			mimeType, _ := payload["mimeType"].(string)
			err = engine.SendMedia(c.Request.Context(), whatsapp, to, msgID, mediaType, mediaURL, mimeType)
		default:
			richEngine, ok := engine.(domain.RichMessageEngine)
			if !ok {
				err = fmt.Errorf("resposta rápida do tipo %q não suportada no engine %q", qaType, whatsapp.EngineType)
				break
			}
			req := flow.BuildRichMessageRequest(qaType, message, contentMap)
			err = richEngine.SendInteractive(c.Request.Context(), whatsapp, to, msgID, req)
		}
		if err != nil {
			utils.RespondWithInternalError(c, err, "SendQuickAnswer")
			return
		}
	} else {
		command := map[string]interface{}{
			"type":    commandType,
			"payload": payload,
		}

		routingKey := fmt.Sprintf("wbot.%s.%d.%s", tenantID.String(), ticket.WhatsappID, commandType)
		if err := qac.rabbit.PublishCommand(routingKey, command); err != nil {
			utils.RespondWithInternalError(c, err, "SendQuickAnswer")
			return
		}
	}

	// Persist outgoing message so it appears in the UI and ack events can find it.
	writeDB := qac.db.Session(&gorm.Session{NewDB: true})
	contactID := ticket.ContactID
	now := time.Now()

	msgBody := message
	msgMediaURL := ""
	msgMediaType := ""
	if qaType == "media" {
		if mu, ok := contentMap["url"].(string); ok {
			msgMediaURL = mu
		}
		if mt, ok := contentMap["mediaType"].(string); ok {
			msgMediaType = mt
		}
		if msgBody == "" {
			if cap, ok := contentMap["caption"].(string); ok {
				msgBody = cap
			}
		}
		if msgBody == "" {
			msgBody = "📎 Mídia"
		}
	}

	// Para tipos interativos, persistir o corpo realmente enviado (content.body)
	// e a estrutura dos botões/lista/enquete em DataJson, sob a chave "interactive".
	// O frontend lê isso para renderizar os chips visuais na bolha do chat — o
	// WhatsApp Web/Desktop da Meta não renderiza, mas a UI do Watink é nossa.
	if (qaType == "interactive_buttons" || qaType == "list" || qaType == "carousel" || qaType == "pix") && msgBody == message {
		if b, ok := contentMap["body"].(string); ok && b != "" {
			msgBody = b
		}
	}
	dataJSON := flow.BuildInteractiveDataJSON(qaType, contentMap)

	outgoing := models.Message{
		ID:        msgID,
		Body:      msgBody,
		Ack:       0,
		MediaType: msgMediaType,
		MediaUrl:  msgMediaURL,
		TicketID:  input.TicketID,
		FromMe:    true,
		ContactID: &contactID,
		TenantID:  tenantID,
		Reactions: "[]",
		DataJson:  dataJSON,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := writeDB.Create(&outgoing).Error; err != nil {
		log.Printf("[SendQuickAnswer] persist outgoing message failed (ticket %d): %v", input.TicketID, err)
	}

	lastMessage := msgBody
	writeDB.Model(&models.Ticket{}).
		Where("id = ? AND \"tenantId\" = ?", input.TicketID, tenantID).
		Updates(map[string]interface{}{"lastMessage": lastMessage, "updatedAt": now})

	ticketRoom := "chat:" + strconv.Itoa(input.TicketID)
	msgPayload := map[string]interface{}{"action": "create", "message": outgoing}
	qac.broadcast.EmitToRoom("/", ticketRoom, "appMessage", msgPayload)
	qac.broadcast.EmitToTenantRoom(tenantID.String(), "appMessage", msgPayload)
	qac.broadcast.EmitToTenantRoom(tenantID.String(), "ticket", map[string]interface{}{
		"action": "update",
		"ticket": map[string]interface{}{
			"id":          input.TicketID,
			"lastMessage": lastMessage,
			"updatedAt":   now,
		},
	})

	c.JSON(http.StatusOK, gin.H{"message": "sent"})
}

// @Summary      Remover resposta rápida
// @Tags         quick-answers
// @Produce      json
// @Param        quickAnswerId  path      int  true  "ID da resposta"
// @Success      200            {object}  map[string]string
// @Security     BearerAuth
// @Router       /quickAnswers/{quickAnswerId} [delete]
func (qac *QuickAnswerController) Delete(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "QuickAnswers")
	if !ok {
		return
	}
	id := c.Param("quickAnswerId")

	result := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).Delete(&models.QuickAnswer{})
	if result.Error != nil {
		utils.RespondWithInternalError(c, result.Error, "DeleteQuickAnswer")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondWithInternalError(c, gorm.ErrRecordNotFound, "DeleteQuickAnswer-NotFound")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Quick answer deleted successfully"})
}
