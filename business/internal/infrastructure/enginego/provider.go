// Package enginego implements domain.WhatsAppEngine by talking to the
// engine-go dumb executor over AMQP (routing key
// wbot.<tenant>.<session>.<cmd>). It owns proxy resolution/composition
// (anti-ban egress IP, ADR 0016/0021) — that concern is specific to the
// whatsmeow engine; other engines (e.g. izapia) manage their own proxy.
package enginego

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Provider implements domain.WhatsAppEngine for the "whatsmeow" engineType.
type Provider struct {
	db        *gorm.DB
	publisher domain.CommandPublisher
}

// New wires the engine-go provider via constructor DI.
func New(db *gorm.DB, publisher domain.CommandPublisher) *Provider {
	return &Provider{db: db, publisher: publisher}
}

// StartSession resolves the connection's proxy (fail-closed) and publishes
// session.start to engine-go.
func (p *Provider) StartSession(ctx context.Context, whatsapp models.Whatsapp, usePairingCode bool, phoneNumber string, force bool) error {
	proxyURL, err := p.composeProxyURL(whatsapp)
	if err != nil {
		return fmt.Errorf("proxy configuration error: %w", err)
	}

	command := map[string]interface{}{
		"id":        uuid.New().String(),
		"timestamp": time.Now().UnixMilli(),
		"tenantId":  whatsapp.TenantID,
		"type":      "session.start",
		"payload": map[string]interface{}{
			"sessionId":      whatsapp.ID,
			"usePairingCode": usePairingCode,
			"phoneNumber":    phoneNumber,
			"name":           whatsapp.Name,
			"syncHistory":    whatsapp.SyncHistory,
			"syncPeriod":     whatsapp.SyncPeriod,
			"keepAlive":      whatsapp.KeepAlive,
			"force":          force,
			"wid":            whatsapp.Wid,
			// proxyUrl carrega scheme://user:pass@host:port (credencial em claro).
			// NUNCA logar este payload — o engine o consome via env.Payload.proxyUrl.
			"proxyUrl": proxyURL,
		},
	}

	routingKey := fmt.Sprintf("wbot.%s.%d.session.start", whatsapp.TenantID, whatsapp.ID)
	return p.publisher.PublishCommand(routingKey, command)
}

func (p *Provider) StopSession(ctx context.Context, whatsapp models.Whatsapp) error {
	routingKey, command := p.buildSessionCommand(whatsapp, "session.stop")
	return p.publisher.PublishCommand(routingKey, command)
}

func (p *Provider) DeleteSession(ctx context.Context, whatsapp models.Whatsapp) error {
	routingKey, command := p.buildSessionCommand(whatsapp, "session.delete")
	return p.publisher.PublishCommand(routingKey, command)
}

func (p *Provider) SendText(ctx context.Context, whatsapp models.Whatsapp, to, messageID, body string) error {
	return p.sendCommand(whatsapp, "message.send.text", map[string]interface{}{
		"sessionId": whatsapp.ID,
		"messageId": messageID,
		"to":        to,
		"body":      body,
	})
}

func (p *Provider) SendMedia(ctx context.Context, whatsapp models.Whatsapp, to, messageID, mediaType, mediaURL, mimeType string) error {
	return p.sendCommand(whatsapp, "message.send.media", map[string]interface{}{
		"sessionId": whatsapp.ID,
		"messageId": messageID,
		"to":        to,
		"mediaType": mediaType,
		"mediaUrl":  mediaURL,
		"mimeType":  mimeType,
	})
}

func (p *Provider) sendCommand(whatsapp models.Whatsapp, commandType string, payload map[string]interface{}) error {
	command := map[string]interface{}{"type": commandType, "payload": payload}
	routingKey := fmt.Sprintf("wbot.%s.%d.%s", whatsapp.TenantID, whatsapp.ID, commandType)
	return p.publisher.PublishCommand(routingKey, command)
}

func (p *Provider) buildSessionCommand(whatsapp models.Whatsapp, commandType string) (string, map[string]interface{}) {
	command := map[string]interface{}{
		"id":        uuid.New().String(),
		"timestamp": time.Now().UnixMilli(),
		"tenantId":  whatsapp.TenantID,
		"type":      commandType,
		"payload": map[string]interface{}{
			"sessionId": whatsapp.ID,
		},
	}
	routingKey := fmt.Sprintf("wbot.%s.%d.%s", whatsapp.TenantID, whatsapp.ID, commandType)
	return routingKey, command
}

// composeProxyURL builds the proxy URL for the connection, decrypting the
// password. Returns "" when no proxy is assigned (ProxyMode "none"). Returns an
// error (fail-closed) when a proxy IS assigned but unusable.
func (p *Provider) composeProxyURL(whatsapp models.Whatsapp) (string, error) {
	px, err := p.resolveProxy(whatsapp)
	if err != nil {
		return "", err
	}
	if px == nil {
		return "", nil
	}
	pass, err := cryptobox.Decrypt(px.PasswordEnc)
	if err != nil {
		return "", fmt.Errorf("falha ao descriptografar senha do proxy %d: %w", px.ID, err)
	}
	scheme := px.Scheme
	if scheme == "" {
		scheme = "http"
	}
	// net.JoinHostPort coloca colchetes em hosts IPv6 (ex: [::1]:1080).
	u := url.URL{Scheme: scheme, Host: net.JoinHostPort(px.Host, strconv.Itoa(px.Port))}
	if px.Username != "" || pass != "" {
		u.User = url.UserPassword(px.Username, pass)
	}
	return u.String(), nil
}

// resolveProxy returns the active proxy a connection should use, or nil when
// ProxyMode is "none". Fail-closed on any misconfiguration.
func (p *Provider) resolveProxy(whatsapp models.Whatsapp) (*models.Proxy, error) {
	switch whatsapp.ProxyMode {
	case "single":
		if whatsapp.ProxyID == nil {
			return nil, fmt.Errorf("proxyMode=single sem proxyId na conexão %d", whatsapp.ID)
		}
		var px models.Proxy
		if err := p.db.Where(`id = ? AND "tenantId" = ?`, *whatsapp.ProxyID, whatsapp.TenantID).First(&px).Error; err != nil {
			return nil, fmt.Errorf("proxy %d não encontrado para a conexão %d: %w", *whatsapp.ProxyID, whatsapp.ID, err)
		}
		if px.Status != "active" {
			// Comum após auto-isolação por ban: o proxy single foi isolado e a
			// conexão não reconecta nele de propósito (IP queimado). Mensagem
			// acionável p/ o operador (sai no toast de erro do reconectar).
			return nil, fmt.Errorf("proxy %d está %s (provável ban anterior) — reatribua um proxy ativo à conexão ou reative-o em Configurações > Proxy antes de reconectar", px.ID, px.Status)
		}
		return &px, nil
	case "group":
		return p.pickGroupProxy(whatsapp)
	default:
		return nil, nil
	}
}

// pickGroupProxy selects a proxy from the connection's proxy group.
//   - sticky: reuse the current ProxyID if it is still active and in the group;
//     otherwise pick the least-recently-used active one and persist it.
//   - rotate: always pick the least-recently-used active one and persist it,
//     so the egress IP advances on each (re)connect.
//
// Isolated/banned proxies are excluded (status != active), so the ban-isolation
// guard automatically removes a burned IP from the pool.
func (p *Provider) pickGroupProxy(whatsapp models.Whatsapp) (*models.Proxy, error) {
	if whatsapp.ProxyGroupID == nil {
		return nil, fmt.Errorf("proxyMode=group sem proxyGroupId na conexão %d", whatsapp.ID)
	}
	var group models.ProxyGroup
	if err := p.db.Where(`id = ? AND "tenantId" = ?`, *whatsapp.ProxyGroupID, whatsapp.TenantID).First(&group).Error; err != nil {
		return nil, fmt.Errorf("grupo de proxy %d não encontrado para a conexão %d: %w", *whatsapp.ProxyGroupID, whatsapp.ID, err)
	}

	// Sticky: keep the current pick if it is still active and in this group.
	if group.RotationStrategy != "rotate" && whatsapp.ProxyID != nil {
		var cur models.Proxy
		if err := p.db.Where(`id = ? AND "tenantId" = ? AND "proxyGroupId" = ? AND status = ?`,
			*whatsapp.ProxyID, whatsapp.TenantID, group.ID, "active").First(&cur).Error; err == nil {
			return &cur, nil
		}
	}

	// Atomic LRU pick + persist NA MESMA TRANSAÇÃO: se o Update(proxyId) falhar,
	// a transação inteira sofre ROLLBACK (inclusive o bump de lastUsedAt) e o
	// erro sobe — fail-closed real. SKIP LOCKED garante que dois starts
	// concorrentes no mesmo grupo não pegam o mesmo proxy.
	var px models.Proxy
	txErr := p.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Raw(`
			UPDATE "Proxies" SET "lastUsedAt" = now()
			WHERE id = (
				SELECT id FROM "Proxies"
				WHERE "tenantId" = ? AND "proxyGroupId" = ? AND status = 'active'
				ORDER BY "lastUsedAt" ASC NULLS FIRST
				LIMIT 1
				FOR UPDATE SKIP LOCKED
			)
			RETURNING *`, whatsapp.TenantID, group.ID).Scan(&px).Error; err != nil {
			return err
		}
		if px.ID == 0 {
			return fmt.Errorf("nenhum proxy ativo disponível no grupo %d para a conexão %d", group.ID, whatsapp.ID)
		}
		return tx.Model(&models.Whatsapp{}).
			Where(`id = ? AND "tenantId" = ?`, whatsapp.ID, whatsapp.TenantID).
			Update("proxyId", px.ID).Error
	})
	if txErr != nil {
		return nil, fmt.Errorf("falha ao selecionar/persistir proxy do grupo %d para a conexão %d: %w", group.ID, whatsapp.ID, txErr)
	}
	return &px, nil
}

var _ domain.WhatsAppEngine = (*Provider)(nil)
