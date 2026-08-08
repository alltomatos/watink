package izapia

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"gorm.io/gorm"
)

// picCacheTTL bounds how long a contact-picture URL is trusted before
// GetContactPictureURL hits the izapia API again — mirrors the same
// trade-off as engine-go's in-memory picture cache (avoid one HTTP round
// trip per inbound message), but with an explicit TTL since there is no
// "picture changed" webhook event wired yet to invalidate it eagerly.
const picCacheTTL = 10 * time.Minute

type picCacheEntry struct {
	url       string
	expiresAt time.Time
}

// subscribedWebhookEvents lists exactly the event types
// controllers.IzapiaWebhookController.dispatch handles — explicit rather than
// relying on izapia's server-side default subscription (undocumented, and
// "session.risk" — the ban/throttle signal, épico E-G4 — is opt-in per the
// izapia OpenAPI spec, not guaranteed to be in any default set).
var subscribedWebhookEvents = []string{
	"message.received", "message.pollVote", "message.interactiveReply",
	"message.ack", "usage.message",
	"session.qr", "session.status", "session.connected", "session.disconnected", "session.logged_out",
	"session.risk",
}

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

	picCacheMu sync.Mutex
	picCache   map[string]picCacheEntry
}

// New wires the izapia provider via constructor DI.
func New(db *gorm.DB, broadcast domain.Broadcaster) *Provider {
	return &Provider{db: db, broadcast: broadcast, picCache: make(map[string]picCacheEntry)}
}

var _ domain.WhatsAppEngine = (*Provider)(nil)
var _ domain.PresenceEngine = (*Provider)(nil)

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
	if err := client.SetWebhook(ctx, sid, webhookURL, secret, subscribedWebhookEvents); err != nil {
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

// DeleteSession desprovisiona a sessão na izapia (libera client/lease e
// libera de volta a vaga da quota max_sessions do tenant) — diferente de
// StopSession/Logout, que só muda o status e mantém a vaga ocupada.
func (p *Provider) DeleteSession(ctx context.Context, w models.Whatsapp) error {
	if w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return nil
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	if err := client.DeleteSession(ctx, *w.IzapiaSessionID); err != nil {
		if IsNotFound(err) {
			// Sessão já não existe do lado da izapia -- nada a limpar,
			// trata como sucesso idempotente.
			return nil
		}
		return err
	}
	return nil
}

// SendText returns izapia's OWN message_id, not the requested messageID --
// the izapia API assigns its own id server-side and there is no way to
// force it like whatsmeow's SendRequestExtra (see enginego.Provider).
// Callers that need the real WhatsApp id (e.g. reply correlation) MUST use
// the returned value; the requested messageID is otherwise unused here.
func (p *Provider) SendText(ctx context.Context, w models.Whatsapp, to, messageID, body string) (string, error) {
	if w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return "", fmt.Errorf("izapia: conexão %d sem sessão izapia ativa", w.ID)
	}
	client, err := p.clientFor(w)
	if err != nil {
		return "", err
	}
	return client.SendText(ctx, *w.IzapiaSessionID, to, body)
}

// SendPresence implements domain.PresenceEngine. state is "composing" or
// "paused".
func (p *Provider) SendPresence(ctx context.Context, w models.Whatsapp, to, state string) error {
	if w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return fmt.Errorf("izapia: conexão %d sem sessão izapia ativa", w.ID)
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	return client.SetTyping(ctx, *w.IzapiaSessionID, to, state)
}

// GetContactPictureURL resolves the profile picture URL for a contact/group
// JID on connection w, using an in-memory TTL cache keyed by
// "<connectionID>:<jid>" to avoid one izapia API call per inbound message.
// Errors from the izapia API are logged and swallowed (a missing picture
// must never block message ingestion) — callers get "" on any failure.
func (p *Provider) GetContactPictureURL(ctx context.Context, w models.Whatsapp, jid string) string {
	if jid == "" || w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return ""
	}
	cacheKey := fmt.Sprintf("%d:%s", w.ID, jid)

	p.picCacheMu.Lock()
	if entry, ok := p.picCache[cacheKey]; ok && time.Now().Before(entry.expiresAt) {
		p.picCacheMu.Unlock()
		return entry.url
	}
	p.picCacheMu.Unlock()

	client, err := p.clientFor(w)
	if err != nil {
		log.Printf("[izapia] GetContactPictureURL(%s): client indisponível: %v", cacheKey, err)
		return ""
	}
	url, err := client.GetContactPicture(ctx, *w.IzapiaSessionID, jid)
	if err != nil {
		log.Printf("[izapia] GetContactPictureURL(%s): %v", cacheKey, err)
		return ""
	}

	p.picCacheMu.Lock()
	p.picCache[cacheKey] = picCacheEntry{url: url, expiresAt: time.Now().Add(picCacheTTL)}
	p.picCacheMu.Unlock()
	return url
}

// SendMedia returns izapia's own message_id -- see SendText's doc comment.
func (p *Provider) SendMedia(ctx context.Context, w models.Whatsapp, to, messageID, mediaType, mediaURL, mimeType string) (string, error) {
	if w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return "", fmt.Errorf("izapia: conexão %d sem sessão izapia ativa", w.ID)
	}
	client, err := p.clientFor(w)
	if err != nil {
		return "", err
	}
	absURL, err := p.absoluteMediaURL(w, mediaURL)
	if err != nil {
		return "", err
	}
	kind, ok := mediaTypeToKind[mediaType]
	if !ok {
		kind = "document"
	}
	return client.SendMedia(ctx, *w.IzapiaSessionID, to, kind, absURL, mimeType, "")
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
