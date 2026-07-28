package controllers

import (
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// proxySummary resolves the human-friendly proxy/proxy-group info for a
// connection's detail view. Never includes the credential — same safety as
// toProxyResponse in proxy.go. Returns nil when proxyMode is "none" or the
// referenced row was deleted (dangling id).
func proxySummary(db *gorm.DB, tenantID interface{}, w *models.Whatsapp) gin.H {
	fresh := db.Session(&gorm.Session{NewDB: true})
	switch w.ProxyMode {
	case "single":
		if w.ProxyID == nil {
			return nil
		}
		var p models.Proxy
		if err := fresh.Where(`id = ? AND "tenantId" = ?`, *w.ProxyID, tenantID).First(&p).Error; err != nil {
			return nil
		}
		return gin.H{
			"mode": "single", "id": p.ID, "label": p.Label,
			"endpoint": p.Scheme + "://" + p.Host + ":" + strconv.Itoa(p.Port),
			"status":   p.Status, "healthy": p.Healthy,
			"city": p.City, "country": p.Country, "countryCode": p.CountryCode,
		}
	case "group":
		if w.ProxyGroupID == nil {
			return nil
		}
		var g models.ProxyGroup
		if err := fresh.Where(`id = ? AND "tenantId" = ?`, *w.ProxyGroupID, tenantID).First(&g).Error; err != nil {
			return nil
		}
		result := gin.H{"mode": "group", "id": g.ID, "name": g.Name, "rotationStrategy": g.RotationStrategy}
		// O pick sticky atual (se houver) ajuda a UI mostrar "usando agora: host:port".
		if w.ProxyID != nil {
			var p models.Proxy
			if err := fresh.Where(`id = ? AND "tenantId" = ?`, *w.ProxyID, tenantID).First(&p).Error; err == nil {
				result["current"] = gin.H{
					"id": p.ID, "endpoint": p.Scheme + "://" + p.Host + ":" + strconv.Itoa(p.Port),
					"city": p.City, "country": p.Country, "countryCode": p.CountryCode,
				}
			}
		}
		return result
	default:
		return nil
	}
}

// @Summary      Detalhar conexão WhatsApp
// @Tags         whatsapp
// @Produce      json
// @Param        id  path      int  true  "ID da conexão"
// @Success      200 {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /whatsapp/{id} [get]
func (wc *WhatsappController) ShowWhatsapp(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))

	// Usa busca enriquecida com relations
	whatsappModel, err := wc.sessionRepo.FindByIDDetail(c.Request.Context(), id, tenantID)
	if err != nil || whatsappModel == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "WhatsApp connection not found or access denied"})
		return
	}

	// Monta resposta enriquecida
	response := map[string]interface{}{
		"id":              whatsappModel.ID,
		"session":         whatsappModel.Session,
		"qrcode":          whatsappModel.Qrcode,
		"status":          whatsappModel.Status,
		"battery":         whatsappModel.Battery,
		"plugged":         whatsappModel.Plugged,
		"name":            whatsappModel.Name,
		"isDefault":       whatsappModel.IsDefault,
		"retries":         whatsappModel.Retries,
		"greetingMessage": whatsappModel.GreetingMessage,
		"farewellMessage": whatsappModel.FarewellMessage,
		"tenantId":        whatsappModel.TenantID,
		"syncHistory":     whatsappModel.SyncHistory,
		"syncPeriod":      whatsappModel.SyncPeriod,
		"number":          whatsappModel.Number,
		"profilePicUrl":   whatsappModel.ProfilePicUrl,
		"keepAlive":       whatsappModel.KeepAlive,
		"createdAt":       whatsappModel.CreatedAt,
		"updatedAt":       whatsappModel.UpdatedAt,
		"firstConnection": whatsappModel.FirstConnection,
		"engineType":      whatsappModel.EngineType,
		"proxyMode":       whatsappModel.ProxyMode,
		"proxyId":         whatsappModel.ProxyID,
		"proxyGroupId":    whatsappModel.ProxyGroupID,
	}

	// Adiciona relations apenas se existirem
	if len(whatsappModel.Queues) > 0 {
		response["queues"] = whatsappModel.Queues
	}
	if ps := proxySummary(db, tenantID, whatsappModel); ps != nil {
		response["proxy"] = ps
	}

	c.JSON(http.StatusOK, response)
}

// @Summary      Remover conexão WhatsApp
// @Tags         whatsapp
// @Produce      json
// @Param        id  path      int  true  "ID da conexão"
// @Success      200 {object}  map[string]string
// @Security     BearerAuth
// @Router       /whatsapp/{id} [delete]
func (wc *WhatsappController) DeleteWhatsapp(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))

	whatsapp, err := wc.sessionRepo.FindByID(c.Request.Context(), id, tenantID)
	if err != nil || whatsapp == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "WhatsApp connection not found or access denied"})
		return
	}

	model := models.Whatsapp{
		ID:              whatsapp.ID,
		Session:         whatsapp.Session,
		Qrcode:          whatsapp.Qrcode,
		Status:          whatsapp.Status,
		Battery:         whatsapp.Battery,
		Plugged:         whatsapp.Plugged,
		Name:            whatsapp.Name,
		IsDefault:       whatsapp.IsDefault,
		Retries:         whatsapp.Retries,
		GreetingMessage: whatsapp.GreetingMessage,
		FarewellMessage: whatsapp.FarewellMessage,
		TenantID:        whatsapp.TenantID,
		SyncHistory:     whatsapp.SyncHistory,
		SyncPeriod:      whatsapp.SyncPeriod,
		Number:          whatsapp.Number,
		ProfilePicUrl:   whatsapp.ProfilePicUrl,
		KeepAlive:       whatsapp.KeepAlive,
		CreatedAt:       whatsapp.CreatedAt,
		UpdatedAt:       whatsapp.UpdatedAt,
		FirstConnection: whatsapp.FirstConnection,
		EngineType:      whatsapp.EngineType,

		IzapiaSessionID:        whatsapp.IzapiaSessionID,
		IzapiaWebhookSecretEnc: whatsapp.IzapiaWebhookSecretEnc,
	}
	if err := wc.sessionService.DeleteWhatsAppSession(model); err != nil {
		utils.RespondWithInternalError(c, err, "DeleteWhatsAppSession")
		return
	}

	if err := wc.sessionRepo.DeleteWithRelations(c.Request.Context(), id, tenantID); err != nil {
		utils.RespondWithInternalError(c, err, "DeleteWithRelations")
		return
	}

	wc.broadcast.EmitToNamespace("/", "whatsapp", gin.H{
		"action":     "delete",
		"whatsappId": whatsapp.ID,
	})

	c.JSON(http.StatusOK, gin.H{"message": "WhatsApp connection deleted"})
}
