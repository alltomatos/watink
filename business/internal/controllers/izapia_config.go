package controllers

import (
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/infrastructure/izapia"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// IzapiaConfigController manages the tenant's izapia API key
// (models.IzapiaConfig), consumed by infrastructure/izapia.Provider. Scoped
// under the "Whatsapps" resource — it exists to power WhatsApp connections
// with EngineType "izapia", same as the Proxy config it sits next to. The API
// base URL is always izapia.DefaultBaseURL (api.izapia.com) — there is no
// configurable URL, only the API key.
type IzapiaConfigController struct{}

func NewIzapiaConfigController() *IzapiaConfigController {
	return &IzapiaConfigController{}
}

type izapiaConfigResponse struct {
	BaseURL   string `json:"baseUrl"`
	HasApiKey bool   `json:"hasApiKey"`
}

// @Summary      Consultar credencial izapia do tenant
// @Tags         izapia
// @Produce      json
// @Success      200  {object}  izapiaConfigResponse
// @Security     BearerAuth
// @Router       /izapia-config [get]
func (ic *IzapiaConfigController) Get(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}

	var cfg models.IzapiaConfig
	if err := db.Where(`"tenantId" = ?`, tenantID).First(&cfg).Error; err != nil {
		c.JSON(http.StatusOK, izapiaConfigResponse{BaseURL: izapia.DefaultBaseURL, HasApiKey: false})
		return
	}
	c.JSON(http.StatusOK, izapiaConfigResponse{BaseURL: izapia.DefaultBaseURL, HasApiKey: cfg.HasApiKey()})
}

// @Summary      Salvar a API key izapia do tenant
// @Description  Só recebe a API key — a base URL é sempre api.izapia.com.
// @Tags         izapia
// @Accept       json
// @Produce      json
// @Success      200  {object}  izapiaConfigResponse
// @Security     BearerAuth
// @Router       /izapia-config [put]
func (ic *IzapiaConfigController) Save(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}

	var input struct {
		ApiKey string `json:"apiKey"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if input.ApiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "apiKey é obrigatório"})
		return
	}

	enc, err := cryptobox.Encrypt(input.ApiKey)
	if err != nil {
		utils.RespondWithInternalError(c, err, "SaveIzapiaConfig")
		return
	}

	var cfg models.IzapiaConfig
	found := db.Session(&gorm.Session{NewDB: true}).Where(`"tenantId" = ?`, tenantID).First(&cfg).Error == nil
	if found {
		err = db.Session(&gorm.Session{NewDB: true}).
			Where(`"tenantId" = ?`, tenantID).
			Update("apiKeyEnc", enc).Error
	} else {
		cfg = models.IzapiaConfig{TenantID: tenantID, ApiKeyEnc: enc}
		err = db.Session(&gorm.Session{NewDB: true}).Create(&cfg).Error
	}
	if err != nil {
		utils.RespondWithInternalError(c, err, "SaveIzapiaConfig")
		return
	}

	c.JSON(http.StatusOK, izapiaConfigResponse{BaseURL: izapia.DefaultBaseURL, HasApiKey: true})
}
