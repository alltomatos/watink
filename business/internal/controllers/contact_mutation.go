package controllers

import (
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
)

// @Summary      Criar contato
// @Tags         contacts
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados do contato"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /contacts [post]
func (cc *ContactController) CreateContact(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Contacts")
	if !ok {
		return
	}

	var input struct {
		Name          string `json:"name"`
		Number        string `json:"number"`
		ProfilePicUrl string `json:"profilePicUrl"`
		Email         string `json:"email"`
		IsGroup       bool   `json:"isGroup"`
		WalletUserID  *int   `json:"walletUserId"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	name, err := utils.ValidateStringField(input.Name, "name", 255)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	number, err := utils.ValidateStringField(input.Number, "number", 50)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	profilePicUrl, err := utils.ValidateStringField(input.ProfilePicUrl, "profilePicUrl", 2048)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	email, err := utils.ValidateStringField(input.Email, "email", 255)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	contact := &domain.Contact{
		Name:          name,
		Number:        number,
		ProfilePicUrl: profilePicUrl,
		Email:         email,
		IsGroup:       input.IsGroup,
		WalletUserID:  input.WalletUserID,
		TenantID:      tenantID,
	}

	if err := cc.contactRepo.Create(c.Request.Context(), contact); err != nil {
		utils.RespondWithInternalError(c, err, "CreateContact")
		return
	}

	cc.broadcast.EmitToTenantRoom(tenantID.String(), "contact", gin.H{"action": "create", "contact": contact})

	c.JSON(http.StatusOK, contact)
}

// @Summary      Atualizar contato
// @Tags         contacts
// @Accept       json
// @Produce      json
// @Param        contactId  path      int                     true  "ID do contato"
// @Param        body       body      map[string]interface{}  true  "Campos a atualizar"
// @Success      200        {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /contacts/{contactId} [put]
func (cc *ContactController) UpdateContact(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Contacts")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("contactId"))

	var input struct {
		Name          string `json:"name"`
		Number        string `json:"number"`
		ProfilePicUrl string `json:"profilePicUrl"`
		Email         string `json:"email"`
		WalletUserID  *int   `json:"walletUserId"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	contact, err := cc.contactRepo.FindByID(c.Request.Context(), id, tenantID)
	if err != nil || contact == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"})
		return
	}

	fields := map[string]interface{}{}
	if input.Name != "" {
		name, err := utils.ValidateStringField(input.Name, "name", 255)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		fields["name"] = name
	}
	if input.Number != "" {
		number, err := utils.ValidateStringField(input.Number, "number", 50)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		fields["number"] = number
	}
	if input.ProfilePicUrl != "" {
		profilePicUrl, err := utils.ValidateStringField(input.ProfilePicUrl, "profilePicUrl", 2048)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		fields["profilePicUrl"] = profilePicUrl
	}
	if input.Email != "" {
		email, err := utils.ValidateStringField(input.Email, "email", 255)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		fields["email"] = email
	}
	if input.WalletUserID != nil {
		fields["walletUserId"] = input.WalletUserID
	}

	if err := cc.contactRepo.Update(c.Request.Context(), contact, fields); err != nil {
		utils.RespondWithInternalError(c, err, "UpdateContact")
		return
	}

	if updated, err := cc.contactRepo.FindByID(c.Request.Context(), id, tenantID); err == nil && updated != nil {
		contact = updated
	}
	cc.broadcast.EmitToTenantRoom(tenantID.String(), "contact", gin.H{"action": "update", "contact": contact})

	c.JSON(http.StatusOK, contact)
}

// @Summary      Remover contato
// @Tags         contacts
// @Produce      json
// @Param        contactId  path      int  true  "ID do contato"
// @Success      200        {object}  map[string]string
// @Security     BearerAuth
// @Router       /contacts/{contactId} [delete]
func (cc *ContactController) DeleteContact(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Contacts")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("contactId"))

	if err := cc.contactRepo.Delete(c.Request.Context(), id, tenantID); err != nil {
		utils.RespondWithInternalError(c, err, "DeleteContact")
		return
	}

	cc.broadcast.EmitToTenantRoom(tenantID.String(), "contact", gin.H{"action": "delete", "contactId": strconv.Itoa(id)})

	c.JSON(http.StatusOK, gin.H{"message": "Contact deleted successfully"})
}

// @Summary      Excluir contatos selecionados
// @Tags         contacts
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Lista de IDs a excluir"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /contacts/bulk-delete [post]
func (cc *ContactController) BulkDeleteContacts(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Contacts")
	if !ok {
		return
	}

	var input struct {
		IDs []int `json:"ids"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids is required and must not be empty"})
		return
	}

	deleted, err := cc.contactRepo.BulkDelete(c.Request.Context(), input.IDs, tenantID)
	if err != nil {
		utils.RespondWithInternalError(c, err, "BulkDeleteContacts")
		return
	}

	cc.broadcast.EmitToTenantRoom(tenantID.String(), "contact", gin.H{"action": "bulk-delete", "contactIds": input.IDs})

	c.JSON(http.StatusOK, gin.H{"deleted": deleted})
}

// @Summary      Excluir todos os contatos do tenant
// @Tags         contacts
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /contacts/all [delete]
func (cc *ContactController) DeleteAllContacts(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Contacts")
	if !ok {
		return
	}

	deleted, err := cc.contactRepo.DeleteAll(c.Request.Context(), tenantID)
	if err != nil {
		utils.RespondWithInternalError(c, err, "DeleteAllContacts")
		return
	}

	cc.broadcast.EmitToTenantRoom(tenantID.String(), "contact", gin.H{"action": "delete-all"})

	c.JSON(http.StatusOK, gin.H{"deleted": deleted})
}
