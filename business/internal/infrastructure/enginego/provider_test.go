package enginego

import (
	"encoding/json"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
)

type mockCommandPublisher struct {
	lastRoutingKey string
	lastPayload    interface{}
}

func (m *mockCommandPublisher) PublishCommand(routingKey string, payload interface{}) error {
	m.lastRoutingKey = routingKey
	m.lastPayload = payload
	return nil
}

func assertSessionCommand(t *testing.T, p *Provider, commandType string) {
	t.Helper()
	tenantID := uuid.New()
	whatsapp := models.Whatsapp{ID: 42, TenantID: tenantID}

	routingKey, command := p.buildSessionCommand(whatsapp, commandType)

	if routingKey != "wbot."+tenantID.String()+".42."+commandType {
		t.Fatalf("routing key = %q", routingKey)
	}
	if command["tenantId"] != tenantID {
		t.Fatalf("tenantId = %v", command["tenantId"])
	}
	if command["type"] != commandType {
		t.Fatalf("type = %v", command["type"])
	}

	payload, ok := command["payload"].(map[string]interface{})
	if !ok {
		t.Fatalf("payload type = %T", command["payload"])
	}
	if payload["sessionId"] != whatsapp.ID {
		t.Fatalf("sessionId = %v", payload["sessionId"])
	}

	if _, err := json.Marshal(command); err != nil {
		t.Fatalf("command must be JSON serializable: %v", err)
	}
}

func TestBuildSessionCommand_Stop(t *testing.T) {
	p := New(nil, &mockCommandPublisher{})
	assertSessionCommand(t, p, "session.stop")
}

func TestBuildSessionCommand_Delete(t *testing.T) {
	p := New(nil, &mockCommandPublisher{})
	assertSessionCommand(t, p, "session.delete")
}

func TestStopSession_PublishesStop(t *testing.T) {
	pub := &mockCommandPublisher{}
	p := New(nil, pub)
	tenantID := uuid.New()
	whatsapp := models.Whatsapp{ID: 99, TenantID: tenantID}

	if err := p.StopSession(nil, whatsapp); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expectedKey := "wbot." + tenantID.String() + ".99.session.stop"
	if pub.lastRoutingKey != expectedKey {
		t.Errorf("routing key = %q, want %q", pub.lastRoutingKey, expectedKey)
	}
}

func TestDeleteSession_PublishesDelete(t *testing.T) {
	pub := &mockCommandPublisher{}
	p := New(nil, pub)
	tenantID := uuid.New()
	whatsapp := models.Whatsapp{ID: 55, TenantID: tenantID}

	if err := p.DeleteSession(nil, whatsapp); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expectedKey := "wbot." + tenantID.String() + ".55.session.delete"
	if pub.lastRoutingKey != expectedKey {
		t.Errorf("routing key = %q, want %q", pub.lastRoutingKey, expectedKey)
	}
}
