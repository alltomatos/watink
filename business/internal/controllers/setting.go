package controllers

import (
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
)

// SettingController encapsulates setting operations.
// settingRepo: used for public (pre-auth) setting lookups.
// Tenant-scoped mutations use auth.GetScoped for RLS isolation.
type SettingController struct {
	settingRepo domain.SettingRepository
	broadcast   domain.Broadcaster
}

func NewSettingController(settingRepo domain.SettingRepository, broadcast domain.Broadcaster) *SettingController {
	return &SettingController{settingRepo: settingRepo, broadcast: domain.BroadcastOrNop(broadcast)}
}

// @Summary      Listar configurações
// @Tags         settings
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Security     BearerAuth
// @Router       /settings [get]
func (sc *SettingController) ListSettings(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Settings")
	if !ok {
		return
	}

	var settings []models.Setting
	if err := db.Where("\"tenantId\" = ?", tenantID).Find(&settings).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListSettings")
		return
	}

	c.JSON(http.StatusOK, settings)
}

// GetPublicSettings uses root DB because it runs BEFORE authentication (public route).
// The first tenant's public branding keys are returned for the login page.
// @Summary      Configurações públicas
// @Description  Retorna configurações visíveis sem autenticação (nome do tenant, logo)
// @Tags         settings
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /public-settings [get]
func (sc *SettingController) GetPublicSettings(c *gin.Context) {
	publicKeys := []string{"systemLogo", "login_backgroundImage", "login_layout", "systemFavicon"}

	settings, err := sc.settingRepo.FindPublicSettings(c.Request.Context(), publicKeys)
	if err != nil {
		utils.RespondWithInternalError(c, err, "GetPublicSettings")
		return
	}

	c.JSON(http.StatusOK, settings)
}

// @Summary      Atualizar configuração
// @Tags         settings
// @Accept       json
// @Produce      json
// @Param        key   path      string                  true  "Chave da configuração"
// @Param        body  body      map[string]interface{}  true  "Valor a atualizar"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /settings/{key} [put]
func (sc *SettingController) UpdateSetting(c *gin.Context) {
	db, tenantUUID, ok := auth.GetScoped(c, "Settings")
	if !ok {
		return
	}
	key := c.Param("key")
	if _, err := utils.ValidateStringField(key, "key", 100); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Value é *string (não binding:"required") para distinguir campo AUSENTE
	// (erro) de string vazia EXPLÍCITA (usada de propósito para remover uma
	// imagem/logo já salva via trash icon na UI) — um `string` simples com
	// binding:"required" rejeitava as duas situações da mesma forma.
	var req struct {
		Value *string `json:"value"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if req.Value == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "field 'value' is required"})
		return
	}

	value, err := utils.ValidateStringField(*req.Value, "value", 65535)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	setting := models.Setting{
		Key:      key,
		TenantID: tenantUUID,
		Value:    value,
	}

	if err := db.Where("key = ? AND \"tenantId\" = ?", key, tenantUUID).Assign(models.Setting{Value: value}).FirstOrCreate(&setting).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateSetting")
		return
	}

	sc.broadcast.EmitToNamespace("/", "settings", map[string]interface{}{
		"action":  "update",
		"setting": setting,
	})

	c.JSON(http.StatusOK, setting)
}
