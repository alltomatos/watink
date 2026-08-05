package plugins

import (
	"context"
	"encoding/base64"
	"fmt"
	"strconv"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/aiclient"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"github.com/google/uuid"
)

// mediaDownloadTimeout bounds how long executePersona waits for engine-go to
// download+return an inbound audio before giving up — o download em si
// costuma levar segundos (notas de voz do WhatsApp raramente passam de
// alguns MB), mas é uma chamada de rede real (engine → servidores do
// WhatsApp), então não pode ser instantâneo nem indefinido.
const mediaDownloadTimeout = 25 * time.Second

// resolveAiGatewayCreds loads and decrypts the AiGateway's API key — shared
// by transcription and speech, mirrors AiGatewayController.Test's own
// decrypt step (never logs/returns the raw key beyond this call boundary).
func (r *AssistantRuntime) resolveAiGatewayCreds(tenantID uuid.UUID, aiGatewayID int) (models.AiGateway, string, error) {
	var g models.AiGateway
	if err := r.db.Where(`id = ? AND "tenantId" = ?`, aiGatewayID, tenantID).First(&g).Error; err != nil {
		return g, "", fmt.Errorf("AiGateway não encontrado")
	}
	if !g.HasApiKey() {
		return g, "", fmt.Errorf("AiGateway sem API Key configurada")
	}
	apiKey, err := cryptobox.Decrypt(g.ApiKeyEnc)
	if err != nil {
		return g, "", fmt.Errorf("falha ao descriptografar API Key: %w", err)
	}
	return g, apiKey, nil
}

// transcribeInboundAudio downloads the message.MessageID's audio (publishing
// media.download and awaiting the correlated result via mediawait.Waiter —
// the on-demand download the UI's "baixar" button also triggers, just
// invoked programmatically here) and transcribes it via the Assistant's
// AiGateway. Returns a clear error (never a silent empty string) on any
// failure — the caller (executePersona) turns that into a graceful handoff.
func (r *AssistantRuntime) transcribeInboundAudio(ctx context.Context, st *flow.ExecState, a models.Assistant, aiGatewayID int) (string, error) {
	if r.mediaWaiter == nil || r.publisher == nil {
		return "", fmt.Errorf("download de mídia não disponível neste contexto")
	}
	if st.MessageID == "" || st.Ticket == nil {
		return "", fmt.Errorf("mensagem de áudio sem messageId/ticket")
	}
	if aiGatewayID == 0 {
		return "", fmt.Errorf("sem AiGateway configurado")
	}
	g, apiKey, err := r.resolveAiGatewayCreds(st.TenantID, aiGatewayID)
	if err != nil {
		return "", err
	}
	if g.TranscriptionModel == nil || *g.TranscriptionModel == "" {
		return "", fmt.Errorf("AiGateway %q sem modelo de transcrição configurado", g.Name)
	}

	audio, mimeType, err := r.downloadInboundAudio(ctx, st)
	if err != nil {
		return "", err
	}

	baseURL := ""
	if g.BaseURL != nil {
		baseURL = *g.BaseURL
	}
	text, err := aiclient.Transcribe(aiclient.Config{
		Provider: g.Provider, Model: g.Model, APIKey: apiKey, BaseURL: baseURL,
	}, *g.TranscriptionModel, audio, "audio"+extForMime(mimeType))
	if err != nil {
		return "", fmt.Errorf("transcrição falhou: %w", err)
	}
	return text, nil
}

// downloadInboundAudio publishes the same media.download AMQP command
// message_media.go's HTTP handler does (fire-and-forget from engine-go's
// point of view), then blocks on mediawait.Waiter for the correlated
// message.media event — turning the pipeline's normal async round-trip into
// a bounded synchronous call for this one caller.
func (r *AssistantRuntime) downloadInboundAudio(ctx context.Context, st *flow.ExecState) ([]byte, string, error) {
	command := map[string]interface{}{
		"type": "media.download",
		"payload": map[string]interface{}{
			"sessionId": st.Ticket.WhatsappID,
			"messageId": st.MessageID,
			"mediaType": st.MediaType,
		},
	}
	routingKey := fmt.Sprintf("wbot.%s.%d.media.download", st.TenantID.String(), st.Ticket.WhatsappID)
	if err := r.publisher.PublishCommand(routingKey, command); err != nil {
		return nil, "", fmt.Errorf("falha ao solicitar download do áudio: %w", err)
	}

	waitCtx, cancel := context.WithTimeout(ctx, mediaDownloadTimeout)
	defer cancel()
	res, err := r.mediaWaiter.Await(waitCtx, st.MessageID)
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
	return raw, res.MimeType, nil
}

// sendPersonaReply sends the LLM's text reply, synthesized to a voice note
// when a.RespondsWithAudio is on — falling back to plain text on ANY
// synthesis failure (missing speech model, gateway error, empty audio) so a
// broken TTS config never costs the user the actual answer.
func (r *AssistantRuntime) sendPersonaReply(ctx context.Context, st *flow.ExecState, a models.Assistant, aiGatewayID int, turn int, replyText string) error {
	if !a.RespondsWithAudio {
		return flow.SendAssistantText(ctx, st, "t"+strconv.Itoa(turn), replyText)
	}
	audioB64, mimeType, err := r.synthesizeSpeech(st, aiGatewayID, replyText)
	if err != nil {
		return flow.SendAssistantText(ctx, st, "t"+strconv.Itoa(turn), replyText)
	}
	if err := flow.SendAssistantMedia(ctx, st, "t"+strconv.Itoa(turn), audioB64, "audio", mimeType); err != nil {
		// O envio de mídia em si falhou (não a síntese) — não há mais o que
		// tentar de graça aqui sem reprocessar; propaga como erro real.
		return err
	}
	return nil
}

func (r *AssistantRuntime) synthesizeSpeech(st *flow.ExecState, aiGatewayID int, text string) (audioBase64, mimeType string, err error) {
	if aiGatewayID == 0 {
		return "", "", fmt.Errorf("sem AiGateway configurado")
	}
	g, apiKey, err := r.resolveAiGatewayCreds(st.TenantID, aiGatewayID)
	if err != nil {
		return "", "", err
	}
	if g.SpeechModel == nil || *g.SpeechModel == "" {
		return "", "", fmt.Errorf("AiGateway %q sem modelo de fala configurado", g.Name)
	}
	baseURL := ""
	if g.BaseURL != nil {
		baseURL = *g.BaseURL
	}
	result, err := aiclient.Speech(aiclient.Config{
		Provider: g.Provider, Model: g.Model, APIKey: apiKey, BaseURL: baseURL,
	}, *g.SpeechModel, text, "")
	if err != nil {
		return "", "", err
	}
	if len(result.Audio) == 0 {
		return "", "", fmt.Errorf("síntese devolveu áudio vazio")
	}
	return base64.StdEncoding.EncodeToString(result.Audio), result.MimeType, nil
}

// extForMime is a tiny local helper (Transcribe just needs a plausible
// filename, the API infers format from Content-Type/bytes, not the name) —
// avoids pulling in pkg/mediastore's full MIME table for this one call.
func extForMime(mimeType string) string {
	switch {
	case len(mimeType) >= 9 && mimeType[:9] == "audio/ogg":
		return ".ogg"
	case len(mimeType) >= 9 && mimeType[:9] == "audio/mp4":
		return ".m4a"
	case len(mimeType) >= 10 && mimeType[:10] == "audio/mpeg":
		return ".mp3"
	default:
		return ".bin"
	}
}
