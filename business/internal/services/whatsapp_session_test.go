package services

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// mockCommandPublisher is a test double for domain.CommandPublisher.
type mockCommandPublisher struct {
	lastRoutingKey string
	lastPayload    interface{}
}

func (m *mockCommandPublisher) PublishCommand(routingKey string, payload interface{}) error {
	m.lastRoutingKey = routingKey
	m.lastPayload = payload
	return nil
}

// mockRedisService is a test double for domain.RedisService.
type mockRedisService struct{}

func (m *mockRedisService) SetLock(key string, value string, expiration time.Duration) (bool, error) {
	return true, nil
}
func (m *mockRedisService) DelLock(key string) error { return nil }
func (m *mockRedisService) Subscribe(ctx context.Context, channel string) *redis.PubSub {
	return nil
}
func (m *mockRedisService) Publish(ctx context.Context, channel string, message interface{}) error {
	return nil
}
func (m *mockRedisService) Ping(ctx context.Context) error { return nil }
func (m *mockRedisService) Get(ctx context.Context, key string) (string, error) {
	return "", nil
}

// Verify mocks satisfy interfaces at compile time.
var _ domain.CommandPublisher = (*mockCommandPublisher)(nil)
var _ domain.RedisService = (*mockRedisService)(nil)

// TestStopWhatsAppSession_PublishesStop verifies StopWhatsAppSession publishes the right command.
func TestStopWhatsAppSession_PublishesStop(t *testing.T) {
	db := testutil.NewTestDB(t)
	pub := &mockCommandPublisher{}
	mockRedis := &mockRedisService{}
	mockBroadcast := NewRedisBroadcast(mockRedis, nil)
	wss := NewWhatsAppSessionService(db, pub, mockRedis, mockBroadcast)

	tenantID := uuid.New()
	whatsapp := models.Whatsapp{ID: 99, TenantID: tenantID}

	if err := wss.StopWhatsAppSession(whatsapp); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expectedKey := "wbot." + tenantID.String() + ".99.session.stop"
	if pub.lastRoutingKey != expectedKey {
		t.Errorf("routing key = %q, want %q", pub.lastRoutingKey, expectedKey)
	}
}

// TestDeleteWhatsAppSession_PublishesDelete verifies DeleteWhatsAppSession publishes the right command.
func TestDeleteWhatsAppSession_PublishesDelete(t *testing.T) {
	db := testutil.NewTestDB(t)
	pub := &mockCommandPublisher{}
	mockRedis := &mockRedisService{}
	mockBroadcast := NewRedisBroadcast(mockRedis, nil)
	wss := NewWhatsAppSessionService(db, pub, mockRedis, mockBroadcast)

	tenantID := uuid.New()
	whatsapp := models.Whatsapp{ID: 55, TenantID: tenantID}

	if err := wss.DeleteWhatsAppSession(whatsapp); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expectedKey := "wbot." + tenantID.String() + ".55.session.delete"
	if pub.lastRoutingKey != expectedKey {
		t.Errorf("routing key = %q, want %q", pub.lastRoutingKey, expectedKey)
	}
}

// TestLegacyGlobalFunctions_ReturnErrors ensures legacy functions fail closed.
func TestLegacyGlobalFunctions_ReturnErrors(t *testing.T) {
	w := models.Whatsapp{}
	if err := StartWhatsAppSession(w, false, "", false); err == nil {
		t.Error("legacy StartWhatsAppSession should return error")
	}
	if err := StopWhatsAppSession(w); err == nil {
		t.Error("legacy StopWhatsAppSession should return error")
	}
	if err := DeleteWhatsAppSession(w); err == nil {
		t.Error("legacy DeleteWhatsAppSession should return error")
	}
}

// mockRedisServiceLockFails always fails to acquire the lock.
type mockRedisServiceLockFails struct{ mockRedisService }

func (m *mockRedisServiceLockFails) SetLock(key string, value string, expiration time.Duration) (bool, error) {
	return false, nil
}

// mockRedisServiceLockError returns an error on SetLock.
type mockRedisServiceLockError struct{ mockRedisService }

func (m *mockRedisServiceLockError) SetLock(key string, value string, expiration time.Duration) (bool, error) {
	return false, fmt.Errorf("redis unavailable")
}

// newTestDBWithWhatsapp opens a PostgreSQL test DB with the Whatsapp table migrated.
func newTestDBWithWhatsapp(t *testing.T) (*gorm.DB, models.Whatsapp) {
	t.Helper()
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	w := models.Whatsapp{ID: 1, TenantID: tenantID, Name: "test-session"}
	if err := db.Create(&w).Error; err != nil {
		t.Fatalf("failed to seed Whatsapp: %v", err)
	}
	return db, w
}

// TestStartWhatsAppSession_HappyPath covers the full success path:
// lock acquired → DB update → broadcast → publish command.
func TestStartWhatsAppSession_HappyPath(t *testing.T) {
	db, whatsapp := newTestDBWithWhatsapp(t)
	pub := &mockCommandPublisher{}
	mockRedis := &mockRedisService{}
	broadcast := NewRedisBroadcast(mockRedis, nil)
	wss := NewWhatsAppSessionService(db, pub, mockRedis, broadcast)

	err := wss.StartWhatsAppSession(whatsapp, false, "+5511999999999", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedKey := fmt.Sprintf("wbot.%s.%d.session.start", whatsapp.TenantID, whatsapp.ID)
	if pub.lastRoutingKey != expectedKey {
		t.Errorf("routing key = %q, want %q", pub.lastRoutingKey, expectedKey)
	}

	cmd, ok := pub.lastPayload.(map[string]interface{})
	if !ok {
		t.Fatalf("payload is not map[string]interface{}, got %T", pub.lastPayload)
	}
	if cmd["type"] != "session.start" {
		t.Errorf("command type = %v, want session.start", cmd["type"])
	}
	payload, ok := cmd["payload"].(map[string]interface{})
	if !ok {
		t.Fatalf("payload.payload is not map[string]interface{}")
	}
	if payload["phoneNumber"] != "+5511999999999" {
		t.Errorf("phoneNumber = %v", payload["phoneNumber"])
	}
}

// TestStartWhatsAppSession_LockAlreadyAcquired verifies that a busy lock returns ERR_SESSION_STARTING_ALREADY.
func TestStartWhatsAppSession_LockAlreadyAcquired(t *testing.T) {
	db, whatsapp := newTestDBWithWhatsapp(t)
	pub := &mockCommandPublisher{}
	mockRedis := &mockRedisServiceLockFails{}
	broadcast := NewRedisBroadcast(&mockRedisService{}, nil)
	wss := NewWhatsAppSessionService(db, pub, mockRedis, broadcast)

	err := wss.StartWhatsAppSession(whatsapp, false, "", false)
	if err == nil {
		t.Fatal("expected error when lock already acquired")
	}
	if err.Error() != "ERR_SESSION_STARTING_ALREADY" {
		t.Errorf("error = %q, want ERR_SESSION_STARTING_ALREADY", err.Error())
	}
}

// TestStartWhatsAppSession_DBError verifies that a DB error is propagated after lock is acquired.
func TestStartWhatsAppSession_DBError(t *testing.T) {
	db, whatsapp := newTestDBWithWhatsapp(t)
	// Drop the table so the UPDATE fails with a DB error.
	if err := db.Exec(`DROP TABLE "Whatsapps"`).Error; err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}
	pub := &mockCommandPublisher{}
	mockRedis := &mockRedisService{}
	broadcast := NewRedisBroadcast(mockRedis, nil)
	wss := NewWhatsAppSessionService(db, pub, mockRedis, broadcast)

	err := wss.StartWhatsAppSession(whatsapp, false, "", false)
	if err == nil {
		t.Fatal("expected error when DB update fails")
	}
}

// TestStartWhatsAppSession_RedisError verifies that a Redis error is propagated.
func TestStartWhatsAppSession_RedisError(t *testing.T) {
	db, whatsapp := newTestDBWithWhatsapp(t)
	pub := &mockCommandPublisher{}
	mockRedis := &mockRedisServiceLockError{}
	broadcast := NewRedisBroadcast(&mockRedisService{}, nil)
	wss := NewWhatsAppSessionService(db, pub, mockRedis, broadcast)

	err := wss.StartWhatsAppSession(whatsapp, false, "", false)
	if err == nil {
		t.Fatal("expected error when Redis returns error")
	}
	if err.Error() != "redis unavailable" {
		t.Errorf("error = %q, want 'redis unavailable'", err.Error())
	}
}
