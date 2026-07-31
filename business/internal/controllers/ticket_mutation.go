package controllers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/application/usecases"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// @Summary      Atualizar ticket
// @Tags         tickets
// @Accept       json
// @Produce      json
// @Param        ticketId  path      int                     true  "ID do ticket"
// @Param        body      body      map[string]interface{}  true  "Campos a atualizar"
// @Success      200       {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /tickets/{ticketId} [put]
func (tc *TicketController) UpdateTicket(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Tickets")
	if !ok {
		return
	}
	id := c.Param("ticketId")

	var ticket models.Ticket
	if err := db.Where("id = ?", id).First(&ticket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found or access denied"})
		return
	}

	var input struct {
		Status  string `json:"status"`
		UserID  *int   `json:"userId"`
		QueueID *int   `json:"queueId"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if _, err := utils.ValidateStringField(input.Status, "status", 50); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updateInput := usecases.UpdateTicketInput{
		TicketID: ticket.ID,
		TenantID: tenantID,
		Status:   input.Status,
		UserID:   input.UserID,
		QueueID:  input.QueueID,
	}

	if userID, exists := c.Get("userId"); exists {
		userIDInt := int(userID.(float64))
		updateInput.PerformedBy = &userIDInt
	}

	updatedTicket, err := tc.updateTicket.Execute(c.Request.Context(), updateInput)
	if err != nil {
		utils.RespondWithInternalError(c, err, "UpdateTicket")
		return
	}

	tc.broadcast.EmitToTenantRoom(tenantID.String(), "ticket", gin.H{"action": "update", "ticket": updatedTicket})
	c.JSON(http.StatusOK, updatedTicket)
}

// @Summary      Excluir ticket
// @Description  Remove definitivamente a conversa e suas mensagens. Deals vinculados via ticketId são preservados (só desvinculados, nunca apagados) — o funil de vendas não depende do ticket existir.
// @Tags         tickets
// @Produce      json
// @Param        ticketId  path      int  true  "ID do ticket"
// @Success      200       {object}  map[string]string
// @Failure      404       {object}  map[string]string
// @Security     BearerAuth
// @Router       /tickets/{ticketId} [delete]
func (tc *TicketController) DeleteTicket(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Tickets")
	if !ok {
		return
	}
	id := c.Param("ticketId")

	var ticket models.Ticket
	if err := db.Where("id = ?", id).First(&ticket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found or access denied"})
		return
	}

	err := db.Session(&gorm.Session{NewDB: true}).Transaction(func(tx *gorm.DB) error {
		// Deals não têm pra onde migrar quando o ticket some, mas o funil de
		// vendas não depende do ticket — desvincula (ticketId nullable) em vez
		// de apagar, ao contrário de Messages/ConversationEmbeddings que só
		// existem em função do ticket.
		if err := tx.Exec(`UPDATE "Deals" SET "ticketId" = NULL WHERE "ticketId" = ? AND "tenantId" = ?`, ticket.ID, tenantID).Error; err != nil {
			return err
		}
		if err := tx.Exec(`DELETE FROM "ConversationEmbeddings" WHERE "ticketId" = ? AND "tenantId" = ?`, ticket.ID, tenantID).Error; err != nil {
			return err
		}
		if err := tx.Exec(`DELETE FROM "EntityTags" WHERE "entityType" = 'ticket' AND "entityId" = ? AND "tenantId" = ?`, ticket.ID, tenantID).Error; err != nil {
			return err
		}
		if err := tx.Exec(`DELETE FROM "Messages" WHERE "ticketId" = ? AND "tenantId" = ?`, ticket.ID, tenantID).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND \"tenantId\" = ?", ticket.ID, tenantID).Delete(&models.Ticket{}).Error
	})
	if err != nil {
		utils.RespondWithInternalError(c, err, "DeleteTicket")
		return
	}

	tc.broadcast.EmitToTenantRoom(tenantID.String(), "ticket", gin.H{"action": "delete", "ticketId": ticket.ID})
	c.JSON(http.StatusOK, gin.H{"message": "Ticket deleted"})
}

// @Summary      Recuperar histórico da conversa
// @Description  Solicita ao WhatsApp mensagens anteriores e as insere no ticket sem reabri-lo
// @Tags         tickets
// @Accept       json
// @Produce      json
// @Param        ticketId  path      int                     true  "ID do ticket"
// @Param        body      body      map[string]interface{}  false  "range: 1d|2d|7d|30d|all"
// @Success      202       {object}  map[string]string
// @Failure      404       {object}  map[string]string
// @Security     BearerAuth
// @Router       /tickets/{ticketId}/history/recover [post]
func (tc *TicketController) RecoverHistory(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Tickets")
	if !ok {
		return
	}
	ticketID, err := strconv.Atoi(c.Param("ticketId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ticket id"})
		return
	}

	var input struct {
		Range string `json:"range"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if _, err := utils.ValidateStringField(input.Range, "range", 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var ticket models.Ticket
	if err := db.Where("id = ?", ticketID).Preload("Contact").First(&ticket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}
	if ticket.Contact.Number == "" {
		c.JSON(http.StatusConflict, gin.H{"error": "Ticket contact has no WhatsApp number"})
		return
	}

	chatJID := ticket.Contact.Number + "@s.whatsapp.net"
	if ticket.IsGroup {
		chatJID = ticket.Contact.Number + "@g.us"
	}

	payload := map[string]interface{}{
		"chatJid":         chatJID,
		"ticketId":        ticket.ID,
		"cutoffTimestamp": historyCutoff(input.Range, time.Now()),
	}

	if oldest, err := tc.messages.FindOldestByTicket(c.Request.Context(), ticket.ID, tenantID); err == nil && oldest != nil {
		payload["oldestMsgId"] = oldest.ID
		payload["oldestMsgFromMe"] = oldest.FromMe
		payload["oldestMsgTimestamp"] = oldest.CreatedAt.Unix()
	}

	command := map[string]interface{}{
		"id":        uuid.New().String(),
		"timestamp": time.Now().UnixMilli(),
		"tenantId":  tenantID.String(),
		"type":      "history.recover",
		"payload":   payload,
	}
	routingKey := fmt.Sprintf("wbot.%s.%d.history.recover", tenantID.String(), ticket.WhatsappID)
	if err := tc.publisher.PublishCommand(routingKey, command); err != nil {
		utils.RespondWithInternalError(c, err, "RecoverHistory")
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"message": "History recovery requested"})
}
