package controllers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/infrastructure/izapia"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// IzapiaWebhookController receives inbound events (messages, session status)
// pushed by the izapia API for connections whose EngineType is "izapia". It
// is a public route (no JWT — see routes.go): authentication is the per-session
// HMAC-SHA256 signature izapia sends in the X-izapia-Signature header,
// verified against the secret generated on session creation
// (izapia.Provider.ensureSession, Whatsapp.IzapiaWebhookSecretEnc).
type IzapiaWebhookController struct {
	db             *gorm.DB
	eventListener  *services.EventListener
	izapiaProvider *izapia.Provider
}

func NewIzapiaWebhookController(db *gorm.DB, eventListener *services.EventListener, izapiaProvider *izapia.Provider) *IzapiaWebhookController {
	return &IzapiaWebhookController{db: db, eventListener: eventListener, izapiaProvider: izapiaProvider}
}

// izapiaWebhookEnvelope is the confirmed shape of an izapia webhook delivery
// — {event_id, type, session_id, tenant_id, data, published_at}, verified
// against a live delivery on 2026-07-24 (message.received/message.ack/
// usage.message captured via a temporary webhook.site bin). event_id/
// tenant_id/published_at are unused here (tenant is resolved from the
// connection row instead) but kept for documentation.
type izapiaWebhookEnvelope struct {
	Type      string          `json:"type"`
	SessionID string          `json:"session_id"`
	Data      json.RawMessage `json:"data"`
}

// izapiaMessagePayload is the CONFIRMED shape of a "message.received" webhook
// data field (verified against a live delivery — see izapiaWebhookEnvelope).
// There is no is_group/participant field: group vs DM is derived from Chat
// (group JIDs end in "@g.us"); for a group message Chat is the group JID and
// From is the sending participant. Media field names are NOT yet confirmed
// (no media message was captured live) — MediaURL/Mimetype below are still a
// best-effort guess for that case only.
type izapiaMessagePayload struct {
	MessageID string `json:"message_id"`
	Chat      string `json:"chat"`
	From      string `json:"from"`
	Text      string `json:"text"`
	FromMe    bool   `json:"from_me"`
	Timestamp int64  `json:"timestamp"`
	PushName  string `json:"push_name"`
	MediaURL  string `json:"media_url"`
	Mimetype  string `json:"mimetype"`
}

type izapiaSessionStatusPayload struct {
	Status string `json:"status"`
	JID    string `json:"jid"`
}

// izapiaSessionRiskPayload is the "session.risk" webhook data shape (izapia
// OpenAPI spec, épico E-G4): {code, action, message} — same contract as
// engine-go's SessionRiskPayload, emitted for whatsmeow IQ codes 401/403/429/463.
type izapiaSessionRiskPayload struct {
	Code    int    `json:"code"`
	Action  string `json:"action"`
	Message string `json:"message"`
}

// izapiaPollVotePayload is the CONFIRMED shape of a "message.pollVote"
// webhook data field (captured live 2026-07-24): {from, message_id,
// poll_message_id, selected:[{label}]}. Selected carries every chosen option
// (multi-select support) — joined into PollVotePayload.OptionSelected.
type izapiaPollVotePayload struct {
	From          string `json:"from"`
	PollMessageID string `json:"poll_message_id"`
	Selected      []struct {
		Label string `json:"label"`
	} `json:"selected"`
}

// izapiaInteractiveReplyPayload is the CONFIRMED shape of a
// "message.interactiveReply" webhook data field for a LIST row selection
// (captured live 2026-07-24): {from, kind, message_id, selected:{id},
// raw:"<json string>"}. Raw unmarshals to izapiaInteractiveReplyRaw — the
// actual tapped row. A quick_reply BUTTON tap was observed to NOT produce
// this event type in a self-chat test (it arrived as a plain message.received
// with the selection buried in WhatsApp's raw protocol JSON) — that shape is
// handled defensively in izapiaMessagePayload.deviceSentButtonReplyID below,
// but is UNCONFIRMED against a real (non-self-chat) recipient.
type izapiaInteractiveReplyPayload struct {
	From      string `json:"from"`
	MessageID string `json:"message_id"`
	Raw       string `json:"raw"`
}

type izapiaInteractiveReplyRaw struct {
	ID          string `json:"id"`
	Description string `json:"description"`
}

// HandleWebhook receives POST /webhooks/izapia/:sessionId.
//
// @Summary      Webhook izapia (inbound)
// @Description  Recebe eventos de mensagem/status da sessão izapia. Autenticado por assinatura HMAC (X-izapia-Signature), não por JWT.
// @Tags         izapia
// @Accept       json
// @Produce      json
// @Param        sessionId  path  int  true  "ID da conexão (Whatsapps.id)"
// @Success      200  {object}  map[string]interface{}
// @Router       /webhooks/izapia/{sessionId} [post]
func (wc *IzapiaWebhookController) HandleWebhook(c *gin.Context) {
	sessionID, err := strconv.Atoi(c.Param("sessionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sessionId"})
		return
	}

	var whatsapp models.Whatsapp
	if err := wc.db.Session(&gorm.Session{NewDB: true}).
		Where("id = ? AND \"engineType\" = ?", sessionID, "izapia").
		First(&whatsapp).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "connection not found"})
		return
	}
	if whatsapp.IzapiaWebhookSecretEnc == nil || *whatsapp.IzapiaWebhookSecretEnc == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "webhook not configured"})
		return
	}

	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	secret, err := cryptobox.Decrypt(*whatsapp.IzapiaWebhookSecretEnc)
	if err != nil {
		log.Printf("[IzapiaWebhook] falha ao descriptografar secret da conexão %d: %v", whatsapp.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if !verifyIzapiaSignature(secret, rawBody, c.GetHeader("X-izapia-Signature")) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	var env izapiaWebhookEnvelope
	if err := json.Unmarshal(rawBody, &env); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	ctx := c.Request.Context()
	if err := wc.dispatch(ctx, env, whatsapp); err != nil {
		// env.Type vem do corpo do webhook (autenticado por HMAC, mas ainda
		// assim entrada externa) — %q escapa quebras de linha/caracteres de
		// controle pra impedir log forging (CodeQL: log entries created from
		// user input).
		log.Printf("[IzapiaWebhook] dispatch failed (session=%d type=%q): %v", whatsapp.ID, env.Type, err)
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (wc *IzapiaWebhookController) dispatch(ctx context.Context, env izapiaWebhookEnvelope, whatsapp models.Whatsapp) error {
	switch env.Type {
	case "message.received":
		var p izapiaMessagePayload
		if err := json.Unmarshal(env.Data, &p); err != nil {
			return err
		}
		isGroup := strings.HasSuffix(p.Chat, "@g.us")
		participant := ""
		from := p.Chat
		if isGroup {
			// In a group, Chat is the group JID and From is the sending
			// participant — mirrors the engine-go MessagePayload contract
			// (From = chat JID, Participant = sender within the group).
			participant = p.From
		}

		// Profile picture for the contact record — mirrors engine-go's
		// handleMessageEvent: group's own photo (Chat) + individual sender
		// photo for group messages, or just the sender's photo for a DM.
		// Skipped for outbound (FromMe) messages, same as engine-go.
		profilePicUrl := ""
		senderPicUrl := ""
		if wc.izapiaProvider != nil && !p.FromMe {
			if isGroup {
				profilePicUrl = wc.izapiaProvider.GetContactPictureURL(ctx, whatsapp, from)
				senderPicUrl = wc.izapiaProvider.GetContactPictureURL(ctx, whatsapp, participant)
			} else {
				profilePicUrl = wc.izapiaProvider.GetContactPictureURL(ctx, whatsapp, from)
			}
		}

		return wc.eventListener.HandleInboundMessage(ctx, services.MessagePayload{
			ID:            p.MessageID,
			From:          from,
			Body:          p.Text,
			FromMe:        p.FromMe,
			Timestamp:     p.Timestamp,
			PushName:      p.PushName,
			IsGroup:       isGroup,
			Participant:   participant,
			MediaUrl:      p.MediaURL,
			Mimetype:      p.Mimetype,
			ProfilePicUrl: profilePicUrl,
			SenderPicUrl:  senderPicUrl,
		}, strconv.Itoa(whatsapp.ID), whatsapp.TenantID)
	case "message.pollVote":
		var p izapiaPollVotePayload
		if err := json.Unmarshal(env.Data, &p); err != nil {
			return err
		}
		labels := make([]string, 0, len(p.Selected))
		for _, s := range p.Selected {
			labels = append(labels, s.Label)
		}
		payload, _ := json.Marshal(map[string]interface{}{
			"sessionId":      strconv.Itoa(whatsapp.ID),
			"pollMessageId":  p.PollMessageID,
			"voterJid":       p.From,
			"optionSelected": strings.Join(labels, ", "),
		})
		return wc.eventListener.HandlePollVoteEvent(ctx, payload, whatsapp.TenantID)
	case "message.interactiveReply":
		var p izapiaInteractiveReplyPayload
		if err := json.Unmarshal(env.Data, &p); err != nil {
			return err
		}
		var raw izapiaInteractiveReplyRaw
		body := ""
		if err := json.Unmarshal([]byte(p.Raw), &raw); err == nil {
			// Prefer the row/button id — matches what a flow author configures
			// as the option id (flow.matchMenuOption also accepts label text,
			// but id is the canonical value).
			body = raw.ID
			if body == "" {
				body = raw.Description
			}
		}
		return wc.eventListener.HandleInboundMessage(ctx, services.MessagePayload{
			ID:     p.MessageID,
			From:   p.From,
			Body:   body,
			FromMe: false,
		}, strconv.Itoa(whatsapp.ID), whatsapp.TenantID)
	case "message.ack", "usage.message":
		// Confirmed real event types (captured live) not yet wired to any
		// handler — delivery-status/usage tracking is Fase 2 scope. Ignored
		// safely rather than falling into the "unrecognized" log line.
		return nil
	case "session.qr":
		// Real event (per the izapia dashboard's webhook event catalog) but
		// NOT wired: StartSession already gets the QR synchronously from the
		// Pair() API response (izapia.Provider.StartSession) — this event
		// would only matter as a secondary refresh channel, not yet needed.
		// Deliberately NOT folded into the status case below: its data shape
		// is QR-specific, not {status,jid}, and would corrupt the connection
		// status if parsed as one.
		return nil
	case "session.status", "session.connected", "session.disconnected", "session.logged_out":
		var p izapiaSessionStatusPayload
		if err := json.Unmarshal(env.Data, &p); err != nil {
			return err
		}
		status := strings.ToUpper(p.Status)
		if status == "" {
			status = strings.ToUpper(strings.TrimPrefix(env.Type, "session."))
		}
		payload, _ := json.Marshal(map[string]interface{}{
			"sessionId": strconv.Itoa(whatsapp.ID),
			"status":    status,
			"number":    p.JID,
		})
		return wc.eventListener.HandleSessionStatusEvent(ctx, payload, whatsapp.TenantID)
	case "session.risk":
		var p izapiaSessionRiskPayload
		if err := json.Unmarshal(env.Data, &p); err != nil {
			return err
		}
		payload, _ := json.Marshal(map[string]interface{}{
			"sessionId": whatsapp.ID,
			"action":    p.Action,
			"code":      p.Code,
			"message":   p.Message,
		})
		return wc.eventListener.HandleSessionRiskEvent(ctx, payload, whatsapp.TenantID)
	default:
		log.Printf("[IzapiaWebhook] unrecognized event type %q (session=%d) — ignored", env.Type, whatsapp.ID)
		return nil
	}
}

func verifyIzapiaSignature(secret string, rawBody []byte, header string) bool {
	if header == "" {
		return false
	}
	sig := strings.TrimPrefix(header, "sha256=")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}
