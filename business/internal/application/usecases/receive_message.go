package usecases

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/plugins"
	"github.com/alltomatos/watinkdev/business/pkg/mediastore"
	"github.com/google/uuid"
)

// ReceiveMessageInput is the application-layer DTO for inbound WhatsApp messages.
type ReceiveMessageInput struct {
	ID            string
	From          string
	Body          string
	Type          string
	FromMe        bool
	Timestamp     int64
	PushName      string
	GroupName     string
	QuotedMsgID   string
	ProfilePicURL string
	SenderPicURL  string
	IsLID         bool
	Participant   string
	IsGroup       bool
	IsCommunity   bool
	IsSubGroup    bool
	MediaURL      string
	MediaData     string
	Mimetype      string
	Thumbnail     string // base64 JPEG preview for pending (not-yet-downloaded) media
	MediaProto    string // base64 serialized media message for on-demand download
	SessionID     int
	TenantID      uuid.UUID
}

// ReceiveMessageResult returns the entities affected by the inbound message flow.
type ReceiveMessageResult struct {
	Contact *domain.Contact
	Ticket  *domain.Ticket
	Message *domain.Message
}

// ReceiveMessageUseCase handles the business logic for receiving messages.
type ReceiveMessageUseCase struct {
	eventBus      domain.EventBus
	messageRepo   domain.MessageRepository
	contactRepo   domain.ContactRepository
	ticketRepo    domain.TicketRepository
	queueRepo     domain.QueueRepository
	tagRepo       domain.TagRepository
	entityTagRepo domain.EntityTagRepository
}

func NewReceiveMessageUseCase(
	eventBus domain.EventBus,
	messageRepo domain.MessageRepository,
	contactRepo domain.ContactRepository,
	ticketRepo domain.TicketRepository,
	queueRepo domain.QueueRepository,
	tagRepo domain.TagRepository,
	entityTagRepo domain.EntityTagRepository,
) *ReceiveMessageUseCase {
	return &ReceiveMessageUseCase{
		eventBus:      eventBus,
		messageRepo:   messageRepo,
		contactRepo:   contactRepo,
		ticketRepo:    ticketRepo,
		queueRepo:     queueRepo,
		tagRepo:       tagRepo,
		entityTagRepo: entityTagRepo,
	}
}

// resolveChannelQueue returns the queue to assign to a new ticket: when the
// channel is linked to exactly one queue, that queue is inherited so agents of
// that queue can see the ticket immediately. With 0 or multiple queues it returns
// nil (triage/flow decides).
func (uc *ReceiveMessageUseCase) resolveChannelQueue(ctx context.Context, channelID int, tenantID uuid.UUID) *int {
	if uc.queueRepo == nil {
		return nil
	}
	ids, err := uc.queueRepo.FindQueueIDsByChannel(ctx, channelID, tenantID)
	if err != nil || len(ids) != 1 {
		return nil
	}
	return &ids[0]
}

// Execute processes an incoming message and handles contact, ticket and message persistence.
func (uc *ReceiveMessageUseCase) Execute(ctx context.Context, input ReceiveMessageInput) (*ReceiveMessageResult, error) {
	contactJID := input.From
	if contactJID == "" {
		contactJID = input.Participant
	}
	number := jidNumber(contactJID)
	if number == "" {
		return nil, fmt.Errorf("empty sender number")
	}

	contactName := contactDisplayName(input.PushName, input.GroupName, input.IsGroup)

	contact, err := uc.contactRepo.FindOrCreate(
		ctx,
		input.TenantID,
		number,
		contactName,
		input.ProfilePicURL,
		input.IsGroup,
		input.IsLID,
		input.From,
	)
	if err != nil {
		return nil, err
	}

	// Self-heal: if a group was previously created with a participant's name,
	// update it to the real group subject once we know it.
	if input.IsGroup && input.GroupName != "" && contact.Name != input.GroupName {
		if err := uc.contactRepo.Update(ctx, contact, map[string]interface{}{"name": input.GroupName}); err == nil {
			contact.Name = input.GroupName
		}
	}

	// Auto-tag group participants with their group origin so agents can
	// later filter contacts by which group they came from.
	if input.IsGroup && input.GroupName != "" && uc.tagRepo != nil && uc.entityTagRepo != nil {
		if tag, tagErr := uc.tagRepo.FindOrCreateByName(ctx, input.TenantID, input.GroupName); tagErr == nil {
			_ = uc.entityTagRepo.AddIfAbsent(ctx, "contact", contact.ID, tag.ID, input.TenantID)
		}
	}

	ticket, err := uc.ticketRepo.FindOpenByContact(ctx, input.TenantID, contact.ID, input.SessionID)
	if err != nil {
		return nil, err
	}
	if ticket == nil {
		ticketStatus := "pending"
		if input.IsGroup {
			ticketStatus = "open"
		}
		ticket, err = uc.ticketRepo.FindOrCreatePending(ctx, &domain.Ticket{
			ContactID:   contact.ID,
			Status:      ticketStatus,
			TenantID:    input.TenantID,
			WhatsappID:  input.SessionID,
			IsGroup:     input.IsGroup,
			IsCommunity: input.IsCommunity,
			IsSubGroup:  input.IsSubGroup,
			QueueID:     uc.resolveChannelQueue(ctx, input.SessionID, input.TenantID),
		})
		if err != nil {
			return nil, err
		}
	} else if ticket.IsGroup != input.IsGroup {
		if err := uc.ticketRepo.Update(ctx, ticket, map[string]interface{}{"isGroup": input.IsGroup}); err != nil {
			return nil, err
		}
		ticket.IsGroup = input.IsGroup
	}

	mediaType := input.Type
	if mediaType == "" {
		mediaType = "chat"
	}

	mediaURL := input.MediaURL
	if mediaURL == "" && input.MediaData != "" {
		if url, err := mediastore.SaveMediaBase64(input.MediaData, input.Mimetype); err != nil {
			log.Printf("[ReceiveMessage] media save failed (msg %s): %v", input.ID, err)
		} else {
			mediaURL = url
		}
	}

	// Media is downloaded on demand: when the engine ships a serialized media
	// proto (and no URL/data yet), the message is "pending" — the frontend shows
	// the blurred thumbnail + a download button until the operator fetches it.
	mediaStatus := ""
	if mediaType != "chat" && mediaURL == "" {
		if input.MediaProto != "" {
			mediaStatus = "pending"
		} else {
			mediaStatus = "unavailable"
		}
	}

	dataJSON, _ := json.Marshal(map[string]interface{}{
		"jid":          contactJID,
		"participant":  input.Participant,
		"pushName":     input.PushName,     // sender name shown in group bubble
		"senderPicUrl": input.SenderPicURL, // sender's individual photo for group bubble avatar
		"isGroup":      input.IsGroup,
		"isLid":        input.IsLID,
		"mimetype":     input.Mimetype,
		"mediaData":    input.MediaData,
		"thumbnail":    input.Thumbnail,
		"mediaProto":   input.MediaProto,
		"mediaStatus":  mediaStatus,
	})

	createdAt := time.Unix(input.Timestamp, 0)
	if createdAt.IsZero() || input.Timestamp == 0 {
		createdAt = time.Now()
	}

	msg := &domain.Message{
		ID:          input.ID,
		Body:        input.Body,
		TicketID:    ticket.ID,
		ContactID:   &contact.ID,
		FromMe:      input.FromMe,
		TenantID:    input.TenantID,
		MediaType:   mediaType,
		MediaUrl:    mediaURL,
		Participant: input.Participant,
		DataJson:    string(dataJSON),
		CreatedAt:   createdAt,
		UpdatedAt:   time.Now(),
	}

	if input.QuotedMsgID != "" {
		exists, err := uc.messageRepo.ExistsByID(ctx, input.QuotedMsgID, input.TenantID)
		if err != nil {
			return nil, err
		}
		if exists {
			msg.QuotedMsgID = &input.QuotedMsgID
		}
	}

	if err := uc.messageRepo.CreateIfNotExists(ctx, msg); err != nil {
		return nil, err
	}

	lastMsg := msg.Body
	if lastMsg == "" {
		lastMsg = mimeTypeLabel(input.Mimetype)
	}
	updates := map[string]interface{}{"lastMessage": lastMsg, "updatedAt": time.Now()}
	if !input.FromMe {
		// Atomic DB increment (column = column + 1) — evita lost update quando
		// duas mensagens do mesmo ticket são processadas em paralelo em instâncias
		// diferentes (topologia multi-nó suportada). O ++ em memória é só uma
		// aproximação para o broadcast; o banco é a fonte da verdade.
		updates["unreadMessages"] = domain.Increment{By: 1}
		ticket.UnreadMessages++
	}
	if err := uc.ticketRepo.Update(ctx, ticket, updates); err != nil {
		return nil, err
	}
	ticket.LastMessage = lastMsg
	ticket.UpdatedAt = time.Now()

	_ = uc.eventBus.Publish(ctx, domain.NewMessageReceivedEvent(msg.ID, ticket.ID, input.TenantID))

	// "message.received" no barramento local de plugins (mesmo padrão de
	// controllers.DealController "pipeline.deal.*") -- ponto de extensão pra
	// plugin reagir a mensagem nova sem o core saber que ele existe (hoje:
	// Groups e Comunidades, monitoramento de frase em mensagens de grupo).
	// Publica sempre, não só pra IsGroup=true: quem decide o que importa é o
	// assinante, não o publisher.
	plugins.PublishDomainEvent(ctx, "message.received", map[string]any{
		"tenantId":  input.TenantID.String(),
		"ticketId":  ticket.ID,
		"messageId": msg.ID,
		"isGroup":   input.IsGroup,
	})

	return &ReceiveMessageResult{
		Contact: contact,
		Ticket:  ticket,
		Message: msg,
	}, nil
}
