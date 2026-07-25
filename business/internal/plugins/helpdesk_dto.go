package plugins

import (
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
)

// DTOs de resposta do plugin Helpdesk — casam exatamente com os tipos TS
// consumidos pelo frontend (frontend/src/pages/Helpdesk/{protocolTypes,helpdeskTypes}.ts
// e frontend/src/pages/PublicProtocol/publicProtocolTypes.ts). Nome Social
// (ADR 0023): nunca substituído aqui — o backend manda os dois campos
// (contact.name civil + contact.client.socialName) e o frontend decide a
// exibição, do mesmo jeito que já faz para Tickets.

type protocolClientDTO struct {
	SocialName *string `json:"socialName"`
}

type protocolContactDTO struct {
	Name          string             `json:"name"`
	ProfilePicUrl string             `json:"profilePicUrl,omitempty"`
	Client        *protocolClientDTO `json:"client,omitempty"`
}

type protocolUserDTO struct {
	Name string `json:"name"`
}

type protocolHistoryItemDTO struct {
	Action        string           `json:"action"`
	PreviousValue string           `json:"previousValue,omitempty"`
	NewValue      string           `json:"newValue,omitempty"`
	Comment       string           `json:"comment,omitempty"`
	CreatedAt     time.Time        `json:"createdAt"`
	User          *protocolUserDTO `json:"user,omitempty"`
}

type protocolListItemDTO struct {
	ID             int                 `json:"id"`
	ProtocolNumber string              `json:"protocolNumber"`
	Subject        string              `json:"subject"`
	Status         string              `json:"status"`
	Priority       string              `json:"priority"`
	CreatedAt      time.Time           `json:"createdAt"`
	Contact        *protocolContactDTO `json:"contact,omitempty"`
}

type protocolDetailDTO struct {
	ID             int                      `json:"id"`
	ProtocolNumber string                   `json:"protocolNumber"`
	Subject        string                   `json:"subject"`
	Description    string                   `json:"description"`
	Category       string                   `json:"category,omitempty"`
	Status         string                   `json:"status"`
	Priority       string                   `json:"priority"`
	Token          string                   `json:"token"`
	Contact        *protocolContactDTO      `json:"contact,omitempty"`
	History        []protocolHistoryItemDTO `json:"history"`
}

// toContactDTO devolve nil quando o Protocol não tem Contact carregado
// (preload ausente ou ContactID órfão) — o frontend já trata `contact` como
// opcional em todos os três tipos que o consomem.
func toContactDTO(c models.Contact) *protocolContactDTO {
	if c.ID == 0 {
		return nil
	}
	dto := &protocolContactDTO{Name: c.Name, ProfilePicUrl: c.ProfilePicUrl}
	if c.Client != nil {
		dto.Client = &protocolClientDTO{SocialName: c.Client.SocialName}
	}
	return dto
}

func toListItemDTO(p models.Protocol) protocolListItemDTO {
	return protocolListItemDTO{
		ID:             p.ID,
		ProtocolNumber: p.ProtocolNumber,
		Subject:        p.Subject,
		Status:         p.Status,
		Priority:       p.Priority,
		CreatedAt:      p.CreatedAt,
		Contact:        toContactDTO(p.Contact),
	}
}

// kanbanProtocolDTO casa com KanbanProtocol (frontend useHelpdeskKanban.ts) —
// mesmo shape usado tanto na resposta de GET .../kanban quanto no payload do
// evento SSE "protocol" (create/update), para o client-side reconciliar sem
// precisar de dois parsers.
type kanbanProtocolDTO struct {
	ID             int                 `json:"id"`
	ProtocolNumber string              `json:"protocolNumber"`
	Subject        string              `json:"subject"`
	Status         string              `json:"status"`
	Priority       string              `json:"priority"`
	Contact        *protocolContactDTO `json:"contact,omitempty"`
}

func toKanbanProtocolDTO(p models.Protocol) kanbanProtocolDTO {
	return kanbanProtocolDTO{
		ID:             p.ID,
		ProtocolNumber: p.ProtocolNumber,
		Subject:        p.Subject,
		Status:         p.Status,
		Priority:       p.Priority,
		Contact:        toContactDTO(p.Contact),
	}
}

func toDetailDTO(p models.Protocol, history []models.ProtocolLog) protocolDetailDTO {
	items := make([]protocolHistoryItemDTO, 0, len(history))
	for _, h := range history {
		item := protocolHistoryItemDTO{
			Action:        h.Action,
			PreviousValue: h.PreviousValue,
			NewValue:      h.NewValue,
			Comment:       h.Comment,
			CreatedAt:     h.CreatedAt,
		}
		if h.User.ID != 0 {
			item.User = &protocolUserDTO{Name: h.User.Name}
		}
		items = append(items, item)
	}
	return protocolDetailDTO{
		ID:             p.ID,
		ProtocolNumber: p.ProtocolNumber,
		Subject:        p.Subject,
		Description:    p.Description,
		Category:       p.Category,
		Status:         p.Status,
		Priority:       p.Priority,
		Token:          p.Token,
		Contact:        toContactDTO(p.Contact),
		History:        items,
	}
}
