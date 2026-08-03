package domain

import (
	"testing"

	"github.com/google/uuid"
)

func TestNewTicketAssignedEvent(t *testing.T) {
	tenantID := uuid.New()
	e := NewTicketAssignedEvent(1, 2, tenantID)
	if e.TicketID != 1 {
		t.Errorf("expected TicketID 1, got %d", e.TicketID)
	}
	if e.UserID != 2 {
		t.Errorf("expected UserID 2, got %d", e.UserID)
	}
	if e.TenantID() != tenantID {
		t.Errorf("expected tenantID %s, got %s", tenantID, e.TenantID())
	}
	if e.EventName() != "TicketAssigned" {
		t.Errorf("expected EventName 'TicketAssigned', got %s", e.EventName())
	}
	// Satisfies DomainEvent interface
	var _ DomainEvent = e
}

func TestNewMessageReceivedEvent(t *testing.T) {
	tenantID := uuid.New()
	e := NewMessageReceivedEvent("msg-42", 7, tenantID)
	if e.MessageID != "msg-42" {
		t.Errorf("expected MessageID 'msg-42', got %s", e.MessageID)
	}
	if e.TicketID != 7 {
		t.Errorf("expected TicketID 7, got %d", e.TicketID)
	}
	if e.TenantID() != tenantID {
		t.Errorf("expected tenantID %s, got %s", tenantID, e.TenantID())
	}
	if e.EventName() != "MessageReceived" {
		t.Errorf("expected EventName 'MessageReceived', got %s", e.EventName())
	}
	var _ DomainEvent = e
}

func TestNewTicketStatusChangedEvent(t *testing.T) {
	tenantID := uuid.New()
	e := NewTicketStatusChangedEvent(10, "open", "closed", tenantID)
	if e.TicketID != 10 {
		t.Errorf("expected TicketID 10, got %d", e.TicketID)
	}
	if e.OldStatus != "open" {
		t.Errorf("expected OldStatus 'open', got %s", e.OldStatus)
	}
	if e.NewStatus != "closed" {
		t.Errorf("expected NewStatus 'closed', got %s", e.NewStatus)
	}
	if e.TenantID() != tenantID {
		t.Errorf("expected tenantID %s, got %s", tenantID, e.TenantID())
	}
	if e.EventName() != "TicketStatusChanged" {
		t.Errorf("expected EventName 'TicketStatusChanged', got %s", e.EventName())
	}
	var _ DomainEvent = e
}
