package flow

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"gorm.io/gorm"
)

// dedupTTL is the idempotency window for an outbound send (mirrors the
// wbot:msg: Redis convention used across the message pipeline).
const dedupTTL = 24 * time.Hour

// WhatsAppAdapterDeps are optional dependencies enabling non-AMQP engines
// (e.g. izapia). When absent, every send goes through the AMQP path below —
// preserving the original FASE 1 behavior unchanged.
type WhatsAppAdapterDeps struct {
	DB      *gorm.DB
	Engines domain.WhatsAppEngineResolver
}

// WhatsAppAdapter is the OutboundChannelAdapter for the "whatsapp" channel. It
// dedups by EnvID, then either translates an OutboundMessage into the AMQP
// command `wbot.<tenant>.<session>.<cmd>` for the dumb engine-go executor
// (default, ADR 0014), or — when the connection's EngineType is non-AMQP
// (e.g. izapia) and WhatsAppAdapterDeps is wired — dispatches via
// domain.WhatsAppEngine instead.
type WhatsAppAdapter struct {
	rabbit domain.CommandPublisher
	redis  domain.RedisService
	deps   WhatsAppAdapterDeps
}

// NewWhatsAppAdapter wires the adapter via constructor DI (no global/singleton).
// deps is optional (variadic) so existing call sites keep working unchanged.
func NewWhatsAppAdapter(rabbit domain.CommandPublisher, redis domain.RedisService, deps ...WhatsAppAdapterDeps) *WhatsAppAdapter {
	a := &WhatsAppAdapter{rabbit: rabbit, redis: redis}
	if len(deps) > 0 {
		a.deps = deps[0]
	}
	return a
}

// Channel identifies this adapter in the registry.
func (a *WhatsAppAdapter) Channel() string { return "whatsapp" }

// Send dedups by EnvID, then publishes the engine command. A duplicate (lock
// already held) is a no-op success — the redelivery must not double-send.
//
// Meta keys honored: "messageId" (string, the WhatsApp msg id; generated if
// absent — but the caller should supply the EnvID-derived id for the persisted
// row to match the ack), "mediaType"/"mediaUrl"/"mimeType" (string).
func (a *WhatsAppAdapter) Send(ctx context.Context, msg OutboundMessage) error {
	if msg.To == "" {
		return fmt.Errorf("whatsapp adapter: empty destination (to)")
	}
	if msg.SessionID == "" {
		return fmt.Errorf("whatsapp adapter: empty sessionId")
	}

	// Dedup BEFORE any real send. SetLock is SetNX: false => already sent.
	if a.redis != nil && msg.EnvID != "" {
		acquired, err := a.redis.SetLock("wbot:msg:"+msg.EnvID, "1", dedupTTL)
		if err != nil {
			return fmt.Errorf("whatsapp adapter: dedup lock: %w", err)
		}
		if !acquired {
			return nil
		}
	}

	// Non-AMQP engines (e.g. izapia) are resolved by the connection's
	// EngineType and dispatched via domain.WhatsAppEngine instead of AMQP.
	// Only when deps are wired (call sites that don't need it keep the
	// original AMQP-only behavior).
	if a.deps.DB != nil && a.deps.Engines != nil {
		sid, _ := strconv.Atoi(msg.SessionID)
		var whatsapp models.Whatsapp
		if err := a.deps.DB.Session(&gorm.Session{NewDB: true}).
			Where(`id = ? AND "tenantId" = ?`, sid, msg.TenantID).First(&whatsapp).Error; err == nil &&
			whatsapp.EngineType != "" && whatsapp.EngineType != "whatsmeow" {
			return a.sendViaEngine(ctx, whatsapp, msg)
		}
	}

	// Rich sends (interactive/media/poll/carousel — e.g. the quickAnswer node)
	// carry a pre-built commandType+payload in Meta instead of the plain
	// body/mediaUrl shape below. BuildQuickAnswerCommand already fills
	// sessionId/messageId/to, so pass it through verbatim.
	if ct, ok := msg.Meta["commandType"].(string); ok && ct != "" {
		payload, _ := msg.Meta["payload"].(map[string]interface{})
		command := map[string]interface{}{"type": ct, "payload": payload}
		routingKey := fmt.Sprintf("wbot.%s.%s.%s", msg.TenantID.String(), msg.SessionID, ct)
		if err := a.rabbit.PublishCommand(routingKey, command); err != nil {
			if a.redis != nil && msg.EnvID != "" {
				if delErr := a.redis.DelLock("wbot:msg:" + msg.EnvID); delErr != nil {
					log.Printf("[WhatsAppAdapter] dedup lock release after publish failure failed (env=%s): %v", msg.EnvID, delErr)
				}
			}
			return fmt.Errorf("whatsapp adapter: publish rich command: %w", err)
		}
		return nil
	}

	mediaType := metaString(msg.Meta, "mediaType")
	mediaURL := metaString(msg.Meta, "mediaUrl")
	mimeType := metaString(msg.Meta, "mimeType")

	commandType := "message.send.text"
	if mediaURL != "" {
		commandType = "message.send.media"
	}

	messageID := metaString(msg.Meta, "messageId")
	if messageID == "" {
		messageID = msg.EnvID
	}

	// The engine unmarshals payload.sessionId into an `int` (no `,string` tag —
	// see engine-go send_types.go). Sending it as a string makes that unmarshal
	// fail → the command is NACKed and the message is NEVER sent. Convert here;
	// the routing-key segment stays a string (AMQP keys are textual). A
	// non-numeric SessionID yields 0, which the engine rejects loudly rather than
	// silently mis-routing.
	sid, _ := strconv.Atoi(msg.SessionID)

	command := map[string]interface{}{
		"type": commandType,
		"payload": map[string]interface{}{
			"sessionId": sid,
			"messageId": messageID,
			"to":        msg.To,
			"body":      msg.Body,
			"mediaType": mediaType,
			"mediaUrl":  mediaURL,
			"mimeType":  mimeType,
		},
	}

	// The engine dispatches by routing-key segment; the command type MUST be in
	// the key, not just the body. SessionID is the chip (Ticket.WhatsappID).
	routingKey := fmt.Sprintf("wbot.%s.%s.%s", msg.TenantID.String(), msg.SessionID, commandType)
	if err := a.rabbit.PublishCommand(routingKey, command); err != nil {
		// Publish failed AFTER we took the dedup lock. If we leave the lock held,
		// the AMQP redelivery (retry of this same outbound) hits the retained lock
		// and no-ops silently → the message is lost for the full 24h TTL. Release
		// the lock best-effort so the retry can actually re-send. Only release the
		// lock we just acquired here (msg.EnvID != "" means we took it above).
		if a.redis != nil && msg.EnvID != "" {
			if delErr := a.redis.DelLock("wbot:msg:" + msg.EnvID); delErr != nil {
				log.Printf("[WhatsAppAdapter] dedup lock release after publish failure failed (env=%s): %v", msg.EnvID, delErr)
			}
		}
		return fmt.Errorf("whatsapp adapter: publish command: %w", err)
	}
	return nil
}

// sendViaEngine dispatches a text/media/rich send through the connection's
// domain.WhatsAppEngine (izapia and future non-AMQP engines). Rich sends
// (quickAnswerExecutor stuffs qaType/qaContent/qaMessage into Meta alongside
// the AMQP-shaped commandType/payload — see executor_quickanswer.go) go
// through RichMessageEngine when the engine implements it; otherwise they
// fail loudly rather than silently no-op.
func (a *WhatsAppAdapter) sendViaEngine(ctx context.Context, whatsapp models.Whatsapp, msg OutboundMessage) error {
	engine, err := a.deps.Engines.EngineFor(whatsapp)
	if err != nil {
		a.releaseLock(msg.EnvID)
		return fmt.Errorf("whatsapp adapter: resolve engine: %w", err)
	}

	// qaType is only set (by executor_quickanswer.go) for sends that originate
	// from a QuickAnswers node. text/media quick answers fall through to the
	// plain body/mediaUrl path below unchanged; everything else needs
	// RichMessageEngine.
	qaType, _ := msg.Meta["qaType"].(string)
	if qaType != "" && qaType != "text" && qaType != "media" {
		richEngine, ok := engine.(domain.RichMessageEngine)
		if !ok {
			a.releaseLock(msg.EnvID)
			return fmt.Errorf("whatsapp adapter: resposta rápida do tipo %q não suportada no engine %q", qaType, whatsapp.EngineType)
		}
		contentMap, _ := msg.Meta["qaContent"].(map[string]interface{})
		req := BuildRichMessageRequest(qaType, metaString(msg.Meta, "qaMessage"), contentMap)
		messageID := metaString(msg.Meta, "messageId")
		if messageID == "" {
			messageID = msg.EnvID
		}
		if err := richEngine.SendInteractive(ctx, whatsapp, msg.To, messageID, req); err != nil {
			a.releaseLock(msg.EnvID)
			return fmt.Errorf("whatsapp adapter: engine send: %w", err)
		}
		return nil
	}

	mediaURL := metaString(msg.Meta, "mediaUrl")
	messageID := metaString(msg.Meta, "messageId")
	if messageID == "" {
		messageID = msg.EnvID
	}

	if mediaURL != "" {
		err = engine.SendMedia(ctx, whatsapp, msg.To, messageID, metaString(msg.Meta, "mediaType"), mediaURL, metaString(msg.Meta, "mimeType"))
	} else {
		err = engine.SendText(ctx, whatsapp, msg.To, messageID, msg.Body)
	}
	if err != nil {
		a.releaseLock(msg.EnvID)
		return fmt.Errorf("whatsapp adapter: engine send: %w", err)
	}
	return nil
}

// releaseLock best-effort releases the dedup lock so a retry after a failed
// send can actually re-send (mirrors the AMQP publish-failure handling above).
func (a *WhatsAppAdapter) releaseLock(envID string) {
	if a.redis == nil || envID == "" {
		return
	}
	if err := a.redis.DelLock("wbot:msg:" + envID); err != nil {
		log.Printf("[WhatsAppAdapter] dedup lock release after engine-send failure failed (env=%s): %v", envID, err)
	}
}

// metaString reads a string value from the channel-specific Meta map.
func metaString(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
