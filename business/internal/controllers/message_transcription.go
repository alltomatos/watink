package controllers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/aiclient"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TranscribeAudio transcribes a single audio message on demand — the operator
// clicks "Transcrever áudio" below the bubble, this runs synchronously and
// returns the text. It is never triggered automatically on receipt, and the
// result is only ever persisted/broadcast to the Watink UI: this handler
// never calls flow.SendAssistantText/Media nor publishes any wbot.* send
// command, so the transcription can never reach WhatsApp.
// @Summary      Transcrever mensagem de áudio
// @Tags         messages
// @Produce      json
// @Param        messageId  path      string  true  "ID da mensagem"
// @Success      200        {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /messages/{messageId}/transcribe [post]
func (mc *MessageController) TranscribeAudio(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Messages")
	if !ok {
		return
	}

	messageID := c.Param("messageId")
	var msg models.Message
	if err := db.Preload("Ticket").Where("id = ? AND \"tenantId\" = ?", messageID, tenantID).First(&msg).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}
	if msg.MediaType != "audio" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "mensagem não é um áudio"})
		return
	}
	if msg.Transcription != nil && *msg.Transcription != "" {
		c.JSON(http.StatusOK, gin.H{"success": true, "transcription": *msg.Transcription})
		return
	}
	if mc.db == nil || mc.mediaWaiter == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "transcrição não disponível neste ambiente"})
		return
	}

	enabled, err := mc.settingValue(tenantID, "audioTranscriptionEnabled")
	if err != nil || enabled != "true" {
		c.JSON(http.StatusConflict, gin.H{"error": "transcrição de áudio não habilitada — configure em Configurações → Agente de IA"})
		return
	}
	gatewayIDStr, err := mc.settingValue(tenantID, "audioTranscriptionGatewayId")
	if err != nil || gatewayIDStr == "" {
		c.JSON(http.StatusConflict, gin.H{"error": "nenhum Gateway de IA configurado para transcrição"})
		return
	}
	gatewayID, err := strconv.Atoi(gatewayIDStr)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "gateway de transcrição configurado é inválido"})
		return
	}
	modelName, _ := mc.settingValue(tenantID, "audioTranscriptionModel")

	var gateway models.AiGateway
	if err := mc.db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, gatewayID, tenantID).First(&gateway).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "AiGateway configurado para transcrição não encontrado"})
		return
	}
	if !gateway.HasApiKey() {
		c.JSON(http.StatusConflict, gin.H{"error": "AiGateway sem API Key configurada"})
		return
	}
	if modelName == "" && gateway.TranscriptionModel != nil {
		modelName = *gateway.TranscriptionModel
	}
	if modelName == "" {
		c.JSON(http.StatusConflict, gin.H{"error": "nenhum modelo de transcrição configurado"})
		return
	}
	apiKey, err := cryptobox.Decrypt(gateway.ApiKeyEnc)
	if err != nil {
		utils.RespondWithInternalError(c, err, "TranscribeAudio")
		return
	}

	audio, mimeType, err := mc.resolveAudioBytes(c.Request.Context(), &msg, tenantID)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}

	baseURL := ""
	if gateway.BaseURL != nil {
		baseURL = *gateway.BaseURL
	}
	text, err := aiclient.Transcribe(aiclient.Config{
		Provider: gateway.Provider, Model: gateway.Model, APIKey: apiKey, BaseURL: baseURL,
	}, modelName, audio, "audio"+extForAudioMime(mimeType))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "transcrição falhou: " + err.Error()})
		return
	}

	if err := mc.db.Session(&gorm.Session{NewDB: true}).Model(&models.Message{}).Where("id = ?", msg.ID).Update("transcription", text).Error; err != nil {
		utils.RespondWithInternalError(c, err, "TranscribeAudio")
		return
	}
	msg.Transcription = &text
	mc.broadcast.EmitToRoom("/", "chat:"+strconv.Itoa(msg.TicketID), "appMessage", map[string]interface{}{"action": "update", "message": msg})

	c.JSON(http.StatusOK, gin.H{"success": true, "transcription": text})
}

// settingValue reads a single tenant-scoped Setting.Value, empty string if
// unset — same generic key/value table Configurações já usa para "Habilitar
// IA Global" etc (setting.go), no schema change needed for the new keys.
func (mc *MessageController) settingValue(tenantID uuid.UUID, key string) (string, error) {
	var setting models.Setting
	err := mc.db.Session(&gorm.Session{NewDB: true}).Where("key = ? AND \"tenantId\" = ?", key, tenantID).First(&setting).Error
	if err != nil {
		return "", err
	}
	return setting.Value, nil
}

// resolveAudioBytes returns the raw audio bytes for msg. If the media was
// already downloaded (operator played it, or a prior transcribe attempt
// triggered the download), it's read straight from local disk — no engine
// round-trip. Otherwise it falls back to the same on-demand download the
// "baixar"/assistant-audio paths use: publish media.download and block on
// mediawait.Waiter for the correlated result.
func (mc *MessageController) resolveAudioBytes(ctx context.Context, msg *models.Message, tenantID uuid.UUID) ([]byte, string, error) {
	var data struct {
		Mimetype   string `json:"mimetype"`
		MediaProto string `json:"mediaProto"`
	}
	_ = json.Unmarshal([]byte(msg.DataJson), &data)

	if msg.MediaUrl != "" {
		if raw, err := os.ReadFile(strings.TrimPrefix(msg.MediaUrl, "/")); err == nil {
			return raw, data.Mimetype, nil
		}
	}

	if data.MediaProto == "" {
		return nil, "", fmt.Errorf("áudio ainda não baixado e sem proto de mídia disponível")
	}
	if msg.Ticket.ID == 0 {
		return nil, "", fmt.Errorf("ticket não encontrado para esta mensagem")
	}

	command := map[string]interface{}{
		"id":        uuid.New().String(),
		"timestamp": time.Now().UnixMilli(),
		"tenantId":  tenantID.String(),
		"type":      "media.download",
		"payload": map[string]interface{}{
			"sessionId":  msg.Ticket.WhatsappID,
			"messageId":  msg.ID,
			"mediaType":  msg.MediaType,
			"mediaProto": data.MediaProto,
		},
	}
	routingKey := fmt.Sprintf("wbot.%s.%d.media.download", tenantID.String(), msg.Ticket.WhatsappID)
	if err := mc.rabbit.PublishCommand(routingKey, command); err != nil {
		return nil, "", fmt.Errorf("falha ao solicitar download do áudio: %w", err)
	}

	waitCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()
	res, err := mc.mediaWaiter.Await(waitCtx, msg.ID)
	if err != nil {
		return nil, "", fmt.Errorf("timeout aguardando o áudio: %w", err)
	}
	if res.Err != "" {
		return nil, "", fmt.Errorf("engine falhou ao baixar o áudio: %s", res.Err)
	}
	if res.MediaData == "" {
		return nil, "", fmt.Errorf("áudio baixado veio vazio")
	}
	raw, err := base64.StdEncoding.DecodeString(res.MediaData)
	if err != nil {
		return nil, "", fmt.Errorf("áudio em base64 inválido: %w", err)
	}
	mimeType := data.Mimetype
	if res.MimeType != "" {
		mimeType = res.MimeType
	}
	return raw, mimeType, nil
}

// extForAudioMime is a tiny local helper — Transcribe just needs a plausible
// filename (the API infers format from bytes/Content-Type, not the name).
// Mirrors plugins/assistant_audio.go's extForMime, duplicated rather than
// imported: controllers (core) must not depend on internal/plugins.
func extForAudioMime(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "audio/ogg"):
		return ".ogg"
	case strings.HasPrefix(mimeType, "audio/mp4"):
		return ".m4a"
	case strings.HasPrefix(mimeType, "audio/mpeg"):
		return ".mp3"
	default:
		return ".bin"
	}
}
