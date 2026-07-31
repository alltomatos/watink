package services

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/infrastructure/repository"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// --- Test helpers ---

func setupEventListenerRepos(t *testing.T) (*gorm.DB, domain.ChannelSessionRepository, domain.MessageRepository) {
	t.Helper()
	db := testutil.NewTestDB(t)
	return db, repository.NewGORMChannelSessionRepo(db), repository.NewGORMMessageRepo(db)
}

func seedWhatsapp(t *testing.T, db *gorm.DB, id int, tenantID uuid.UUID) {
	t.Helper()
	wa := models.Whatsapp{
		ID:       id,
		Name:     "test-session-" + string(rune('0'+id)),
		Status:   "CONNECTED",
		TenantID: tenantID,
	}
	if err := db.Create(&wa).Error; err != nil {
		t.Fatalf("seedWhatsapp: %v", err)
	}
}

// --- getSessionID (pure, offline) ---

func TestGetSessionID(t *testing.T) {
	cases := []struct {
		input string
		want  int
	}{
		{"42", 42},
		{"0", 0},
		{"abc", 0},
		{"", 0},
		{"uuid-tenant-99", 99},
	}
	for _, tc := range cases {
		got := getSessionID(tc.input)
		if got != tc.want {
			t.Errorf("getSessionID(%q) = %d, want %d", tc.input, got, tc.want)
		}
	}
}

// --- handleQrCode ---

func TestHandleQrCode_UpdatesWhatsapp(t *testing.T) {
	db, sessions, _ := setupEventListenerRepos(t)
	tenantID := uuid.New()
	seedWhatsapp(t, db, 1, tenantID)

	el := &EventListener{sessions: sessions}
	payload, _ := json.Marshal(map[string]string{"sessionId": "1", "qrCode": "data:image/png;base64,abc=="})
	if err := el.handleQrCode(context.Background(), payload, tenantID); err != nil {
		t.Fatalf("handleQrCode() error: %v", err)
	}

	var wa models.Whatsapp
	db.First(&wa, 1)
	if wa.Status != "QRCODE" {
		t.Errorf("expected status QRCODE, got %s", wa.Status)
	}
}

func TestHandleQrCode_InvalidJSON(t *testing.T) {
	el := &EventListener{}
	err := el.handleQrCode(context.Background(), json.RawMessage(`{bad json`), uuid.New())
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}

// --- handleSessionStatus ---

func TestHandleSessionStatus_UpdatesStatus(t *testing.T) {
	db, sessions, _ := setupEventListenerRepos(t)
	tenantID := uuid.New()
	seedWhatsapp(t, db, 2, tenantID)

	el := &EventListener{sessions: sessions}
	payload, _ := json.Marshal(map[string]string{"sessionId": "2", "status": "DISCONNECTED", "number": "+5511999999999"})
	if err := el.handleSessionStatus(context.Background(), payload, tenantID); err != nil {
		t.Fatalf("handleSessionStatus() error: %v", err)
	}

	var wa models.Whatsapp
	db.First(&wa, 2)
	if wa.Status != "DISCONNECTED" {
		t.Errorf("expected status DISCONNECTED, got %s", wa.Status)
	}
}

func TestHandleSessionStatus_InvalidJSON(t *testing.T) {
	el := &EventListener{}
	err := el.handleSessionStatus(context.Background(), json.RawMessage(`{bad`), uuid.New())
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}

func TestHandleSessionStatus_NoRowsAffected(t *testing.T) {
	_, sessions, _ := setupEventListenerRepos(t)
	// session does not exist — should return nil (no-op)
	el := &EventListener{sessions: sessions}
	payload, _ := json.Marshal(map[string]string{"sessionId": "999", "status": "CONNECTED"})
	if err := el.handleSessionStatus(context.Background(), payload, uuid.New()); err != nil {
		t.Fatalf("handleSessionStatus() with missing row returned error: %v", err)
	}
}

// BANNED → the connection's proxy is auto-isolated (removed from rotation pool).
func TestHandleSessionStatus_BannedIsolatesProxy(t *testing.T) {
	db, sessions, _ := setupEventListenerRepos(t)
	tenantID := uuid.New()
	proxy := models.Proxy{TenantID: tenantID, Scheme: "http", Host: "h", Port: 8080, Status: "active"}
	if err := db.Create(&proxy).Error; err != nil {
		t.Fatalf("seed proxy: %v", err)
	}
	wa := models.Whatsapp{ID: 3, Name: "s3", Status: "CONNECTED", TenantID: tenantID, ProxyMode: "single", ProxyID: &proxy.ID}
	if err := db.Create(&wa).Error; err != nil {
		t.Fatalf("seed wa: %v", err)
	}

	el := &EventListener{sessions: sessions, db: db}
	payload, _ := json.Marshal(map[string]string{"sessionId": "3", "status": "BANNED"})
	if err := el.handleSessionStatus(context.Background(), payload, tenantID); err != nil {
		t.Fatalf("handleSessionStatus: %v", err)
	}

	var reloaded models.Proxy
	db.First(&reloaded, proxy.ID)
	if reloaded.Status != "isolated" {
		t.Fatalf("expected proxy isolated after ban, got %q", reloaded.Status)
	}
	var wre models.Whatsapp
	db.First(&wre, 3)
	if wre.Status != "BANNED" {
		t.Fatalf("expected connection BANNED, got %q", wre.Status)
	}
}

// --- handleSessionRisk ---

// code 463 (rate-overlimit) is a strong ban/throttle signal — must
// auto-isolate the connection's proxy the same way BANNED does.
func TestHandleSessionRisk_463IsolatesProxy(t *testing.T) {
	db, sessions, _ := setupEventListenerRepos(t)
	tenantID := uuid.New()
	proxy := models.Proxy{TenantID: tenantID, Scheme: "http", Host: "h", Port: 8080, Status: "active"}
	if err := db.Create(&proxy).Error; err != nil {
		t.Fatalf("seed proxy: %v", err)
	}
	wa := models.Whatsapp{ID: 5, Name: "s5", Status: "CONNECTED", TenantID: tenantID, ProxyMode: "single", ProxyID: &proxy.ID}
	if err := db.Create(&wa).Error; err != nil {
		t.Fatalf("seed wa: %v", err)
	}

	el := &EventListener{sessions: sessions, db: db}
	payload, _ := json.Marshal(SessionRiskPayload{SessionID: 5, Action: "message.send", Code: 463, Message: "info query returned status 463: rate-overlimit"})
	if err := el.handleSessionRisk(context.Background(), payload, tenantID); err != nil {
		t.Fatalf("handleSessionRisk: %v", err)
	}

	var reloaded models.Proxy
	db.First(&reloaded, proxy.ID)
	if reloaded.Status != "isolated" {
		t.Fatalf("expected proxy isolated after code 463, got %q", reloaded.Status)
	}
}

// code 401 is surfaced but must NOT auto-isolate — it isn't an IP/volume
// signal, isolating the proxy wouldn't address it.
func TestHandleSessionRisk_401DoesNotIsolateProxy(t *testing.T) {
	db, sessions, _ := setupEventListenerRepos(t)
	tenantID := uuid.New()
	proxy := models.Proxy{TenantID: tenantID, Scheme: "http", Host: "h", Port: 8080, Status: "active"}
	db.Create(&proxy)
	wa := models.Whatsapp{ID: 6, Name: "s6", Status: "CONNECTED", TenantID: tenantID, ProxyMode: "single", ProxyID: &proxy.ID}
	db.Create(&wa)

	el := &EventListener{sessions: sessions, db: db}
	payload, _ := json.Marshal(SessionRiskPayload{SessionID: 6, Action: "profile.picture", Code: 401, Message: "info query returned status 401: not-authorized"})
	if err := el.handleSessionRisk(context.Background(), payload, tenantID); err != nil {
		t.Fatalf("handleSessionRisk: %v", err)
	}

	var reloaded models.Proxy
	db.First(&reloaded, proxy.ID)
	if reloaded.Status != "active" {
		t.Fatalf("proxy should stay active on code 401, got %q", reloaded.Status)
	}
}

// The risk signal must be persisted on the connection row, so the Conexões
// page can still show it after the live SSE event has been missed.
func TestHandleSessionRisk_PersistsLastRiskFields(t *testing.T) {
	db, sessions, _ := setupEventListenerRepos(t)
	tenantID := uuid.New()
	seedWhatsapp(t, db, 7, tenantID)

	el := &EventListener{sessions: sessions, db: db}
	payload, _ := json.Marshal(SessionRiskPayload{SessionID: 7, Action: "message.send", Code: 463, Message: "info query returned status 463: rate-overlimit"})
	if err := el.handleSessionRisk(context.Background(), payload, tenantID); err != nil {
		t.Fatalf("handleSessionRisk: %v", err)
	}

	var wa models.Whatsapp
	db.First(&wa, 7)
	if wa.LastRiskCode != 463 {
		t.Errorf("LastRiskCode = %d, want 463", wa.LastRiskCode)
	}
	if wa.LastRiskAction != "message.send" {
		t.Errorf("LastRiskAction = %q, want message.send", wa.LastRiskAction)
	}
	if wa.LastRiskAt == nil {
		t.Fatal("LastRiskAt should be set")
	}
}

func TestHandleSessionRisk_InvalidJSON(t *testing.T) {
	el := &EventListener{}
	err := el.handleSessionRisk(context.Background(), json.RawMessage(`{bad`), uuid.New())
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}

// A non-ban status must NOT isolate the proxy.
func TestHandleSessionStatus_DisconnectKeepsProxyActive(t *testing.T) {
	db, sessions, _ := setupEventListenerRepos(t)
	tenantID := uuid.New()
	proxy := models.Proxy{TenantID: tenantID, Scheme: "http", Host: "h", Port: 8080, Status: "active"}
	db.Create(&proxy)
	wa := models.Whatsapp{ID: 4, Name: "s4", Status: "CONNECTED", TenantID: tenantID, ProxyMode: "single", ProxyID: &proxy.ID}
	db.Create(&wa)

	el := &EventListener{sessions: sessions, db: db}
	payload, _ := json.Marshal(map[string]string{"sessionId": "4", "status": "DISCONNECTED"})
	if err := el.handleSessionStatus(context.Background(), payload, tenantID); err != nil {
		t.Fatalf("handleSessionStatus: %v", err)
	}

	var reloaded models.Proxy
	db.First(&reloaded, proxy.ID)
	if reloaded.Status != "active" {
		t.Fatalf("proxy should stay active on plain disconnect, got %q", reloaded.Status)
	}
}

// --- handlePairingCode ---

func TestHandlePairingCode_UpdatesStatus(t *testing.T) {
	db, sessions, _ := setupEventListenerRepos(t)
	tenantID := uuid.New()
	seedWhatsapp(t, db, 3, tenantID)

	el := &EventListener{sessions: sessions}
	payload, _ := json.Marshal(map[string]string{"sessionId": "3", "status": "PAIRING", "pairingCode": "ABC-123"})
	if err := el.handlePairingCode(context.Background(), payload, tenantID); err != nil {
		t.Fatalf("handlePairingCode() error: %v", err)
	}

	var wa models.Whatsapp
	db.First(&wa, 3)
	if wa.Status != "PAIRING" {
		t.Errorf("expected status PAIRING, got %s", wa.Status)
	}
}

func TestHandlePairingCode_DefaultStatus(t *testing.T) {
	db, sessions, _ := setupEventListenerRepos(t)
	tenantID := uuid.New()
	seedWhatsapp(t, db, 4, tenantID)

	// No status field — should default to "QRCODE"
	el := &EventListener{sessions: sessions}
	payload, _ := json.Marshal(map[string]string{"sessionId": "4", "pairingCode": "XYZ-789"})
	if err := el.handlePairingCode(context.Background(), payload, tenantID); err != nil {
		t.Fatalf("handlePairingCode() error: %v", err)
	}

	var wa models.Whatsapp
	db.First(&wa, 4)
	if wa.Status != "QRCODE" {
		t.Errorf("expected default status QRCODE, got %s", wa.Status)
	}
}

// --- mock repos for offline handleMessageAck unit tests ---

type ackMockMessageRepo struct {
	msg     *domain.Message
	findErr error
	updated bool
}

func (m *ackMockMessageRepo) Create(_ context.Context, _ *domain.Message) error { return nil }
func (m *ackMockMessageRepo) CreateIfNotExists(_ context.Context, _ *domain.Message) error {
	return nil
}
func (m *ackMockMessageRepo) FindByID(_ context.Context, _ string, _ uuid.UUID) (*domain.Message, error) {
	return m.msg, m.findErr
}
func (m *ackMockMessageRepo) FindOldestByTicket(_ context.Context, _ int, _ uuid.UUID) (*domain.Message, error) {
	return nil, nil
}
func (m *ackMockMessageRepo) ExistsByID(_ context.Context, _ string, _ uuid.UUID) (bool, error) {
	return false, nil
}
func (m *ackMockMessageRepo) Update(_ context.Context, _ *domain.Message, _ map[string]interface{}) error {
	m.updated = true
	return nil
}

type ackMockTicketRepo struct {
	ticket      *domain.Ticket
	findErr     error
	updateCalls int
}

func (m *ackMockTicketRepo) FindByID(_ context.Context, _ int, _ uuid.UUID) (*domain.Ticket, error) {
	return m.ticket, m.findErr
}
func (m *ackMockTicketRepo) FindOpenByContact(_ context.Context, _ uuid.UUID, _ int, _ int) (*domain.Ticket, error) {
	return nil, nil
}
func (m *ackMockTicketRepo) FindOrCreatePending(_ context.Context, t *domain.Ticket) (*domain.Ticket, error) {
	return t, nil
}
func (m *ackMockTicketRepo) Save(_ context.Context, _ *domain.Ticket) error { return nil }
func (m *ackMockTicketRepo) Update(_ context.Context, _ *domain.Ticket, _ map[string]interface{}) error {
	m.updateCalls++
	return nil
}
func (m *ackMockTicketRepo) FindLastAssignedInQueue(_ context.Context, _ int, _ uuid.UUID) (int, error) {
	return 0, nil
}
func (m *ackMockTicketRepo) CountOpenTicketsPerUser(_ context.Context, _ []int, _ uuid.UUID) (map[int]int64, error) {
	return nil, nil
}

// --- handleMessageAck / Revoke / Reaction / ContactUpdate (invalid JSON, offline) ---

func TestHandleMessageAck_InvalidJSON(t *testing.T) {
	el := &EventListener{}
	err := el.handleMessageAck(context.Background(), json.RawMessage(`{bad`), uuid.New())
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}

func TestHandleMessageAck_Ack3NotFromMe_ResetsUnread(t *testing.T) {
	tenantID := uuid.New()
	msg := &domain.Message{ID: "m1", TicketID: 10, Ack: 1, FromMe: false}
	ticket := &domain.Ticket{ID: 10, TenantID: tenantID, UnreadMessages: 3}
	mr := &ackMockMessageRepo{msg: msg}
	tr := &ackMockTicketRepo{ticket: ticket}

	el := &EventListener{messages: mr, tickets: tr}
	payload, _ := json.Marshal(map[string]interface{}{"messageId": "m1", "ack": 3})
	err := el.handleMessageAck(context.Background(), payload, tenantID)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !mr.updated {
		t.Error("expected message ack to be updated")
	}
	if tr.updateCalls == 0 {
		t.Error("expected ticket unreadMessages to be reset (Update called)")
	}
}

func TestHandleMessageAck_Ack3FromMe_NoUnreadReset(t *testing.T) {
	tenantID := uuid.New()
	msg := &domain.Message{ID: "m2", TicketID: 10, Ack: 1, FromMe: true}
	ticket := &domain.Ticket{ID: 10, TenantID: tenantID, UnreadMessages: 3}
	mr := &ackMockMessageRepo{msg: msg}
	tr := &ackMockTicketRepo{ticket: ticket}

	el := &EventListener{messages: mr, tickets: tr}
	payload, _ := json.Marshal(map[string]interface{}{"messageId": "m2", "ack": 3})
	err := el.handleMessageAck(context.Background(), payload, tenantID)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tr.updateCalls != 0 {
		t.Errorf("expected ticket NOT to be updated for fromMe=true, but got %d update calls", tr.updateCalls)
	}
}

func TestHandleMessageAck_LowAck_NoUnreadReset(t *testing.T) {
	tenantID := uuid.New()
	msg := &domain.Message{ID: "m3", TicketID: 10, Ack: 1, FromMe: false}
	ticket := &domain.Ticket{ID: 10, TenantID: tenantID, UnreadMessages: 2}
	mr := &ackMockMessageRepo{msg: msg}
	tr := &ackMockTicketRepo{ticket: ticket}

	el := &EventListener{messages: mr, tickets: tr}
	payload, _ := json.Marshal(map[string]interface{}{"messageId": "m3", "ack": 2})
	err := el.handleMessageAck(context.Background(), payload, tenantID)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tr.updateCalls != 0 {
		t.Errorf("expected ticket NOT to be updated for ack=2, but got %d update calls", tr.updateCalls)
	}
}

func TestHandleMessageRevoke_InvalidJSON(t *testing.T) {
	el := &EventListener{}
	err := el.handleMessageRevoke(context.Background(), json.RawMessage(`{bad`), uuid.New())
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}

func TestHandleMessageReaction_InvalidJSON(t *testing.T) {
	el := &EventListener{}
	err := el.handleMessageReaction(context.Background(), json.RawMessage(`{bad`), uuid.New())
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}

func TestHandleContactUpdate_InvalidJSON(t *testing.T) {
	err := handleContactUpdate(context.Background(), nil, nil, json.RawMessage(`{bad`), uuid.New())
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}

func TestJidToNumber(t *testing.T) {
	cases := map[string]string{
		"5511999999999@s.whatsapp.net":    "5511999999999",
		"5511999999999:12@s.whatsapp.net": "5511999999999",
		"5511999999999":                   "5511999999999",
		"":                                "",
	}
	for in, want := range cases {
		if got := jidToNumber(in); got != want {
			t.Errorf("jidToNumber(%q) = %q, want %q", in, got, want)
		}
	}
}
