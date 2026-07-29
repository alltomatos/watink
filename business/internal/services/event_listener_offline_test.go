package services

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
)

// --- mock repos (offline, no DB) ---

type mockContactRepo struct {
	contact        *domain.Contact
	findErr        error
	updateFields   map[string]interface{}
	updateCalls    int
	created        []*domain.Contact
	foundOrCreated []*domain.Contact
}

func (m *mockContactRepo) FindByNumber(_ context.Context, _ uuid.UUID, _ string, _ bool) (*domain.Contact, error) {
	return m.contact, m.findErr
}
func (m *mockContactRepo) FindByID(_ context.Context, _ int, _ uuid.UUID) (*domain.Contact, error) {
	return nil, nil
}
func (m *mockContactRepo) Find(_ context.Context, _ uuid.UUID, _ string) ([]domain.Contact, error) {
	return nil, nil
}
func (m *mockContactRepo) Create(_ context.Context, c *domain.Contact) error {
	m.created = append(m.created, c)
	return nil
}
func (m *mockContactRepo) Update(_ context.Context, _ *domain.Contact, fields map[string]interface{}) error {
	m.updateCalls++
	m.updateFields = fields
	return nil
}
func (m *mockContactRepo) Delete(_ context.Context, _ int, _ uuid.UUID) error { return nil }
func (m *mockContactRepo) BulkDelete(_ context.Context, _ []int, _ uuid.UUID) (int64, error) {
	return 0, nil
}
func (m *mockContactRepo) DeleteAll(_ context.Context, _ uuid.UUID) (int64, error) { return 0, nil }
func (m *mockContactRepo) FindOrCreate(_ context.Context, _ uuid.UUID, number, pushName, profilePicUrl string, isGroup, isLID bool, from string) (*domain.Contact, error) {
	c := &domain.Contact{Number: number, Name: pushName}
	m.foundOrCreated = append(m.foundOrCreated, c)
	return c, nil
}

type mockSessionRepo struct {
	updateCalls int
	updatedWID  string
}

func (m *mockSessionRepo) FindByID(_ context.Context, _ int, _ uuid.UUID) (*domain.ChannelSession, error) {
	return nil, nil
}
func (m *mockSessionRepo) FindByIDDetail(_ context.Context, _ int, _ uuid.UUID) (*models.Whatsapp, error) {
	return nil, nil
}
func (m *mockSessionRepo) FindAll(_ context.Context, _ uuid.UUID) ([]domain.ChannelSession, error) {
	return nil, nil
}
func (m *mockSessionRepo) Create(_ context.Context, _ *domain.ChannelSession) error { return nil }
func (m *mockSessionRepo) Update(_ context.Context, _ *domain.ChannelSession, fields map[string]interface{}) error {
	m.updateCalls++
	if wid, ok := fields["wid"].(string); ok {
		m.updatedWID = wid
	}
	return nil
}
func (m *mockSessionRepo) Delete(_ context.Context, _ int, _ uuid.UUID) error    { return nil }
func (m *mockSessionRepo) ResetDefaultFlag(_ context.Context, _ uuid.UUID) error { return nil }
func (m *mockSessionRepo) DeleteWithRelations(_ context.Context, _ int, _ uuid.UUID) error {
	return nil
}

type mockMessageRepo struct {
	msg           *domain.Message
	updated       bool
	updatedFields map[string]interface{}
	created       []*domain.Message
}

func (m *mockMessageRepo) Create(_ context.Context, msg *domain.Message) error {
	m.created = append(m.created, msg)
	return nil
}
func (m *mockMessageRepo) CreateIfNotExists(_ context.Context, msg *domain.Message) error {
	m.created = append(m.created, msg)
	return nil
}
func (m *mockMessageRepo) FindByID(_ context.Context, _ string, _ uuid.UUID) (*domain.Message, error) {
	return m.msg, nil
}
func (m *mockMessageRepo) FindOldestByTicket(_ context.Context, _ int, _ uuid.UUID) (*domain.Message, error) {
	return nil, nil
}
func (m *mockMessageRepo) ExistsByID(_ context.Context, _ string, _ uuid.UUID) (bool, error) {
	return false, nil
}
func (m *mockMessageRepo) Update(_ context.Context, _ *domain.Message, fields map[string]interface{}) error {
	m.updated = true
	m.updatedFields = fields
	return nil
}

// --- handleMessageRevoke ---

func TestHandleMessageRevoke_MarksDeleted(t *testing.T) {
	msg := &domain.Message{ID: "m10", TicketID: 5}
	mr := &mockMessageRepo{msg: msg}
	el := &EventListener{messages: mr, broadcast: domain.BroadcastOrNop(nil)}

	payload, _ := json.Marshal(map[string]string{"messageId": "m10"})
	if err := el.handleMessageRevoke(context.Background(), payload, uuid.New()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !mr.updated {
		t.Error("expected message to be updated with isDeleted=true")
	}
	if v, ok := mr.updatedFields["isDeleted"].(bool); !ok || !v {
		t.Errorf("expected isDeleted=true in update fields, got %v", mr.updatedFields)
	}
}

func TestHandleMessageRevoke_MessageNotFound_NoOp(t *testing.T) {
	mr := &mockMessageRepo{msg: nil}
	el := &EventListener{messages: mr, broadcast: domain.BroadcastOrNop(nil)}

	payload, _ := json.Marshal(map[string]string{"messageId": "ghost"})
	if err := el.handleMessageRevoke(context.Background(), payload, uuid.New()); err != nil {
		t.Fatalf("expected nil error for missing message, got: %v", err)
	}
	if mr.updated {
		t.Error("expected no update for missing message")
	}
}

// --- handleMessageReaction ---

func TestHandleMessageReaction_EmptyMessageID_NoOp(t *testing.T) {
	mr := &mockMessageRepo{}
	el := &EventListener{messages: mr, broadcast: domain.BroadcastOrNop(nil)}

	payload, _ := json.Marshal(map[string]interface{}{"messageId": "", "reaction": "👍"})
	if err := el.handleMessageReaction(context.Background(), payload, uuid.New()); err != nil {
		t.Fatalf("expected nil for empty messageId, got: %v", err)
	}
	if mr.updated {
		t.Error("expected no update for empty messageId")
	}
}

func TestHandleMessageReaction_AddsNewReaction(t *testing.T) {
	msg := &domain.Message{ID: "m20", TicketID: 7, Reactions: "[]"}
	mr := &mockMessageRepo{msg: msg}
	el := &EventListener{messages: mr, broadcast: domain.BroadcastOrNop(nil)}

	payload, _ := json.Marshal(map[string]interface{}{
		"messageId": "m20",
		"reaction":  "👍",
		"sender":    "5511999@s.whatsapp.net",
		"fromMe":    false,
		"timestamp": 1700000000,
	})
	if err := el.handleMessageReaction(context.Background(), payload, uuid.New()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !mr.updated {
		t.Error("expected message reactions to be updated")
	}

	var reactions []map[string]interface{}
	if err := json.Unmarshal([]byte(msg.Reactions), &reactions); err != nil {
		t.Fatalf("reactions JSON invalid: %v", err)
	}
	if len(reactions) != 1 {
		t.Fatalf("expected 1 reaction, got %d", len(reactions))
	}
	if reactions[0]["reaction"] != "👍" {
		t.Errorf("expected reaction=👍, got %v", reactions[0]["reaction"])
	}
}

func TestHandleMessageReaction_RemovesExistingReaction(t *testing.T) {
	existing, _ := json.Marshal([]map[string]interface{}{
		{"sender": "5511999@s.whatsapp.net", "reaction": "👍", "timestamp": 1700000000},
	})
	msg := &domain.Message{ID: "m21", TicketID: 7, Reactions: string(existing)}
	mr := &mockMessageRepo{msg: msg}
	el := &EventListener{messages: mr, broadcast: domain.BroadcastOrNop(nil)}

	// Empty reaction = remove
	payload, _ := json.Marshal(map[string]interface{}{
		"messageId": "m21",
		"reaction":  "",
		"sender":    "5511999@s.whatsapp.net",
	})
	if err := el.handleMessageReaction(context.Background(), payload, uuid.New()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var reactions []map[string]interface{}
	if err := json.Unmarshal([]byte(msg.Reactions), &reactions); err != nil {
		t.Fatalf("reactions JSON invalid after remove: %v", err)
	}
	if len(reactions) != 0 {
		t.Errorf("expected reaction removed, got %d reactions", len(reactions))
	}
}

// --- handleContactUpdate ---

func TestHandleContactUpdate_UpdatesNameAndPic(t *testing.T) {
	contact := &domain.Contact{ID: 1, Name: "", Number: "5511999"}
	cr := &mockContactRepo{contact: contact}

	payload, _ := json.Marshal(map[string]interface{}{
		"contact": map[string]string{
			"jid":           "5511999@s.whatsapp.net",
			"pushName":      "Alice",
			"profilePicUrl": "https://example.com/pic.jpg",
		},
	})
	if err := handleContactUpdate(context.Background(), cr, nil, payload, uuid.New()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cr.updateCalls != 1 {
		t.Errorf("expected 1 update call, got %d", cr.updateCalls)
	}
	if cr.updateFields["name"] != "Alice" {
		t.Errorf("expected name=Alice, got %v", cr.updateFields["name"])
	}
}

func TestHandleContactUpdate_ContactNotFound_NoOp(t *testing.T) {
	cr := &mockContactRepo{contact: nil}

	payload, _ := json.Marshal(map[string]interface{}{
		"contact": map[string]string{
			"number":   "5511999",
			"pushName": "Bob",
		},
	})
	if err := handleContactUpdate(context.Background(), cr, nil, payload, uuid.New()); err != nil {
		t.Fatalf("expected nil for missing contact, got: %v", err)
	}
	if cr.updateCalls != 0 {
		t.Error("expected no update for missing contact")
	}
}

func TestHandleContactUpdate_EmptyNumber_NoOp(t *testing.T) {
	cr := &mockContactRepo{}

	payload, _ := json.Marshal(ContactUpdatePayload{})
	if err := handleContactUpdate(context.Background(), cr, nil, payload, uuid.New()); err != nil {
		t.Fatalf("expected nil for empty number, got: %v", err)
	}
	if cr.updateCalls != 0 {
		t.Error("expected no update for empty number")
	}
}

// --- handleContactImport ---

func TestHandleContactImport_ImportsContacts(t *testing.T) {
	cr := &mockContactRepo{}

	payload, _ := json.Marshal(ContactImportPayload{
		SessionID: "sess-1",
		Contacts: []ImportedContact{
			{Number: "5511111", Name: "Alice"},
			{Number: "5522222", PushName: "Bob"},
			{Number: ""},
		},
	})
	if err := handleContactImport(context.Background(), cr, payload, uuid.New()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Empty number should be skipped — expect 2 imported
	if len(cr.foundOrCreated) != 2 {
		t.Errorf("expected 2 contacts imported, got %d", len(cr.foundOrCreated))
	}
}

func TestHandleContactImport_InvalidJSON(t *testing.T) {
	cr := &mockContactRepo{}
	err := handleContactImport(context.Background(), cr, json.RawMessage(`{bad`), uuid.New())
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

// --- handleJIDRegistered ---

func TestHandleJIDRegistered_UpdatesWID(t *testing.T) {
	sr := &mockSessionRepo{}

	payload, _ := json.Marshal(map[string]string{
		"sessionId": "7",
		"jid":       "5511999@s.whatsapp.net",
	})
	if err := handleJIDRegistered(context.Background(), sr, payload, uuid.New()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sr.updateCalls != 1 {
		t.Errorf("expected 1 update call, got %d", sr.updateCalls)
	}
	if sr.updatedWID != "5511999@s.whatsapp.net" {
		t.Errorf("expected wid=5511999@s.whatsapp.net, got %q", sr.updatedWID)
	}
}

func TestHandleJIDRegistered_EmptyJID_NoOp(t *testing.T) {
	sr := &mockSessionRepo{}

	payload, _ := json.Marshal(map[string]string{"sessionId": "7", "jid": ""})
	if err := handleJIDRegistered(context.Background(), sr, payload, uuid.New()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sr.updateCalls != 0 {
		t.Error("expected no update for empty jid")
	}
}

func TestHandleJIDRegistered_InvalidJSON(t *testing.T) {
	sr := &mockSessionRepo{}
	err := handleJIDRegistered(context.Background(), sr, json.RawMessage(`{bad`), uuid.New())
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}
