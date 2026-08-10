package controllers

import (
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// QueueController encapsulates queue operations with RLS-scoped DB from auth middleware.
// All queries are automatically tenant-scoped via auth.GetScoped.
type QueueController struct{}

func NewQueueController() *QueueController {
	return &QueueController{}
}

// @Summary      Listar filas
// @Tags         queues
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Security     BearerAuth
// @Router       /queue [get]
func (qc *QueueController) ListQueues(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Queues")
	if !ok {
		return
	}

	var queues []models.Queue
	if err := db.Where("\"tenantId\" = ?", tenantID).
		Preload("Whatsapps").
		Order("COALESCE(\"parentId\", id), \"parentId\" IS NOT NULL, name ASC").
		Find(&queues).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListQueues")
		return
	}

	c.JSON(200, queues)
}

// @Summary      Detalhar fila
// @Tags         queues
// @Produce      json
// @Param        queueId  path      int  true  "ID da fila"
// @Success      200      {object}  map[string]interface{}
// @Failure      404      {object}  map[string]string
// @Security     BearerAuth
// @Router       /queue/{queueId} [get]
func (qc *QueueController) ShowQueue(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Queues")
	if !ok {
		return
	}
	id := c.Param("queueId")

	var queue models.Queue
	if err := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).
		First(&queue).Error; err != nil {
		c.JSON(404, gin.H{"error": "Queue not found"})
		return
	}

	c.JSON(200, queue)
}

// @Summary      Criar fila
// @Tags         queues
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados da fila"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /queue [post]
func (qc *QueueController) CreateQueue(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Queues")
	if !ok {
		return
	}

	limitService := services.NewPlanLimitService(db)
	if err := limitService.CheckLimit(tenantID, "queues"); err != nil {
		respondPlanLimitError(c, err, "Plan limit reached for queues")
		return
	}

	var input models.Queue
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	if _, err := utils.ValidateStringField(input.Name, "name", 100); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(input.Color, "color", 50); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(input.GreetingMessage, "greetingMessage", 2000); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	input.TenantID = tenantID
	if err := db.Create(&input).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreateQueue")
		return
	}

	c.JSON(200, input)
}

// @Summary      Atualizar fila
// @Tags         queues
// @Accept       json
// @Produce      json
// @Param        queueId  path      int                     true  "ID da fila"
// @Param        body     body      map[string]interface{}  true  "Campos a atualizar"
// @Success      200      {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /queue/{queueId} [put]
func (qc *QueueController) UpdateQueue(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Queues")
	if !ok {
		return
	}
	id := c.Param("queueId")

	var queue models.Queue
	if err := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).First(&queue).Error; err != nil {
		c.JSON(404, gin.H{"error": "Queue not found"})
		return
	}

	if err := c.ShouldBindJSON(&queue); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	if _, err := utils.ValidateStringField(queue.Name, "name", 100); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(queue.Color, "color", 50); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(queue.GreetingMessage, "greetingMessage", 2000); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if err := db.Session(&gorm.Session{NewDB: true}).Save(&queue).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateQueue")
		return
	}

	c.JSON(200, queue)
}

// @Summary      Remover fila
// @Tags         queues
// @Produce      json
// @Param        queueId  path      int  true  "ID da fila"
// @Success      200      {object}  map[string]string
// @Failure      404      {object}  map[string]string
// @Security     BearerAuth
// @Router       /queue/{queueId} [delete]
func (qc *QueueController) DeleteQueue(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Queues")
	if !ok {
		return
	}
	id := c.Param("queueId")

	result := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).Delete(&models.Queue{})
	if result.Error != nil {
		utils.RespondWithInternalError(c, result.Error, "DeleteQueue")
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(404, gin.H{"error": "Queue not found"})
		return
	}

	c.JSON(200, gin.H{"message": "Queue deleted successfully"})
}
