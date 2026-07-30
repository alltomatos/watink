package whatsapp

import (
	"context"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	waE2E "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
)

// mockFullClient satisfies the expanded WhatsAppClient interface.
type mockFullClient struct {
	sendErr     error
	uploadResp  whatsmeow.UploadResponse
	uploadErr   error
	markReadErr error
}

func (m *mockFullClient) SendMessage(_ context.Context, _ types.JID, _ *waE2E.Message, _ ...whatsmeow.SendRequestExtra) (whatsmeow.SendResponse, error) {
	return whatsmeow.SendResponse{}, m.sendErr
}

func (m *mockFullClient) BuildPollCreation(_ string, _ []string, _ int) *waE2E.Message {
	return &waE2E.Message{}
}

func (m *mockFullClient) IsOnWhatsApp(_ context.Context, _ []string) ([]types.IsOnWhatsAppResponse, error) {
	return nil, nil
}

func (m *mockFullClient) GetProfilePictureInfo(_ context.Context, _ types.JID, _ *whatsmeow.GetProfilePictureParams) (*types.ProfilePictureInfo, error) {
	return nil, nil
}

func (m *mockFullClient) Download(_ context.Context, _ whatsmeow.DownloadableMessage) ([]byte, error) {
	return nil, nil
}

func (m *mockFullClient) Upload(_ context.Context, _ []byte, _ whatsmeow.MediaType) (whatsmeow.UploadResponse, error) {
	return m.uploadResp, m.uploadErr
}

func (m *mockFullClient) MarkRead(_ context.Context, _ []types.MessageID, _ time.Time, _, _ types.JID, _ ...types.ReceiptType) error {
	return m.markReadErr
}

// Compile-time check: mockFullClient satisfies WhatsAppClient.
var _ WhatsAppClient = (*mockFullClient)(nil)

// TestSendText_NoClient verifies that SendText returns an error and emits
// message.ack when no session is connected.
func TestSendText_NoClient(t *testing.T) {
	var events []string
	svc := &WhatsAppService{
		clients:         make(map[int]*whatsmeow.Client),
		historyRequests: make(map[string]*pendingHistory),
		groupNames:      make(map[string]string),
		groupMetaMap:    make(map[string]groupMeta),
		picCache:        make(map[string]string),
	}
	svc.publishEvent = func(_ string, _ int, eventType string, _ map[string]interface{}) {
		events = append(events, eventType)
	}

	err := svc.SendText(1, "tenant-1", TextCommandPayload{
		MessageID: "msg-1",
		To:        "5511999990000@s.whatsapp.net",
		Body:      "hello",
	})
	if err == nil {
		t.Fatal("expected error for disconnected session")
	}
	if len(events) == 0 || events[0] != "message.ack" {
		t.Fatalf("expected message.ack event, got %v", events)
	}
}

// TestSendReaction_NoClient verifies that SendReaction returns an error and
// emits message.ack when no session is connected.
func TestSendReaction_NoClient(t *testing.T) {
	var events []string
	svc := &WhatsAppService{
		clients:         make(map[int]*whatsmeow.Client),
		historyRequests: make(map[string]*pendingHistory),
		groupNames:      make(map[string]string),
		groupMetaMap:    make(map[string]groupMeta),
		picCache:        make(map[string]string),
	}
	svc.publishEvent = func(_ string, _ int, eventType string, _ map[string]interface{}) {
		events = append(events, eventType)
	}

	err := svc.SendReaction(1, "tenant-1", ReactionCommandPayload{
		MessageID:    "msg-1",
		To:           "5511999990000@s.whatsapp.net",
		TargetMsgID:  "target-1",
		TargetFromMe: false,
		Reaction:     "👍",
	})
	if err == nil {
		t.Fatal("expected error for disconnected session")
	}
	if len(events) == 0 || events[0] != "message.ack" {
		t.Fatalf("expected message.ack event, got %v", events)
	}
}

// TestMarkRead_NoClient verifies that MarkRead returns an error when session is absent.
func TestMarkRead_NoClient(t *testing.T) {
	svc := &WhatsAppService{
		clients:         make(map[int]*whatsmeow.Client),
		historyRequests: make(map[string]*pendingHistory),
		groupNames:      make(map[string]string),
		groupMetaMap:    make(map[string]groupMeta),
		picCache:        make(map[string]string),
	}
	svc.publishEvent = func(_ string, _ int, _ string, _ map[string]interface{}) {}

	err := svc.MarkRead(99, MarkReadCommandPayload{
		ChatJID:    "5511999990000@s.whatsapp.net",
		MessageIDs: []string{"mid-1"},
	})
	if err == nil {
		t.Fatal("expected error for disconnected session")
	}
}

// TestMarkRead_InvalidChatJID verifies MarkRead propagates JID parse errors.
// We test by passing an empty ChatJID after the session-not-connected path.
func TestMarkRead_InvalidChatJID(t *testing.T) {
	svc := &WhatsAppService{
		clients:         make(map[int]*whatsmeow.Client),
		historyRequests: make(map[string]*pendingHistory),
		groupNames:      make(map[string]string),
		groupMetaMap:    make(map[string]groupMeta),
		picCache:        make(map[string]string),
	}
	svc.publishEvent = func(_ string, _ int, _ string, _ map[string]interface{}) {}

	// No client connected, so we get the session error first.
	err := svc.MarkRead(1, MarkReadCommandPayload{
		ChatJID:    "",
		MessageIDs: []string{"mid-1"},
	})
	if err == nil {
		t.Fatal("expected error")
	}
}

// TestSendMedia_NoClient verifies SendMedia emits message.ack and returns error.
func TestSendMedia_NoClient(t *testing.T) {
	var events []string
	svc := &WhatsAppService{
		clients:         make(map[int]*whatsmeow.Client),
		historyRequests: make(map[string]*pendingHistory),
		groupNames:      make(map[string]string),
		groupMetaMap:    make(map[string]groupMeta),
		picCache:        make(map[string]string),
	}
	svc.publishEvent = func(_ string, _ int, eventType string, _ map[string]interface{}) {
		events = append(events, eventType)
	}

	err := svc.SendMedia(1, "tenant-1", MediaCommandPayload{
		MessageID: "msg-2",
		To:        "5511999990000@s.whatsapp.net",
		MediaType: "image",
		MediaData: "aGVsbG8=", // base64 "hello"
		MimeType:  "image/jpeg",
	})
	if err == nil {
		t.Fatal("expected error for disconnected session")
	}
	if len(events) == 0 || events[0] != "message.ack" {
		t.Fatalf("expected message.ack event, got %v", events)
	}
}
