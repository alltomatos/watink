package controllers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

// normalizeProxyAssignment enforces the proxyMode invariant and verifies the
// referenced proxy/group belongs to the tenant. Returns normalized
// (mode, proxyId, proxyGroupId):
//   - "none"   → (none, nil, nil) — stray ids dropped
//   - "single" → requires a proxyId resolving under tenantID
//   - "group"  → requires a proxyGroupId resolving under tenantID; proxyId is
//     left nil (the actual pick happens at session start in composeProxyURL)
func (wc *WhatsappController) normalizeProxyAssignment(db *gorm.DB, tenantID interface{}, mode string, proxyID, proxyGroupID *int) (string, *int, *int, error) {
	switch mode {
	case "single":
		if proxyID == nil {
			return "", nil, nil, fmt.Errorf("proxyId é obrigatório quando proxyMode é 'single'")
		}
		var p models.Proxy
		if err := db.Session(&gorm.Session{NewDB: true}).
			Where(`id = ? AND "tenantId" = ?`, *proxyID, tenantID).First(&p).Error; err != nil {
			return "", nil, nil, fmt.Errorf("proxy não encontrado para este tenant")
		}
		return "single", proxyID, nil, nil
	case "group":
		if proxyGroupID == nil {
			return "", nil, nil, fmt.Errorf("proxyGroupId é obrigatório quando proxyMode é 'group'")
		}
		var g models.ProxyGroup
		if err := db.Session(&gorm.Session{NewDB: true}).
			Where(`id = ? AND "tenantId" = ?`, *proxyGroupID, tenantID).First(&g).Error; err != nil {
			return "", nil, nil, fmt.Errorf("grupo de proxy não encontrado para este tenant")
		}
		return "group", nil, proxyGroupID, nil
	default:
		return "none", nil, nil, nil
	}
}

// connectionGroupOwnedByTenant validates an optional connectionGroupId belongs
// to the tenant. nil (no group) is always valid.
func (wc *WhatsappController) connectionGroupOwnedByTenant(db *gorm.DB, tenantID interface{}, id *int) bool {
	if id == nil {
		return true
	}
	var g models.ConnectionGroup
	return db.Session(&gorm.Session{NewDB: true}).
		Where(`id = ? AND "tenantId" = ?`, *id, tenantID).First(&g).Error == nil
}

type WhatsappController struct {
	sessionRepo    domain.ChannelSessionRepository
	planLimitSvc   domain.PlanLimitServiceInterface
	broadcast      domain.Broadcaster
	sessionService *services.WhatsAppSessionService
}

func NewWhatsappController(sr domain.ChannelSessionRepository, planLimitSvc domain.PlanLimitServiceInterface, broadcast domain.Broadcaster, sessionService *services.WhatsAppSessionService) *WhatsappController {
	return &WhatsappController{
		sessionRepo:    sr,
		planLimitSvc:   planLimitSvc,
		broadcast:      domain.BroadcastOrNop(broadcast),
		sessionService: sessionService,
	}
}

// @Summary      Listar conexões WhatsApp
// @Tags         whatsapp
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Security     BearerAuth
// @Router       /whatsapp [get]
func (wc *WhatsappController) ListWhatsapps(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}

	whatsapps, err := wc.sessionRepo.FindAll(c.Request.Context(), tenantID)
	if err != nil {
		utils.RespondWithInternalError(c, err, "ListWhatsapps")
		return
	}

	c.JSON(http.StatusOK, whatsapps)
}

// @Summary      Criar conexão WhatsApp
// @Tags         whatsapp
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados da conexão"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /whatsapp [post]
func (wc *WhatsappController) CreateWhatsapp(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}

	if err := wc.planLimitSvc.CheckLimit(tenantID, "connections"); err != nil {
		respondPlanLimitError(c, err, "Connection limit reached for this plan")
		return
	}

	var input domain.ChannelSession
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	if _, err := utils.ValidateStringField(input.Name, "name", 255); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(input.Number, "number", 50); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(input.ProfilePicUrl, "profilePicUrl", 2048); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(input.GreetingMessage, "greetingMessage", 2000); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(input.FarewellMessage, "farewellMessage", 2000); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.TenantID = tenantID
	if input.Status == "" {
		input.Status = "DISCONNECTED"
	}

	mode, pid, pgid, perr := wc.normalizeProxyAssignment(db, tenantID, input.ProxyMode, input.ProxyID, input.ProxyGroupID)
	if perr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": perr.Error()})
		return
	}
	input.ProxyMode = mode
	input.ProxyID = pid
	input.ProxyGroupID = pgid
	if !wc.connectionGroupOwnedByTenant(db, tenantID, input.ConnectionGroupID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "grupo de conexões não encontrado para este tenant"})
		return
	}

	if input.IsDefault {
		if err := wc.sessionRepo.ResetDefaultFlag(c.Request.Context(), tenantID); err != nil {
			utils.RespondWithInternalError(c, err, "ResetDefaultFlag")
			return
		}
	}

	if err := wc.sessionRepo.Create(c.Request.Context(), &input); err != nil {
		utils.RespondWithInternalError(c, err, "CreateWhatsapp")
		return
	}

	c.JSON(http.StatusOK, input)
}

// @Summary      Atualizar conexão WhatsApp
// @Tags         whatsapp
// @Accept       json
// @Produce      json
// @Param        id    path      int                     true  "ID da conexão"
// @Param        body  body      map[string]interface{}  true  "Campos a atualizar"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /whatsapp/{id} [put]
func (wc *WhatsappController) UpdateWhatsapp(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))

	whatsapp, err := wc.sessionRepo.FindByID(c.Request.Context(), id, tenantID)
	if err != nil || whatsapp == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "WhatsApp connection not found or access denied"})
		return
	}

	// PUT é PARCIAL por design (ex.: atribuir só o proxy, sem mandar o resto).
	// Bind duplo: struct (validação/valores) + map cru (quais chaves vieram de
	// fato no JSON). Sem o raw map, todo campo ausente vira zero-value no
	// struct e SOBRESCREVE o valor existente no banco com vazio — bug
	// reproduzido em produção (number/greetingMessage/farewellMessage/
	// profilePicUrl/syncPeriod zerados ao atribuir um proxy pela UI).
	var input domain.ChannelSession
	if err := c.ShouldBindBodyWith(&input, binding.JSON); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	var raw map[string]interface{}
	_ = c.ShouldBindBodyWith(&raw, binding.JSON) // mesmo body, cacheado pelo Gin

	if _, sent := raw["name"]; sent {
		if _, err := utils.ValidateStringField(input.Name, "name", 255); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	if _, sent := raw["number"]; sent {
		if _, err := utils.ValidateStringField(input.Number, "number", 50); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	if _, sent := raw["profilePicUrl"]; sent {
		if _, err := utils.ValidateStringField(input.ProfilePicUrl, "profilePicUrl", 2048); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	if _, sent := raw["greetingMessage"]; sent {
		if _, err := utils.ValidateStringField(input.GreetingMessage, "greetingMessage", 2000); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	if _, sent := raw["farewellMessage"]; sent {
		if _, err := utils.ValidateStringField(input.FarewellMessage, "farewellMessage", 2000); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	if input.IsDefault {
		if err := wc.sessionRepo.ResetDefaultFlag(c.Request.Context(), tenantID); err != nil {
			utils.RespondWithInternalError(c, err, "ResetDefaultFlag")
			return
		}
	}

	fields := map[string]interface{}{}
	for _, f := range []struct {
		key string
		val interface{}
	}{
		{"session", input.Session}, {"qrcode", input.Qrcode}, {"status", input.Status},
		{"battery", input.Battery}, {"plugged", input.Plugged}, {"name", input.Name},
		{"isDefault", input.IsDefault}, {"retries", input.Retries},
		{"greetingMessage", input.GreetingMessage}, {"farewellMessage", input.FarewellMessage},
		{"syncHistory", input.SyncHistory}, {"syncPeriod", input.SyncPeriod},
		{"number", input.Number}, {"profilePicUrl", input.ProfilePicUrl},
		{"keepAlive", input.KeepAlive}, {"engineType", input.EngineType},
	} {
		if _, sent := raw[f.key]; sent {
			fields[f.key] = f.val
		}
	}

	// Proxy: só toca os 3 campos juntos quando proxyMode veio no payload —
	// senão um PUT que não fala de proxy acabaria zerando o proxy atual.
	if _, sent := raw["proxyMode"]; sent {
		proxyModeN, proxyIDN, proxyGroupIDN, perr := wc.normalizeProxyAssignment(db, tenantID, input.ProxyMode, input.ProxyID, input.ProxyGroupID)
		if perr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": perr.Error()})
			return
		}
		fields["proxyMode"] = proxyModeN
		fields["proxyId"] = proxyIDN
		fields["proxyGroupId"] = proxyGroupIDN
	}
	if _, sent := raw["connectionGroupId"]; sent {
		if !wc.connectionGroupOwnedByTenant(db, tenantID, input.ConnectionGroupID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "grupo de conexões não encontrado para este tenant"})
			return
		}
		fields["connectionGroupId"] = input.ConnectionGroupID
	}

	if len(fields) == 0 {
		updated, _ := wc.sessionRepo.FindByID(c.Request.Context(), id, tenantID)
		c.JSON(http.StatusOK, updated)
		return
	}

	if err := wc.sessionRepo.Update(c.Request.Context(), whatsapp, fields); err != nil {
		utils.RespondWithInternalError(c, err, "UpdateWhatsapp")
		return
	}

	updated, err := wc.sessionRepo.FindByID(c.Request.Context(), id, tenantID)
	if err != nil || updated == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "WhatsApp connection not found or access denied"})
		return
	}

	c.JSON(http.StatusOK, updated)
}
