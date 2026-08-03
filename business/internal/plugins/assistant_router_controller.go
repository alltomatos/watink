package plugins

import (
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AssistantRouterController manages the menu options of an Assistant in
// "router" mode. TargetAssistant must be on the SAME connection as the
// router (WhatsAppID must match) — enforced here, not by the DB.
type AssistantRouterController struct{}

func NewAssistantRouterController() *AssistantRouterController { return &AssistantRouterController{} }

func toRouterOptionResponse(o models.AssistantRouterOption) gin.H {
	return gin.H{
		"id":                o.ID,
		"routerAssistantId": o.RouterAssistantID,
		"label":             o.Label,
		"order":             o.Order,
		"targetAssistantId": o.TargetAssistantID,
		"createdAt":         o.CreatedAt,
		"updatedAt":         o.UpdatedAt,
	}
}

// List returns the router options of a given Assistant.
func (rc *AssistantRouterController) List(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	assistantID, _ := strconv.Atoi(c.Param("id"))
	var options []models.AssistantRouterOption
	if err := db.Where(`"routerAssistantId" = ? AND "tenantId" = ?`, assistantID, tenantID).
		Order(`"order" ASC`).Find(&options).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListAssistantRouterOptions")
		return
	}
	resp := make([]gin.H, len(options))
	for i := range options {
		resp[i] = toRouterOptionResponse(options[i])
	}
	c.JSON(http.StatusOK, resp)
}

type routerOptionInput struct {
	Label             string `json:"label"`
	Order             int    `json:"order"`
	TargetAssistantID int    `json:"targetAssistantId"`
}

// sameConnection validates that router and target Assistants belong to the
// tenant and share the same WhatsAppID (nil connections never "match" —
// router mode requires an explicit connection on both sides).
func sameConnection(db *gorm.DB, tenantID interface{}, routerAssistantID, targetAssistantID int) (bool, error) {
	var router, target models.Assistant
	// Session(NewDB:true) nas DUAS chamadas: `db` chega aqui já usado por um
	// caller (Update() faz um First(&existing) antes de chamar
	// sameConnection) e/ou seria reusado de novo aqui entre router/target —
	// qualquer uma das duas reutilizações vaza o Statement da query anterior
	// pra próxima (mesma classe de bug corrigida em AssistantController.Update
	// — reproduzido ao vivo em homolog também aqui, via "Adicionar" opção de
	// roteador). Isolar as duas torna esta função segura pra qualquer db de
	// entrada, usado ou não.
	if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, routerAssistantID, tenantID).First(&router).Error; err != nil {
		return false, err
	}
	if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, targetAssistantID, tenantID).First(&target).Error; err != nil {
		return false, err
	}
	if router.WhatsAppID == nil || target.WhatsAppID == nil {
		return false, nil
	}
	return *router.WhatsAppID == *target.WhatsAppID, nil
}

// Create adds a router option to an Assistant in "router" mode.
func (rc *AssistantRouterController) Create(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	assistantID, _ := strconv.Atoi(c.Param("id"))
	var in routerOptionInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if _, err := utils.ValidateStringField(in.Label, "label", 120); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if in.TargetAssistantID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "targetAssistantId é obrigatório"})
		return
	}
	ok2, err := sameConnection(db, tenantID, assistantID, in.TargetAssistantID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "router ou target assistant não encontrado"})
		return
	}
	if !ok2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "o assistant de destino precisa estar na mesma conexão do roteador"})
		return
	}

	opt := models.AssistantRouterOption{
		RouterAssistantID: assistantID, Label: in.Label, Order: in.Order,
		TargetAssistantID: in.TargetAssistantID, TenantID: tenantID,
	}
	if err := db.Create(&opt).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreateAssistantRouterOption")
		return
	}
	c.JSON(http.StatusOK, toRouterOptionResponse(opt))
}

// Update edits a router option.
func (rc *AssistantRouterController) Update(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	assistantID, _ := strconv.Atoi(c.Param("id"))
	optionID, _ := strconv.Atoi(c.Param("optionId"))
	var existing models.AssistantRouterOption
	if err := db.Where(`id = ? AND "routerAssistantId" = ? AND "tenantId" = ?`, optionID, assistantID, tenantID).
		First(&existing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "opção de menu não encontrada"})
		return
	}
	var in routerOptionInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if _, err := utils.ValidateStringField(in.Label, "label", 120); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if in.TargetAssistantID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "targetAssistantId é obrigatório"})
		return
	}
	sameConn, err := sameConnection(db, tenantID, assistantID, in.TargetAssistantID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "router ou target assistant não encontrado"})
		return
	}
	if !sameConn {
		c.JSON(http.StatusBadRequest, gin.H{"error": "o assistant de destino precisa estar na mesma conexão do roteador"})
		return
	}

	fields := map[string]interface{}{"label": in.Label, "order": in.Order, "targetAssistantId": in.TargetAssistantID}
	if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.AssistantRouterOption{}).
		Where(`id = ? AND "tenantId" = ?`, optionID, tenantID).Updates(fields).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateAssistantRouterOption")
		return
	}
	_ = db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, optionID, tenantID).First(&existing).Error
	c.JSON(http.StatusOK, toRouterOptionResponse(existing))
}

// Delete removes a router option.
func (rc *AssistantRouterController) Delete(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	assistantID, _ := strconv.Atoi(c.Param("id"))
	optionID, _ := strconv.Atoi(c.Param("optionId"))
	res := db.Session(&gorm.Session{NewDB: true}).
		Where(`id = ? AND "routerAssistantId" = ? AND "tenantId" = ?`, optionID, assistantID, tenantID).
		Delete(&models.AssistantRouterOption{})
	if res.Error != nil {
		utils.RespondWithInternalError(c, res.Error, "DeleteAssistantRouterOption")
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "opção de menu não encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Opção removida"})
}
