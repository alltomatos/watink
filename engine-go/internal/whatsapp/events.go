package whatsapp

import (
	"fmt"
	"log"

	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// handleEvent dispatches whatsmeow events to the appropriate handler.
func (s *WhatsAppService) handleEvent(id int, tenantID string, evt interface{}) {
	client, ok := s.clients[id]
	if !ok {
		return
	}

	switch v := evt.(type) {
	case *events.Message:
		s.handleMessageEvent(client, id, tenantID, v)
	case *events.Receipt:
		s.handleReceiptEvent(id, tenantID, v)
	case *events.Connected:
		s.emitConnected(client, id, tenantID)
	case *events.Disconnected:
		s.emitStatus(id, tenantID, "DISCONNECTED")
	case *events.LoggedOut:
		log.Printf("Session %d logged out (onConnect: %v, reason: %v)", id, v.OnConnect, v.Reason)
		// ConnectFailureUnknownLogout (406) é o que o WhatsApp Web chama de BANNED.
		// 401 (LoggedOut) = logout normal. 403 (MainDeviceGone/LOCKED) é AMBÍGUO no
		// whatsmeow ("happens for both bans and switching phones") — tratamos como
		// DISCONNECTED para não queimar o IP numa simples troca de aparelho; isso
		// sub-detecta conscientemente alguns bans 403.
		if v.Reason == events.ConnectFailureUnknownLogout {
			s.emitStatus(id, tenantID, "BANNED")
		} else {
			s.emitStatus(id, tenantID, "DISCONNECTED")
		}
	case *events.TemporaryBan:
		// ConnectFailureTempBanned (402) — ban temporário; IP/numero sinalizado.
		log.Printf("Session %d temporariamente banida (code: %v, expira em: %v)", id, v.Code, v.Expire)
		s.emitStatus(id, tenantID, "BANNED")
	case *events.Contact:
		s.handleContactEvent(id, tenantID, v)
	case *events.PushName:
		s.handlePushNameEvent(id, tenantID, v)
	case *events.Picture:
		s.handlePictureEvent(client, id, tenantID, v)
	case *events.HistorySync:
		log.Printf("History sync (type %s) for session %d", v.Data.SyncType.String(), id)
		if v.Data.GetSyncType() == waHistorySync.HistorySync_ON_DEMAND {
			s.handleOnDemandHistory(id, tenantID, v.Data)
			return
		}
		s.publishEvent(tenantID, id, "session.history_sync", map[string]interface{}{
			"sessionId": fmt.Sprintf("%d", id),
			"type":      v.Data.SyncType.String(),
			"progress":  v.Data.GetProgress(),
		})
	}
}

func (s *WhatsAppService) handleReceiptEvent(id int, tenantID string, v *events.Receipt) {
	ack := receiptAck(v.Type)
	for _, messageID := range v.MessageIDs {
		s.publishEvent(tenantID, id, "message.ack", map[string]interface{}{
			"sessionId": fmt.Sprintf("%d", id),
			"messageId": string(messageID),
			"jid":       v.Chat.String(),
			"ack":       ack,
		})
	}
}

// handleContactEvent emits contact.update when whatsmeow reports a contact change.
func (s *WhatsAppService) handleContactEvent(id int, tenantID string, v *events.Contact) {
	pushName := ""
	if v.Action != nil {
		pushName = v.Action.GetFullName()
	}
	payload := map[string]interface{}{
		"sessionId": fmt.Sprintf("%d", id),
		"contact": map[string]interface{}{
			"jid":      v.JID.String(),
			"pushName": pushName,
		},
	}
	s.publishEvent(tenantID, id, "contact.update", payload)
}

// handlePushNameEvent emits contact.update when a push name (contact display name) changes.
func (s *WhatsAppService) handlePushNameEvent(id int, tenantID string, v *events.PushName) {
	payload := map[string]interface{}{
		"sessionId": fmt.Sprintf("%d", id),
		"contact": map[string]interface{}{
			"jid":      v.JID.String(),
			"pushName": v.NewPushName,
		},
	}
	s.publishEvent(tenantID, id, "contact.update", payload)
}

func receiptAck(receiptType types.ReceiptType) int {
	switch receiptType {
	case types.ReceiptTypeDelivered:
		return 2
	case types.ReceiptTypeRead:
		return 3
	case types.ReceiptTypePlayed:
		return 4
	case types.ReceiptTypeServerError:
		// WhatsApp rejected delivery of this outgoing message (server-side send
		// error). Surface as an error ack (5) so the UI shows a failed state +
		// retry instead of masking it as "sent" via the default branch.
		return 5
	default:
		return 1
	}
}

// extractMessageContent and the media helpers live in message_content.go — they
// no longer download media inline; the engine ships a thumbnail + serialized
// proto so the backend can download on demand.
