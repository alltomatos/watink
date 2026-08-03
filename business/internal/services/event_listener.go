package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/application/usecases"
	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/plugins"
	"github.com/google/uuid"
	amqp "github.com/streadway/amqp"
	"gorm.io/gorm"
)

type EventListener struct {
	sessions       domain.ChannelSessionRepository
	messages       domain.MessageRepository
	contacts       domain.ContactRepository
	tickets        domain.TicketRepository
	receiveMessage *usecases.ReceiveMessageUseCase
	broadcast      domain.Broadcaster
	db             *gorm.DB
	flowSkeleton   *flow.Skeleton
}

func NewEventListener(sessions domain.ChannelSessionRepository, messages domain.MessageRepository, contacts domain.ContactRepository, tickets domain.TicketRepository, rm *usecases.ReceiveMessageUseCase, broadcast domain.Broadcaster, db *gorm.DB, registry *flow.ChannelRegistry, redis domain.RedisService) *EventListener {
	// SetAssistantRuntime: sem isto, todo assistant-node de toda mensagem
	// real recebida (message.received) executa com st.AssistantRuntime==nil
	// e assistantExecutor.Execute degrada silenciosamente pra "sem
	// assistantId/runtime" (Advance, sem edge de saída, run "completed" sem
	// nunca chamar o Mode do Assistant) -- o plugin "Assistentes de IA"
	// nunca respondia UMA mensagem real sequer, apesar de rodar via
	// /flows/:id/run (routes.go monta um Skeleton SEPARADO, com o runtime
	// wireado, só pro endpoint manual). Bug reproduzido ao vivo em homolog:
	// FlowRun entrava no nó assistant e completava em ~0ms sem nenhuma
	// query em Assistants/AssistantRouterOptions, sem enviar nada.
	skeleton := flow.NewSkeleton(db, registry, redis)
	skeleton.SetAssistantRuntime(plugins.NewAssistantRuntime(db))
	return &EventListener{sessions: sessions, messages: messages, contacts: contacts, tickets: tickets, receiveMessage: rm, broadcast: domain.BroadcastOrNop(broadcast), db: db, flowSkeleton: skeleton}
}

// ConfigureKnowledge wires the flow skeleton's RAG retriever/responder (see
// flow.Skeleton.SetRetriever/SetResponder) — called from main.go right after
// construction so the native pgvector RAG applies to the real inbound
// WhatsApp message path, not just the on-demand endpoints wired in routes.go.
func (el *EventListener) ConfigureKnowledge(retriever flow.Retriever, responder flow.AgentResponder) {
	el.flowSkeleton.SetRetriever(retriever)
	el.flowSkeleton.SetResponder(responder)
}

// bcast returns a nil-safe broadcaster — tests that construct EventListener
// directly with broadcast=nil still get a no-op instead of a panic.
func (el *EventListener) bcast() domain.Broadcaster {
	return domain.BroadcastOrNop(el.broadcast)
}

func StartEventListener(rabbitMQ *RabbitMQService, eventListener *EventListener) {
	routingKeys := []string{
		"wbot.*.*.session.qrcode",
		"wbot.*.*.session.pairing_code",
		"wbot.*.*.session.status",
		"wbot.*.*.session.history_sync",
		"wbot.*.*.session.risk",
		"wbot.*.*.message.received",
		"wbot.*.*.message.ack",
		"wbot.*.*.message.revoke",
		"wbot.*.*.message.reaction",
		"wbot.*.*.message.media",
		"wbot.*.*.contact.update",
		"wbot.*.*.contact.import",
		"wbot.*.*.session.jid_registered",
		"wbot.*.*.message.poll_vote",
	}

	err := rabbitMQ.ConsumeEvents("api.events.process.go", routingKeys, func(d amqp.Delivery) error {
		var env EventEnvelope
		if err := json.Unmarshal(d.Body, &env); err != nil {
			log.Printf("Error unmarshaling event: %v", err)
			return err
		}

		tid, err := uuid.Parse(env.TenantID)
		if err != nil {
			return fmt.Errorf("invalid tenantId %q: %w", env.TenantID, err)
		}

		log.Printf("[EventListener] Event received: %s (Tenant: %s)", env.Type, env.TenantID)

		ctx := context.Background()
		switch env.Type {
		case "session.qrcode":
			return eventListener.handleQrCode(ctx, env.Payload, tid)
		case "session.pairing_code":
			return eventListener.handlePairingCode(ctx, env.Payload, tid)
		case "session.status":
			return eventListener.handleSessionStatus(ctx, env.Payload, tid)
		case "session.history_sync":
			return eventListener.handleHistorySync(ctx, env.Payload, tid)
		case "session.risk":
			return eventListener.handleSessionRisk(ctx, env.Payload, tid)
		case "message.received":
			var p MessageReceivedPayload
			if err := json.Unmarshal(env.Payload, &p); err != nil {
				return err
			}
			return eventListener.processMessage(ctx, p.Message, p.SessionID, tid)
		case "message.ack":
			return eventListener.handleMessageAck(ctx, env.Payload, tid)
		case "message.revoke":
			return eventListener.handleMessageRevoke(ctx, env.Payload, tid)
		case "message.reaction":
			return eventListener.handleMessageReaction(ctx, env.Payload, tid)
		case "message.media":
			return eventListener.handleMediaDownloaded(ctx, env.Payload, tid)
		case "contact.update":
			if err := handleContactUpdate(ctx, eventListener.contacts, eventListener.bcast(), env.Payload, tid); err != nil {
				return err
			}
			// Mesmo evento de enriquecimento — também atualiza a foto da PRÓPRIA
			// conexão quando o número bate (não é um contato, é o número da sessão).
			return syncConnectionProfilePic(ctx, eventListener.sessions, eventListener.bcast(), env.Payload, tid)
		case "contact.import":
			return handleContactImport(ctx, eventListener.contacts, env.Payload, tid)
		case "session.jid_registered":
			return handleJIDRegistered(ctx, eventListener.sessions, env.Payload, tid)
		case "message.poll_vote":
			return eventListener.handlePollVote(ctx, env.Payload, tid)
		default:
			return nil
		}
	})

	if err != nil {
		log.Printf("Error starting event listener: %v", err)
	}
}

// HandleInboundMessage is the exported entry point for non-AMQP transports
// (izapia webhook) to feed an inbound message through the exact same
// pipeline (ReceiveMessageUseCase + broadcasts + FlowBuilder routing) as the
// engine-go AMQP consumer.
func (el *EventListener) HandleInboundMessage(ctx context.Context, p MessagePayload, rawSessionID string, tenantID uuid.UUID) error {
	return el.processMessage(ctx, p, rawSessionID, tenantID)
}

// HandleSessionStatusEvent is the exported entry point for non-AMQP
// transports to apply a session status transition (connected/disconnected/
// banned/...) through the same logic as the engine-go AMQP consumer
// (handleSessionStatus), including auto-isolation of a banned proxy.
func (el *EventListener) HandleSessionStatusEvent(ctx context.Context, payload json.RawMessage, tenantID uuid.UUID) error {
	return el.handleSessionStatus(ctx, payload, tenantID)
}

// HandlePollVoteEvent is the exported entry point for non-AMQP transports to
// record a poll vote through the same logic as the engine-go AMQP consumer
// (handlePollVote) — persists a PollResult only when the originating
// QuickAnswer has capture_results:true; never touches FlowBuilder/ticket state
// (mirrors whatsmeow: a poll vote is metadata, not an inbound message).
func (el *EventListener) HandlePollVoteEvent(ctx context.Context, payload json.RawMessage, tenantID uuid.UUID) error {
	return el.handlePollVote(ctx, payload, tenantID)
}

// HandleSessionRiskEvent is the exported entry point for non-AMQP transports
// (izapia webhook) to apply a ban/throttle risk signal (401/403/429/463)
// through the same logic as the engine-go AMQP consumer (handleSessionRisk):
// persists lastRiskCode/Action/Message/At on the connection, auto-isolates
// the proxy for 429/463, and broadcasts whatsappSessionRisk to the tenant.
func (el *EventListener) HandleSessionRiskEvent(ctx context.Context, payload json.RawMessage, tenantID uuid.UUID) error {
	return el.handleSessionRisk(ctx, payload, tenantID)
}

func (el *EventListener) processMessage(ctx context.Context, p MessagePayload, rawSessionID string, tenantID uuid.UUID) error {
	sessionID := getSessionID(rawSessionID)

	result, err := el.receiveMessage.Execute(ctx, usecases.ReceiveMessageInput{
		ID:            p.ID,
		From:          p.From,
		Body:          p.Body,
		Type:          p.Type,
		FromMe:        p.FromMe,
		Timestamp:     p.Timestamp,
		PushName:      p.PushName,
		GroupName:     p.GroupName,
		QuotedMsgID:   p.QuotedMsgId,
		ProfilePicURL: p.ProfilePicUrl,
		SenderPicURL:  p.SenderPicUrl,
		IsLID:         p.IsLid,
		Participant:   p.Participant,
		IsGroup:       p.IsGroup,
		IsCommunity:   p.IsCommunity,
		IsSubGroup:    p.IsSubGroup,
		MediaURL:      p.MediaUrl,
		MediaData:     p.MediaData,
		Mimetype:      p.Mimetype,
		Thumbnail:     p.Thumbnail,
		MediaProto:    p.MediaProto,
		SessionID:     sessionID,
		TenantID:      tenantID,
	})
	if err != nil {
		return err
	}

	room := "chat:" + strconv.Itoa(result.Ticket.ID)
	msgPayload := map[string]interface{}{"action": "create", "message": result.Message, "ticket": result.Ticket, "contact": result.Contact}
	el.bcast().EmitToRoom("/", room, "appMessage", msgPayload)
	el.bcast().EmitToTenantRoom(tenantID.String(), "appMessage", msgPayload)
	el.bcast().EmitToTenantRoom(tenantID.String(), "ticket", map[string]interface{}{"action": "update", "ticket": result.Ticket, "contact": result.Contact})

	// FlowBuilder FASE 1 seam: route the inbound through the runtime AFTER the
	// real-time broadcasts, so its DB round-trip never delays SSE delivery. The
	// dispatcher does resume-first / opt-out / trigger→StartFlow, tenant-aware
	// (WHERE "tenantId" manual). EnvID = inbound message id (redelivery dedup).
	if el.flowSkeleton != nil {
		el.flowSkeleton.RouteInboundTicket(ctx, flow.InboundContext{
			TenantID:      tenantID,
			Body:          p.Body,
			FromMe:        p.FromMe,
			EnvID:         p.ID,
			Ticket:        result.Ticket,
			Contact:       result.Contact,
			MentionedJIDs: p.MentionedJids,
		})
	}

	return nil
}
