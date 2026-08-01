package plugins

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// AssistantController manages the "Assistentes de IA" plugin's core entity.
// Only CRUD lives here — no runtime dispatch (see docs/agents/assistants.md,
// ADR 0027; runtime is delegated to the synthetic Flow + assistant_executor,
// implemented in a later issue).
type AssistantController struct{}

func NewAssistantController() *AssistantController { return &AssistantController{} }

func toAssistantResponse(a models.Assistant) gin.H {
	return gin.H{
		"id":                         a.ID,
		"tenantId":                   a.TenantID,
		"name":                       a.Name,
		"description":                a.Description,
		"whatsappId":                 a.WhatsAppID,
		"allowMultipleOnConnection":  a.AllowMultipleOnConnection,
		"mode":                       a.Mode,
		"config":                     a.Config,
		"triggerType":                a.TriggerType,
		"triggerOperator":            a.TriggerOperator,
		"triggerValue":               a.TriggerValue,
		"sessionExpiryMinutes":       a.SessionExpiryMinutes,
		"typingDelayMs":              a.TypingDelayMs,
		"debounceSeconds":            a.DebounceSeconds,
		"endKeyword":                 a.EndKeyword,
		"expiryMessage":              a.ExpiryMessage,
		"closingMessage":             a.ClosingMessage,
		"stopOnHumanReply":           a.StopOnHumanReply,
		"ignoreGroups":               a.IgnoreGroups,
		"active":                     a.Active,
		"createdAt":                  a.CreatedAt,
		"updatedAt":                  a.UpdatedAt,
	}
}

// List returns the tenant's Assistants.
func (ac *AssistantController) List(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	var assistants []models.Assistant
	if err := db.Where(`"tenantId" = ?`, tenantID).Order("id DESC").Find(&assistants).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListAssistants")
		return
	}
	resp := make([]gin.H, len(assistants))
	for i := range assistants {
		resp[i] = toAssistantResponse(assistants[i])
	}
	c.JSON(http.StatusOK, resp)
}

// Get returns a single Assistant of the tenant.
func (ac *AssistantController) Get(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var a models.Assistant
	if err := db.Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&a).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assistant não encontrado"})
		return
	}
	c.JSON(http.StatusOK, toAssistantResponse(a))
}

type assistantInput struct {
	Name                       string          `json:"name"`
	Description                string          `json:"description"`
	WhatsAppID                 *int            `json:"whatsappId"`
	AllowMultipleOnConnection  bool            `json:"allowMultipleOnConnection"`
	Mode                       string          `json:"mode"`
	Config                     json.RawMessage `json:"config"`
	TriggerType                string          `json:"triggerType"`
	TriggerOperator            string          `json:"triggerOperator"`
	TriggerValue               string          `json:"triggerValue"`
	SessionExpiryMinutes       *int            `json:"sessionExpiryMinutes"`
	TypingDelayMs              *int            `json:"typingDelayMs"`
	DebounceSeconds            *int            `json:"debounceSeconds"`
	EndKeyword                 *string         `json:"endKeyword"`
	ExpiryMessage               *string         `json:"expiryMessage"`
	ClosingMessage              *string         `json:"closingMessage"`
	StopOnHumanReply            *bool           `json:"stopOnHumanReply"`
	IgnoreGroups                 *bool           `json:"ignoreGroups"`
	Active                       *bool           `json:"active"`
}

func validateAssistantStrings(c *gin.Context, in assistantInput) bool {
	for _, f := range []struct {
		v     string
		name  string
		limit int
	}{
		{in.Name, "name", 120},
		{in.Description, "description", 1000},
	} {
		if _, err := utils.ValidateStringField(f.v, f.name, f.limit); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return false
		}
	}
	return true
}

// validateAssistantConfig decodes in.Config against the struct matching
// in.Mode — never trust the raw JSON blob without validating it against the
// Mode first (docs/agents/assistants.md).
func validateAssistantConfig(mode string, raw json.RawMessage) error {
	if !models.ValidAssistantModes[mode] {
		return errors.New("mode inválido: use pipeline, flow, persona ou router")
	}
	if mode == models.AssistantModeRouter {
		// Router mode has no Config — its options live in AssistantRouterOptions.
		return nil
	}
	if len(raw) == 0 {
		return errors.New("config é obrigatório para este modo")
	}
	switch mode {
	case models.AssistantModePipeline:
		var cfg models.AssistantPipelineConfig
		if err := json.Unmarshal(raw, &cfg); err != nil {
			return errors.New("config inválido para o modo pipeline")
		}
		if cfg.PipelineID == 0 {
			return errors.New("config.pipelineId é obrigatório")
		}
		if cfg.RespondsAfterProactive && !models.ValidRagFallbackBehaviors[cfg.RagFallbackBehavior] {
			return errors.New("config.ragFallbackBehavior inválido")
		}
	case models.AssistantModeFlow:
		var cfg models.AssistantFlowConfig
		if err := json.Unmarshal(raw, &cfg); err != nil {
			return errors.New("config inválido para o modo flow")
		}
		if cfg.FlowID == 0 {
			return errors.New("config.flowId é obrigatório")
		}
	case models.AssistantModePersona:
		var cfg models.AssistantPersonaConfig
		if err := json.Unmarshal(raw, &cfg); err != nil {
			return errors.New("config inválido para o modo persona")
		}
		if cfg.AiGatewayID == 0 {
			return errors.New("config.aiGatewayId é obrigatório")
		}
		if !models.ValidRagFallbackBehaviors[cfg.RagFallbackBehavior] {
			return errors.New("config.ragFallbackBehavior inválido")
		}
	}
	return nil
}

// assertConnectionAvailable enforces the "one active Assistant per
// connection" default rule with a transactional lock (SELECT ... FOR UPDATE)
// to avoid a race between two concurrent creations targeting the same
// connection. Skipped when the connection is unset (nil = any connection) or
// AllowMultipleOnConnection=true. excludeID lets Update ignore itself.
func assertConnectionAvailable(tx *gorm.DB, tenantID interface{}, whatsappID *int, allowMultiple bool, active bool, excludeID int) error {
	if whatsappID == nil || allowMultiple || !active {
		return nil
	}
	var count int64
	err := tx.Model(&models.Assistant{}).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Where(`"tenantId" = ? AND "whatsappId" = ? AND active = true AND "allowMultipleOnConnection" = false AND id <> ?`,
			tenantID, *whatsappID, excludeID).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count > 0 {
		return errors.New("já existe um Assistant ativo nesta conexão — ative 'permitir múltiplos assistentes' para adicionar outro")
	}
	return nil
}

// Create inserts a new Assistant.
func (ac *AssistantController) Create(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	var in assistantInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if !validateAssistantStrings(c, in) {
		return
	}
	if err := validateAssistantConfig(in.Mode, in.Config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	active := true
	if in.Active != nil {
		active = *in.Active
	}
	stopOnHumanReply := true
	if in.StopOnHumanReply != nil {
		stopOnHumanReply = *in.StopOnHumanReply
	}
	ignoreGroups := true
	if in.IgnoreGroups != nil {
		ignoreGroups = *in.IgnoreGroups
	}
	triggerType := in.TriggerType
	if triggerType == "" {
		triggerType = "any"
	}

	a := models.Assistant{
		TenantID: tenantID, Name: in.Name, Description: in.Description,
		WhatsAppID: in.WhatsAppID, AllowMultipleOnConnection: in.AllowMultipleOnConnection,
		Mode: in.Mode, Config: datatypes.JSON(in.Config),
		TriggerType: triggerType, TriggerOperator: in.TriggerOperator, TriggerValue: in.TriggerValue,
		SessionExpiryMinutes: in.SessionExpiryMinutes, TypingDelayMs: in.TypingDelayMs,
		DebounceSeconds: in.DebounceSeconds, EndKeyword: in.EndKeyword,
		ExpiryMessage: in.ExpiryMessage, ClosingMessage: in.ClosingMessage,
		StopOnHumanReply: stopOnHumanReply, IgnoreGroups: ignoreGroups, Active: active,
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := assertConnectionAvailable(tx, tenantID, in.WhatsAppID, in.AllowMultipleOnConnection, active, 0); err != nil {
			return err
		}
		return tx.Create(&a).Error
	})
	if err != nil {
		if err.Error() == "já existe um Assistant ativo nesta conexão — ative 'permitir múltiplos assistentes' para adicionar outro" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		utils.RespondWithInternalError(c, err, "CreateAssistant")
		return
	}
	c.JSON(http.StatusOK, toAssistantResponse(a))
}

// Update edits an Assistant.
func (ac *AssistantController) Update(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var existing models.Assistant
	if err := db.Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&existing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assistant não encontrado"})
		return
	}
	var in assistantInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if !validateAssistantStrings(c, in) {
		return
	}
	if err := validateAssistantConfig(in.Mode, in.Config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	active := existing.Active
	if in.Active != nil {
		active = *in.Active
	}
	stopOnHumanReply := existing.StopOnHumanReply
	if in.StopOnHumanReply != nil {
		stopOnHumanReply = *in.StopOnHumanReply
	}
	ignoreGroups := existing.IgnoreGroups
	if in.IgnoreGroups != nil {
		ignoreGroups = *in.IgnoreGroups
	}

	fields := map[string]interface{}{
		"name": in.Name, "description": in.Description,
		"whatsappId": in.WhatsAppID, "allowMultipleOnConnection": in.AllowMultipleOnConnection,
		"mode": in.Mode, "config": datatypes.JSON(in.Config),
		"triggerType": in.TriggerType, "triggerOperator": in.TriggerOperator, "triggerValue": in.TriggerValue,
		"sessionExpiryMinutes": in.SessionExpiryMinutes, "typingDelayMs": in.TypingDelayMs,
		"debounceSeconds": in.DebounceSeconds, "endKeyword": in.EndKeyword,
		"expiryMessage": in.ExpiryMessage, "closingMessage": in.ClosingMessage,
		"stopOnHumanReply": stopOnHumanReply, "ignoreGroups": ignoreGroups, "active": active,
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := assertConnectionAvailable(tx, tenantID, in.WhatsAppID, in.AllowMultipleOnConnection, active, id); err != nil {
			return err
		}
		return tx.Model(&models.Assistant{}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).Updates(fields).Error
	})
	if err != nil {
		if err.Error() == "já existe um Assistant ativo nesta conexão — ative 'permitir múltiplos assistentes' para adicionar outro" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		utils.RespondWithInternalError(c, err, "UpdateAssistant")
		return
	}
	_ = db.Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&existing).Error
	c.JSON(http.StatusOK, toAssistantResponse(existing))
}

// Delete removes an Assistant and any router options where it is the router.
func (ac *AssistantController) Delete(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where(`"routerAssistantId" = ? AND "tenantId" = ?`, id, tenantID).Delete(&models.AssistantRouterOption{}).Error; err != nil {
			return err
		}
		return tx.Where(`id = ? AND "tenantId" = ?`, id, tenantID).Delete(&models.Assistant{}).Error
	})
	if err != nil {
		utils.RespondWithInternalError(c, err, "DeleteAssistant")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Assistant removido"})
}

// Duplicate clones an Assistant (new record, always inactive to avoid
// tripping the one-active-per-connection rule automatically).
func (ac *AssistantController) Duplicate(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var existing models.Assistant
	if err := db.Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&existing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assistant não encontrado"})
		return
	}

	clone := existing
	clone.ID = 0
	clone.Name = existing.Name + " (cópia)"
	clone.Active = false
	if err := db.Create(&clone).Error; err != nil {
		utils.RespondWithInternalError(c, err, "DuplicateAssistant")
		return
	}
	c.JSON(http.StatusOK, toAssistantResponse(clone))
}
