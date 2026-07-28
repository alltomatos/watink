package izapia

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"gorm.io/gorm"
)

// mediaTypeToKind maps Watink's internal mediaType (see
// controllers.mimeTypeToMediaType) to izapia's messages/media "kind" enum.
var mediaTypeToKind = map[string]string{
	"image":    "image",
	"video":    "video",
	"audio":    "audio",
	"document": "document",
}

// Provider implements domain.WhatsAppEngine for the "izapia" engineType. It
// resolves the tenant's izapia credentials (models.IzapiaConfig) per call — no
// caching, so a credential rotation takes effect immediately.
type Provider struct {
	db        *gorm.DB
	broadcast domain.Broadcaster
}

// New wires the izapia provider via constructor DI.
func New(db *gorm.DB, broadcast domain.Broadcaster) *Provider {
	return &Provider{db: db, broadcast: broadcast}
}

var _ domain.WhatsAppEngine = (*Provider)(nil)

// clientFor resolves the izapia HTTP client for a connection's tenant.
func (p *Provider) clientFor(w models.Whatsapp) (*Client, error) {
	var cfg models.IzapiaConfig
	if err := p.db.Where(`"tenantId" = ?`, w.TenantID).First(&cfg).Error; err != nil {
		return nil, utils.NewFriendlyError(http.StatusUnprocessableEntity,
			"Configure a API key da izapia em Configurações > izapia antes de conectar.",
			fmt.Errorf("izapia: credencial não configurada para o tenant (Configurações > Izapia): %w", err))
	}
	if !cfg.HasApiKey() {
		return nil, utils.NewFriendlyError(http.StatusUnprocessableEntity,
			"Configure a API key da izapia em Configurações > izapia antes de conectar.",
			fmt.Errorf("izapia: API key não configurada (Configurações > Izapia)"))
	}
	apiKey, err := cryptobox.Decrypt(cfg.ApiKeyEnc)
	if err != nil {
		return nil, fmt.Errorf("izapia: falha ao descriptografar a API key: %w", err)
	}
	// Base URL é sempre a oficial (api.izapia.com) — o tenant configura só a
	// API key; não há campo de URL customizável na UI.
	return NewClient(DefaultBaseURL, apiKey), nil
}

// webhookBaseURL reads the tenant's public backend URL (Setting "backendUrl",
// set during onboarding) used to build the izapia webhook target.
func (p *Provider) webhookBaseURL(w models.Whatsapp) (string, error) {
	var s models.Setting
	if err := p.db.Where(`"tenantId" = ? AND "key" = ?`, w.TenantID, "backendUrl").First(&s).Error; err != nil {
		return "", utils.NewFriendlyError(http.StatusUnprocessableEntity,
			"URL pública do sistema não configurada para este tenant. Contate o suporte.",
			fmt.Errorf("izapia: backendUrl não configurada para o tenant (Configurações): %w", err))
	}
	if s.Value == "" {
		return "", utils.NewFriendlyError(http.StatusUnprocessableEntity,
			"URL pública do sistema não configurada para este tenant. Contate o suporte.",
			fmt.Errorf("izapia: backendUrl vazia para o tenant (Configurações)"))
	}
	return s.Value, nil
}

// absoluteMediaURL turns a media URL local ao business (ex.
// "/public/media/<hash>.jpg", devolvida por mediastore.SaveMediaReader) numa
// URL absoluta buscável pela izapia. Diferente do engine-go/whatsmeow — que
// lê o arquivo direto do volume compartilhado quando o path não é absoluto
// (engine-go send_helpers.go) — a izapia é um SaaS externo (api.izapia.com) e
// só consegue buscar mídia via HTTP(S) público. URLs já absolutas (mídia
// hospedada em S3/CDN externo) passam intactas.
func (p *Provider) absoluteMediaURL(w models.Whatsapp, mediaURL string) (string, error) {
	if mediaURL == "" || strings.HasPrefix(mediaURL, "http://") || strings.HasPrefix(mediaURL, "https://") {
		return mediaURL, nil
	}
	baseURL, err := p.webhookBaseURL(w)
	if err != nil {
		return "", err
	}
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(mediaURL, "/"), nil
}

// ensureSession lazily creates the izapia session (and webhook) for a
// connection on first start, persisting the assigned id/secret.
func (p *Provider) ensureSession(ctx context.Context, client *Client, w *models.Whatsapp) (string, error) {
	if w.IzapiaSessionID != nil && *w.IzapiaSessionID != "" {
		return *w.IzapiaSessionID, nil
	}

	sid, err := client.CreateSession(ctx, w.Name, "")
	if err != nil {
		wrapped := fmt.Errorf("izapia: criar sessão: %w", err)
		if IsQuotaExceeded(err) {
			return "", utils.NewFriendlyError(http.StatusTooManyRequests,
				"Limite de conexões WhatsApp do seu plano izapia foi atingido. Libere uma conexão (deslogue uma sessão não usada) ou fale com o suporte pra aumentar o plano.",
				wrapped)
		}
		return "", wrapped
	}

	secret, err := randomHex(32)
	if err != nil {
		return "", fmt.Errorf("izapia: gerar secret do webhook: %w", err)
	}
	secretEnc, err := cryptobox.Encrypt(secret)
	if err != nil {
		return "", fmt.Errorf("izapia: cifrar secret do webhook: %w", err)
	}

	baseURL, err := p.webhookBaseURL(*w)
	if err != nil {
		return "", err
	}
	webhookURL := fmt.Sprintf("%s/webhooks/izapia/%d", baseURL, w.ID)
	if err := client.SetWebhook(ctx, sid, webhookURL, secret, nil); err != nil {
		wrapped := fmt.Errorf("izapia: configurar webhook: %w", err)
		if IsQuotaExceeded(err) {
			return "", utils.NewFriendlyError(http.StatusTooManyRequests,
				"Limite de webhooks do seu plano izapia foi atingido. Fale com o suporte pra aumentar o plano.",
				wrapped)
		}
		return "", wrapped
	}

	if err := p.db.Model(&models.Whatsapp{}).
		Where(`id = ? AND "tenantId" = ?`, w.ID, w.TenantID).
		Updates(map[string]interface{}{"izapiaSessionId": sid, "izapiaWebhookSecretEnc": secretEnc}).Error; err != nil {
		return "", fmt.Errorf("izapia: persistir sessão: %w", err)
	}
	w.IzapiaSessionID = &sid
	w.IzapiaWebhookSecretEnc = &secretEnc
	return sid, nil
}

// StartSession creates the izapia session (if not yet created) and starts
// QR or phone-code pairing, persisting the result into the same
// qrcode/status columns the whatsmeow flow uses so the frontend needs no
// changes (see event_listener_session.go handleQrCode/handlePairingCode).
func (p *Provider) StartSession(ctx context.Context, w models.Whatsapp, usePairingCode bool, phoneNumber string, force bool) error {
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}

	sid, err := p.ensureSession(ctx, client, &w)
	if err != nil {
		return err
	}

	if usePairingCode {
		pairingCode, err := client.PairPhone(ctx, sid, phoneNumber)
		if err != nil {
			return fmt.Errorf("izapia: pareamento por telefone: %w", err)
		}
		if err := p.db.Model(&models.Whatsapp{}).
			Where(`id = ? AND "tenantId" = ?`, w.ID, w.TenantID).
			Update("status", "QRCODE").Error; err != nil {
			return err
		}
		// Mirrors event_listener_session.go handlePairingCode's broadcast contract
		// so the frontend needs no changes for the izapia engine.
		if p.broadcast != nil {
			p.broadcast.EmitToTenantRoom(w.TenantID.String(), "whatsappSession", map[string]interface{}{
				"action": "update",
				"session": map[string]interface{}{
					"id": w.ID, "status": "QRCODE", "pairingCode": pairingCode,
				},
			})
		}
		return nil
	}

	pair, err := client.Pair(ctx, sid)
	if err != nil {
		return fmt.Errorf("izapia: pareamento por QR code: %w", err)
	}
	if err := p.db.Model(&models.Whatsapp{}).
		Where(`id = ? AND "tenantId" = ?`, w.ID, w.TenantID).
		Updates(map[string]interface{}{"qrcode": pair.Code, "status": "QRCODE"}).Error; err != nil {
		return err
	}
	// Mirrors event_listener_session.go handleQrCode's broadcast contract so
	// the frontend (QrCodePanel/useWhatsAppSSE) needs no changes.
	if p.broadcast != nil {
		p.broadcast.EmitToTenantRoom(w.TenantID.String(), "whatsappSession", map[string]interface{}{
			"action":  "update",
			"session": map[string]interface{}{"id": w.ID, "qrcode": pair.Code, "status": "QRCODE"},
		})
	}
	return nil
}

// StopSession logs the session out on the WhatsApp side (soft — the izapia
// session row is preserved and a later StartSession re-pairs it).
func (p *Provider) StopSession(ctx context.Context, w models.Whatsapp) error {
	if w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return nil
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	if err := client.Logout(ctx, *w.IzapiaSessionID); err != nil {
		if IsNotFound(err) {
			// Sessão já não existe do lado da izapia (ex.: expirou sem
			// parear) -- nada a limpar remotamente, trata como sucesso.
			return nil
		}
		return err
	}
	return nil
}

// DeleteSession logs the session out. The izapia data-plane API exposes no
// hard-delete operation (session rows are management-plane only); a logout
// is the strongest disconnect available here.
func (p *Provider) DeleteSession(ctx context.Context, w models.Whatsapp) error {
	return p.StopSession(ctx, w)
}

func (p *Provider) SendText(ctx context.Context, w models.Whatsapp, to, messageID, body string) error {
	if w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return fmt.Errorf("izapia: conexão %d sem sessão izapia ativa", w.ID)
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	_, err = client.SendText(ctx, *w.IzapiaSessionID, to, body)
	return err
}

func (p *Provider) SendMedia(ctx context.Context, w models.Whatsapp, to, messageID, mediaType, mediaURL, mimeType string) error {
	if w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return fmt.Errorf("izapia: conexão %d sem sessão izapia ativa", w.ID)
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	absURL, err := p.absoluteMediaURL(w, mediaURL)
	if err != nil {
		return err
	}
	kind, ok := mediaTypeToKind[mediaType]
	if !ok {
		kind = "document"
	}
	_, err = client.SendMedia(ctx, *w.IzapiaSessionID, to, kind, absURL, mimeType, "")
	return err
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
