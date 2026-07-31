package controllers

import (
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/infrastructure/izapia"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
)

type ContactController struct {
	contactRepo    domain.ContactRepository
	sessions       domain.ChannelSessionRepository
	publisher      domain.CommandPublisher
	broadcast      domain.Broadcaster
	izapiaProvider *izapia.Provider
}

func NewContactController(cr domain.ContactRepository, sessions domain.ChannelSessionRepository, publisher domain.CommandPublisher, broadcast domain.Broadcaster, izapiaProvider *izapia.Provider) *ContactController {
	return &ContactController{contactRepo: cr, sessions: sessions, publisher: publisher, broadcast: domain.BroadcastOrNop(broadcast), izapiaProvider: izapiaProvider}
}

// @Summary      Listar contatos
// @Tags         contacts
// @Produce      json
// @Param        searchParam  query     string  false  "Busca por nome ou número"
// @Success      200          {array}   map[string]interface{}
// @Failure      401          {object}  map[string]string
// @Security     BearerAuth
// @Router       /contacts [get]
func (cc *ContactController) ListContacts(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Contacts")
	if !ok {
		return
	}

	searchParam := c.Query("searchParam")
	contacts, err := cc.contactRepo.Find(c.Request.Context(), tenantID, searchParam)
	if err != nil {
		utils.RespondWithInternalError(c, err, "ListContacts")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"contacts": contacts,
	})
}

// @Summary      Detalhar contato
// @Tags         contacts
// @Produce      json
// @Param        contactId  path      int  true  "ID do contato"
// @Success      200        {object}  map[string]interface{}
// @Failure      404        {object}  map[string]string
// @Security     BearerAuth
// @Router       /contacts/{contactId} [get]
func (cc *ContactController) ShowContact(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Contacts")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("contactId"))

	contact, err := cc.contactRepo.FindByID(c.Request.Context(), id, tenantID)
	if err != nil {
		utils.RespondWithInternalError(c, err, "ShowContact")
		return
	}
	if contact == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"})
		return
	}

	c.JSON(http.StatusOK, contact)
}
