package usecases

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/google/uuid"
)

// --- local mocks for ReceiveMessage ---

type mockRcvContactRepo struct {
	contact         *domain.Contact
	findOrCreateErr error
}

func (m *mockRcvContactRepo) FindByNumber(_ context.Context, _ uuid.UUID, _ string, _ bool) (*domain.Contact, error) {
	return nil, nil
}
func (m *mockRcvContactRepo) FindByID(_ context.Context, _ int, _ uuid.UUID) (*domain.Contact, error) {
	return nil, nil
}
func (m *mockRcvContactRepo) Find(_ context.Context, _ uuid.UUID, _ string) ([]domain.Contact, error) {
	return nil, nil
}
func (m *mockRcvContactRepo) Create(_ context.Context, _ *domain.Contact) error { return nil }
func (m *mockRcvContactRepo) Update(_ context.Context, _ *domain.Contact, _ map[string]interface{}) error {
	return nil
}
func (m *mockRcvContactRepo) Delete(_ context.Context, _ int, _ uuid.UUID) error { return nil }
func (m *mockRcvContactRepo) BulkDelete(_ context.Context, _ []int, _ uuid.UUID) (int64, error) {
	return 0, nil
}
func (m *mockRcvContactRepo) DeleteAll(_ context.Context, _ uuid.UUID) (int64, error) { return 0, nil }
func (m *mockRcvContactRepo) FindOrCreate(_ context.Context, _ uuid.UUID, _ string, _ string, _ string, _ bool, _ bool, _ string) (*domain.Contact, error) {
	return m.contact, m.findOrCreateErr
}

type mockMessageRepo struct {
	existsByIDResult     bool
	existsByIDErr        error
	createIfNotExistsErr error
}

func (m *mockMessageRepo) Create(_ context.Context, _ *domain.Message) error { return nil }
func (m *mockMessageRepo) CreateIfNotExists(_ context.Context, _ *domain.Message) error {
	return m.createIfNotExistsErr
}
func (m *mockMessageRepo) FindByID(_ context.Context, _ string, _ uuid.UUID) (*domain.Message, error) {
	return nil, nil
}
func (m *mockMessageRepo) FindOldestByTicket(_ context.Context, _ int, _ uuid.UUID) (*domain.Message, error) {
	return nil, nil
}
func (m *mockMessageRepo) ExistsByID(_ context.Context, _ string, _ uuid.UUID) (bool, error) {
	return m.existsByIDResult, m.existsByIDErr
}
func (m *mockMessageRepo) Update(_ context.Context, _ *domain.Message, _ map[string]interface{}) error {
	return nil
}

// receiveTicketRepo extends mockTicketRepo with open-ticket control
type receiveTicketRepo struct {
	mockTicketRepo
	openTicket    *domain.Ticket
	openTicketErr error
}

func (m *receiveTicketRepo) FindOpenByContact(_ context.Context, _ uuid.UUID, _ int, _ int) (*domain.Ticket, error) {
	return m.openTicket, m.openTicketErr
}

// --- helpers ---

func defaultContact() *domain.Contact {
	return &domain.Contact{ID: 1, Name: "Test"}
}

func defaultInput(tenantID uuid.UUID) ReceiveMessageInput {
	return ReceiveMessageInput{
		ID:        "msg-1",
		From:      "5511999999999@s.whatsapp.net",
		Body:      "Hello",
		Type:      "chat",
		Timestamp: 1700000000,
		TenantID:  tenantID,
		SessionID: 1,
	}
}

func newReceiveUC(cr domain.ContactRepository, tr domain.TicketRepository, mr domain.MessageRepository, eb domain.EventBus) *ReceiveMessageUseCase {
	// nil queueRepo/tagRepo/entityTagRepo → auto-assign and auto-tag skipped in tests.
	return NewReceiveMessageUseCase(eb, mr, cr, tr, nil, nil, nil)
}

func TestResolveChannelQueue(t *testing.T) {
	ctx := context.Background()
	tid := uuid.New()

	cases := []struct {
		name string
		repo domain.QueueRepository
		want *int
	}{
		{"single queue inherits", &mockQueueRepo{channelQueueIDs: []int{7}}, intPtr(7)},
		{"zero queues -> nil", &mockQueueRepo{channelQueueIDs: nil}, nil},
		{"multiple queues -> nil", &mockQueueRepo{channelQueueIDs: []int{1, 2}}, nil},
		{"nil repo -> nil", nil, nil},
	}

	for _, tc := range cases {
		uc := NewReceiveMessageUseCase(nil, nil, nil, nil, tc.repo, nil, nil)
		got := uc.resolveChannelQueue(ctx, 1, tid)
		if (got == nil) != (tc.want == nil) || (got != nil && *got != *tc.want) {
			t.Errorf("%s: got %v, want %v", tc.name, got, tc.want)
		}
	}
}

func intPtr(v int) *int { return &v }

// --- tests ---

func TestReceiveMessage_NewTicketCreated(t *testing.T) {
	tenantID := uuid.New()
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{} // openTicket nil → creates pending
	tr.ticket = &domain.Ticket{ID: 10, ContactID: 1, TenantID: tenantID}
	eb := &mockEventBus{}

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), defaultInput(tenantID))

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result == nil {
		t.Fatal("expected result, got nil")
	}
	if result.Message == nil {
		t.Error("expected message in result")
	}
	if result.Contact == nil {
		t.Error("expected contact in result")
	}
	if len(eb.published) == 0 {
		t.Error("expected event published")
	}
}

func TestReceiveMessage_ExistingOpenTicket_UpdatesUnread(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID, UnreadMessages: 2}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.FromMe = false

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Ticket.UnreadMessages != 3 {
		t.Errorf("expected 3 unread messages, got %d", result.Ticket.UnreadMessages)
	}
}

func TestReceiveMessage_FromMe_NoUnreadIncrement(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID, UnreadMessages: 1}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.FromMe = true

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Ticket.UnreadMessages != 1 {
		t.Errorf("expected unread to stay at 1, got %d", result.Ticket.UnreadMessages)
	}
}

func TestReceiveMessage_EmptySender_ReturnsError(t *testing.T) {
	tenantID := uuid.New()
	cr := &mockRcvContactRepo{}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.From = ""
	input.Participant = ""

	uc := newReceiveUC(cr, tr, mr, eb)
	_, err := uc.Execute(context.Background(), input)

	if err == nil {
		t.Fatal("expected error for empty sender")
	}
}

func TestReceiveMessage_ContactRepoError_ReturnsError(t *testing.T) {
	tenantID := uuid.New()
	cr := &mockRcvContactRepo{findOrCreateErr: errors.New("db error")}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{}
	eb := &mockEventBus{}

	uc := newReceiveUC(cr, tr, mr, eb)
	_, err := uc.Execute(context.Background(), defaultInput(tenantID))

	if err == nil {
		t.Fatal("expected error from contact repo")
	}
}

func TestReceiveMessage_TicketRepoFindError_ReturnsError(t *testing.T) {
	tenantID := uuid.New()
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{openTicketErr: errors.New("ticket db error")}
	eb := &mockEventBus{}

	uc := newReceiveUC(cr, tr, mr, eb)
	_, err := uc.Execute(context.Background(), defaultInput(tenantID))

	if err == nil {
		t.Fatal("expected error from ticket repo")
	}
}

func TestReceiveMessage_MessageCreateError_ReturnsError(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{createIfNotExistsErr: errors.New("msg create error")}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	uc := newReceiveUC(cr, tr, mr, eb)
	_, err := uc.Execute(context.Background(), defaultInput(tenantID))

	if err == nil {
		t.Fatal("expected error from message repo")
	}
}

func TestReceiveMessage_QuotedMsg_SetsQuotedMsgID(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{existsByIDResult: true}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.QuotedMsgID = "quoted-123"

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Message.QuotedMsgID == nil || *result.Message.QuotedMsgID != "quoted-123" {
		t.Error("expected QuotedMsgID to be set")
	}
}

func TestReceiveMessage_QuotedMsg_NotFound_DoesNotSet(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{existsByIDResult: false}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.QuotedMsgID = "nonexistent-msg"

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Message.QuotedMsgID != nil {
		t.Error("expected QuotedMsgID to be nil when message not found")
	}
}

func TestReceiveMessage_ImageMimetype_SetsLastMessageFoto(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.Body = ""
	input.Mimetype = "image/jpeg"

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Ticket.LastMessage != "📷 Foto" {
		t.Errorf("expected lastMessage '📷 Foto', got %q", result.Ticket.LastMessage)
	}
}

func TestReceiveMessage_AudioMimetype_SetsLastMessageAudio(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.Body = ""
	input.Mimetype = "audio/ogg"

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Ticket.LastMessage != "🎵 Áudio" {
		t.Errorf("expected lastMessage '🎵 Áudio', got %q", result.Ticket.LastMessage)
	}
}

func TestReceiveMessage_VideoMimetype_SetsLastMessageVideo(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.Body = ""
	input.Mimetype = "video/mp4"

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Ticket.LastMessage != "📹 Vídeo" {
		t.Errorf("expected lastMessage '📹 Vídeo', got %q", result.Ticket.LastMessage)
	}
}

func TestReceiveMessage_GenericMimetype_SetsLastMessageArquivo(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.Body = ""
	input.Mimetype = "application/pdf"

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Ticket.LastMessage != "📎 Arquivo" {
		t.Errorf("expected lastMessage '📎 Arquivo', got %q", result.Ticket.LastMessage)
	}
}

func TestReceiveMessage_WithBody_BodyTakesPrecedence(t *testing.T) {
	tenantID := uuid.New()
	existingTicket := &domain.Ticket{ID: 5, ContactID: 1, TenantID: tenantID}
	cr := &mockRcvContactRepo{contact: defaultContact()}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{openTicket: existingTicket}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.Body = "Texto real"
	input.Mimetype = "image/jpeg"

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Ticket.LastMessage != "Texto real" {
		t.Errorf("expected body to take precedence, got %q", result.Ticket.LastMessage)
	}
}

// capturingContactRepo records the profilePicUrl passed to FindOrCreate.
type capturingContactRepo struct {
	mockRcvContactRepo
	capturedProfilePicURL string
}

func (m *capturingContactRepo) FindOrCreate(_ context.Context, _ uuid.UUID, _, _, profilePicURL string, _ bool, _ bool, _ string) (*domain.Contact, error) {
	m.capturedProfilePicURL = profilePicURL
	return m.contact, m.findOrCreateErr
}

// TestReceiveMessage_Group_PassesGroupPhotoToContact verifies that when a
// group message arrives, the group's own profilePicUrl (fetched by group JID
// in the engine) is passed to FindOrCreate — so the group contact record keeps
// the group's actual avatar, not a participant's photo.
func TestReceiveMessage_Group_PassesGroupPhotoToContact(t *testing.T) {
	tenantID := uuid.New()
	cr := &capturingContactRepo{mockRcvContactRepo: mockRcvContactRepo{contact: defaultContact()}}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{}
	tr.ticket = &domain.Ticket{ID: 10, ContactID: 1, TenantID: tenantID}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.From = "120363425846044684@g.us"
	input.IsGroup = true
	input.GroupName = "OmniRoute"
	input.ProfilePicURL = "https://cdn.whatsapp.net/group-photo.jpg"

	uc := newReceiveUC(cr, tr, mr, eb)
	if _, err := uc.Execute(context.Background(), input); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cr.capturedProfilePicURL != input.ProfilePicURL {
		t.Errorf("group contact FindOrCreate should receive group's profilePicUrl %q, got %q", input.ProfilePicURL, cr.capturedProfilePicURL)
	}
}

// TestReceiveMessage_Group_StoresSenderPicInDataJson verifies that the
// individual sender's photo (senderPicUrl) is stored in dataJson separately
// from the group's profilePicUrl, so the frontend can show the right avatar
// inside the chat bubble without corrupting the group contact's photo.
func TestReceiveMessage_Group_StoresSenderPicInDataJson(t *testing.T) {
	tenantID := uuid.New()
	cr := &capturingContactRepo{mockRcvContactRepo: mockRcvContactRepo{contact: defaultContact()}}
	mr := &mockMessageRepo{}
	tr := &receiveTicketRepo{}
	tr.ticket = &domain.Ticket{ID: 10, ContactID: 1, TenantID: tenantID}
	eb := &mockEventBus{}

	input := defaultInput(tenantID)
	input.From = "120363425846044684@g.us"
	input.IsGroup = true
	input.GroupName = "OmniRoute"
	input.PushName = "Felipe Sartori"
	input.ProfilePicURL = "https://cdn.whatsapp.net/group-photo.jpg"
	input.SenderPicURL = "https://cdn.whatsapp.net/sender-photo.jpg"

	uc := newReceiveUC(cr, tr, mr, eb)
	result, err := uc.Execute(context.Background(), input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var data map[string]interface{}
	if err := json.Unmarshal([]byte(result.Message.DataJson), &data); err != nil {
		t.Fatalf("dataJson invalid: %v", err)
	}
	if data["senderPicUrl"] != input.SenderPicURL {
		t.Errorf("expected dataJson.senderPicUrl=%q, got %q", input.SenderPicURL, data["senderPicUrl"])
	}
	if data["pushName"] != input.PushName {
		t.Errorf("expected dataJson.pushName=%q, got %q", input.PushName, data["pushName"])
	}
	// group photo must NOT leak into dataJson
	if data["profilePicUrl"] != nil {
		t.Errorf("expected dataJson to not contain profilePicUrl, got %v", data["profilePicUrl"])
	}
}

func TestJidNumber(t *testing.T) {
	cases := []struct {
		jid  string
		want string
	}{
		{"5511999999999@s.whatsapp.net", "5511999999999"},
		{"5511999999999:10@s.whatsapp.net", "5511999999999"},
		{"", ""},
		{"noatsign", "noatsign"},
	}
	for _, c := range cases {
		got := jidNumber(c.jid)
		if got != c.want {
			t.Errorf("jidNumber(%q) = %q, want %q", c.jid, got, c.want)
		}
	}
}
