package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// @Summary      Importar contatos do WhatsApp
// @Description  Dispara a importação da agenda de contatos da sessão WhatsApp conectada
// @Tags         contacts
// @Produce      json
// @Success      202  {object}  map[string]string
// @Failure      409  {object}  map[string]string
// @Security     BearerAuth
// @Router       /contacts/import [post]
func (cc *ContactController) ImportContacts(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Contacts")
	if !ok {
		return
	}

	sessions, err := cc.sessions.FindAll(c.Request.Context(), tenantID)
	if err != nil {
		utils.RespondWithInternalError(c, err, "ImportContacts")
		return
	}

	// Mass contact import only exists as an engine-go/whatsmeow command
	// today (contact.import over AMQP) -- izapia has no equivalent endpoint
	// yet. Picking ANY connected session regardless of engine used to
	// silently publish to a topic engine-go never consumes when the chosen
	// session was izapia (202 Accepted, nothing happens). Require an
	// engine-go session specifically, with a clear error otherwise.
	var session *domain.ChannelSession
	for i := range sessions {
		if sessions[i].Status == "CONNECTED" && sessions[i].EngineType != "izapia" {
			session = &sessions[i]
			break
		}
	}
	if session == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "No connected WhatsApp (whatsmeow) session available to import contacts — izapia connections don't support bulk import yet"})
		return
	}

	command := map[string]interface{}{
		"id":        uuid.New().String(),
		"timestamp": time.Now().UnixMilli(),
		"tenantId":  tenantID.String(),
		"type":      "contact.import",
		"payload": map[string]interface{}{
			"sessionId": session.ID,
		},
	}
	routingKey := fmt.Sprintf("wbot.%s.%d.contact.import", tenantID.String(), session.ID)
	if err := cc.publisher.PublishCommand(routingKey, command); err != nil {
		utils.RespondWithInternalError(c, err, "ImportContacts")
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"message": "Contact import started"})
}

// @Summary      Sincronizar foto do contato via WhatsApp
// @Description  Busca a foto de perfil atualizada do contato. Para conexões izapia, roda de forma síncrona e responde 200; para engine-go, publica o comando assíncrono e responde 202.
// @Tags         contacts
// @Produce      json
// @Param        contactId  path      int  true  "ID do contato"
// @Success      200        {object}  map[string]string
// @Success      202        {object}  map[string]string
// @Failure      404        {object}  map[string]string
// @Failure      409        {object}  map[string]string
// @Security     BearerAuth
// @Router       /contacts/{contactId}/sync [post]
func (cc *ContactController) SyncContact(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Contacts")
	if !ok {
		return
	}
	id, ok := utils.ParseIntParam(c, "contactId")
	if !ok {
		return
	}

	contact, err := cc.contactRepo.FindByID(c.Request.Context(), id, tenantID)
	if err != nil {
		utils.RespondWithInternalError(c, err, "SyncContact")
		return
	}
	if contact == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"})
		return
	}

	sessions, err := cc.sessions.FindAll(c.Request.Context(), tenantID)
	if err != nil {
		utils.RespondWithInternalError(c, err, "SyncContact")
		return
	}
	var session *domain.ChannelSession
	for i := range sessions {
		if sessions[i].Status == "CONNECTED" {
			session = &sessions[i]
			break
		}
	}
	if session == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "No connected WhatsApp session available"})
		return
	}

	// izapia's picture lookup is a quick synchronous HTTP call (unlike
	// engine-go, which only has an async AMQP command consumed by whatsmeow)
	// -- run it here and persist directly, instead of publishing to a
	// routing key izapia never consumes (the previous bug: 202 Accepted,
	// nothing happens).
	if session.EngineType == "izapia" {
		if cc.izapiaProvider == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "izapia provider not configured"})
			return
		}
		whatsapp, err := cc.sessions.FindByIDDetail(c.Request.Context(), session.ID, tenantID)
		if err != nil || whatsapp == nil {
			utils.RespondWithInternalError(c, err, "SyncContact")
			return
		}
		url := cc.izapiaProvider.GetContactPictureURL(c.Request.Context(), *whatsapp, contact.Number)
		if url != "" && url != contact.ProfilePicUrl {
			if err := cc.contactRepo.Update(c.Request.Context(), contact, map[string]interface{}{"profilePicUrl": url}); err != nil {
				utils.RespondWithInternalError(c, err, "SyncContact")
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"message": "Contact synced", "profilePicUrl": url})
		return
	}

	command := map[string]interface{}{
		"id":        uuid.New().String(),
		"timestamp": time.Now().UnixMilli(),
		"tenantId":  tenantID.String(),
		"type":      "contact.sync",
		"payload": map[string]interface{}{
			"sessionId": fmt.Sprintf("%d", session.ID),
			"number":    contact.Number,
		},
	}
	routingKey := fmt.Sprintf("wbot.%s.%d.contact.sync", tenantID.String(), session.ID)
	if err := cc.publisher.PublishCommand(routingKey, command); err != nil {
		utils.RespondWithInternalError(c, err, "SyncContact")
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"message": "Contact sync requested"})
}
