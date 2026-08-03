package domain

import "github.com/google/uuid"

// Domain Events
type DomainEvent interface {
	EventName() string
	TenantID() uuid.UUID
}

type TicketAssignedEvent struct {
	TicketID int
	UserID   int
	tenantID uuid.UUID
}

func (e TicketAssignedEvent) EventName() string   { return "TicketAssigned" }
func (e TicketAssignedEvent) TenantID() uuid.UUID { return e.tenantID }

func NewTicketAssignedEvent(ticketID, userID int, tenantID uuid.UUID) TicketAssignedEvent {
	return TicketAssignedEvent{TicketID: ticketID, UserID: userID, tenantID: tenantID}
}

type MessageReceivedEvent struct {
	MessageID string
	TicketID  int
	tenantID  uuid.UUID
}

func (e MessageReceivedEvent) EventName() string   { return "MessageReceived" }
func (e MessageReceivedEvent) TenantID() uuid.UUID { return e.tenantID }

func NewMessageReceivedEvent(messageID string, ticketID int, tenantID uuid.UUID) MessageReceivedEvent {
	return MessageReceivedEvent{MessageID: messageID, TicketID: ticketID, tenantID: tenantID}
}

type TicketStatusChangedEvent struct {
	TicketID  int
	OldStatus string
	NewStatus string
	tenantID  uuid.UUID
}

func (e TicketStatusChangedEvent) EventName() string   { return "TicketStatusChanged" }
func (e TicketStatusChangedEvent) TenantID() uuid.UUID { return e.tenantID }

func NewTicketStatusChangedEvent(ticketID int, oldStatus, newStatus string, tenantID uuid.UUID) TicketStatusChangedEvent {
	return TicketStatusChangedEvent{TicketID: ticketID, OldStatus: oldStatus, NewStatus: newStatus, tenantID: tenantID}
}
