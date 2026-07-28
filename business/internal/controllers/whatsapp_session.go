package controllers

import (
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
)

type SessionController struct {
	sessionRepo    domain.ChannelSessionRepository
	broadcast      domain.Broadcaster
	sessionService *services.WhatsAppSessionService
}

func NewSessionController(sr domain.ChannelSessionRepository, broadcast domain.Broadcaster, sessionService *services.WhatsAppSessionService) *SessionController {
	return &SessionController{
		sessionRepo:    sr,
		broadcast:      domain.BroadcastOrNop(broadcast),
		sessionService: sessionService,
	}
}

// @Summary      Iniciar sessão WhatsApp
// @Tags         whatsapp-sessions
// @Produce      json
// @Param        whatsappId  path      int  true  "ID da conexão"
// @Success      200         {object}  map[string]string
// @Security     BearerAuth
// @Router       /whatsappsession/{whatsappId} [post]
// @Router       /whatsappsession/{whatsappId} [put]
func (sc *SessionController) StartSession(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}
	whatsappID, ok2 := utils.ParseIntParam(c, "whatsappId")
	if !ok2 {
		return
	}

	session, err := sc.sessionRepo.FindByID(c.Request.Context(), whatsappID, tenantID)
	if err != nil || session == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "WhatsApp connection not found or access denied"})
		return
	}

	var req struct {
		UsePairingCode bool   `json:"usePairingCode"`
		PhoneNumber    string `json:"phoneNumber"`
	}
	_ = c.ShouldBindJSON(&req)

	if err := sc.sessionService.StartWhatsAppSession(channelSessionToModel(session), req.UsePairingCode, req.PhoneNumber, true); err != nil {
		utils.RespondWithInternalError(c, err, "StartWhatsAppSession")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Starting session."})
}

// @Summary      Parar sessão WhatsApp
// @Tags         whatsapp-sessions
// @Produce      json
// @Param        whatsappId  path      int  true  "ID da conexão"
// @Success      200         {object}  map[string]string
// @Security     BearerAuth
// @Router       /whatsappsession/{whatsappId} [delete]
func (sc *SessionController) StopSession(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}
	whatsappID, ok2 := utils.ParseIntParam(c, "whatsappId")
	if !ok2 {
		return
	}

	session, err := sc.sessionRepo.FindByID(c.Request.Context(), whatsappID, tenantID)
	if err != nil || session == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "WhatsApp connection not found or access denied"})
		return
	}

	if err := sc.sessionRepo.Update(c.Request.Context(), session, map[string]interface{}{"status": "DISCONNECTED"}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update session status"})
		return
	}

	if err := sc.sessionService.StopWhatsAppSession(channelSessionToModel(session)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to stop session"})
		return
	}

	sc.broadcast.EmitToTenantRoom(tenantID.String(), "whatsappSession", map[string]interface{}{
		"action":  "update",
		"session": session,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Session disconnected."})
}

// @Summary      Reiniciar todas as sessões
// @Tags         whatsapp-sessions
// @Produce      json
// @Success      200  {object}  map[string]string
// @Security     BearerAuth
// @Router       /whatsappsession/all [post]
func (sc *SessionController) RestartAllSessions(c *gin.Context) {
	_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
	if !ok {
		return
	}

	whatsapps, err := sc.sessionRepo.FindAll(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch WhatsApp connections"})
		return
	}

	for i := range whatsapps {
		_ = sc.sessionService.StartWhatsAppSession(channelSessionToModel(&whatsapps[i]), false, "", true)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Restarting all sessions."})
}

func channelSessionToModel(s *domain.ChannelSession) models.Whatsapp {
	return models.Whatsapp{
		ID:                s.ID,
		Session:           s.Session,
		Qrcode:            s.Qrcode,
		Status:            s.Status,
		Battery:           s.Battery,
		Plugged:           s.Plugged,
		Name:              s.Name,
		IsDefault:         s.IsDefault,
		Retries:           s.Retries,
		GreetingMessage:   s.GreetingMessage,
		FarewellMessage:   s.FarewellMessage,
		TenantID:          s.TenantID,
		SyncHistory:       s.SyncHistory,
		SyncPeriod:        s.SyncPeriod,
		Number:            s.Number,
		ProfilePicUrl:     s.ProfilePicUrl,
		KeepAlive:         s.KeepAlive,
		CreatedAt:         s.CreatedAt,
		UpdatedAt:         s.UpdatedAt,
		FirstConnection:   s.FirstConnection,
		EngineType:        s.EngineType,
		ProxyMode:         s.ProxyMode,
		ProxyID:           s.ProxyID,
		ProxyGroupID:      s.ProxyGroupID,
		ConnectionGroupID: s.ConnectionGroupID,
		Wid:               s.Wid,

		IzapiaSessionID:        s.IzapiaSessionID,
		IzapiaWebhookSecretEnc: s.IzapiaWebhookSecretEnc,
	}
}
