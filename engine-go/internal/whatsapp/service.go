package whatsapp

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/alltomatos/watinkdev/engine-go/internal/rabbitmq"
	_ "github.com/lib/pq"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
)

// WhatsAppService manages all active WhatsApp client sessions for a single engine-go instance.
type WhatsAppService struct {
	container     *sqlstore.Container
	clients       map[int]*whatsmeow.Client
	mu            sync.RWMutex
	rabbit        *rabbitmq.RabbitMQService
	sessionLoader SessionLoader

	historyMu       sync.Mutex
	historyRequests map[string]*pendingHistory

	groupNameMu  sync.Mutex
	groupNames   map[string]string
	groupMetaMu  sync.Mutex
	groupMetaMap map[string]groupMeta

	picMu    sync.Mutex
	picCache map[string]string // JID string → profile picture URL

	// publishEvent routes an event envelope to the messaging broker.
	// Settable in tests to capture emitted events without a real broker.
	publishEvent func(tenantID string, sessionID int, eventType string, payload map[string]interface{})
}

// groupMeta holds cached community/sub-group metadata for a group JID.
type groupMeta struct {
	isCommunity bool
	isSubGroup  bool
}

// NewWhatsAppService creates a WhatsAppService connecting whatsmeow to PostgreSQL via sqlstore.
func NewWhatsAppService(rabbit *rabbitmq.RabbitMQService, sessionLoader SessionLoader) *WhatsAppService {
	dbLog := waLog.Stdout("Database", "DEBUG", true)
	dsn := BuildPostgresDSN()

	container, err := sqlstore.New(context.Background(), "postgres", dsn, dbLog)
	if err != nil {
		log.Fatalf("Failed to connect to Postgres for WhatsMeow store: %v", err)
	}

	svc := &WhatsAppService{
		container:       container,
		clients:         make(map[int]*whatsmeow.Client),
		rabbit:          rabbit,
		sessionLoader:   sessionLoader,
		historyRequests: make(map[string]*pendingHistory),
		groupNames:      make(map[string]string),
		groupMetaMap:    make(map[string]groupMeta),
		picCache:        make(map[string]string),
	}
	svc.publishEvent = svc.defaultPublishEvent
	return svc
}

// getConnectedClient returns the client for sessionID if it is connected and logged in.
func (s *WhatsAppService) getConnectedClient(sessionID int) (*whatsmeow.Client, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	client, ok := s.clients[sessionID]
	if !ok || !client.IsConnected() || !client.IsLoggedIn() {
		return nil, fmt.Errorf("%w: session %d", ErrSessionNotConnected, sessionID)
	}
	return client, nil
}

// emitStatus publishes a session.status event to the backend.
func (s *WhatsAppService) emitStatus(id int, tenantID, status string) {
	s.publishEvent(tenantID, id, "session.status", map[string]interface{}{
		"sessionId": fmt.Sprintf("%d", id),
		"status":    status,
	})
}

// emitAck publishes a message.ack event (ack: 1=sent, 2=delivered, 3=read, 4=played, 5=error).
func (s *WhatsAppService) emitAck(sessionID int, tenantID, messageID string, ack int) {
	if messageID == "" {
		return
	}
	s.publishEvent(tenantID, sessionID, "message.ack", map[string]interface{}{
		"sessionId": fmt.Sprintf("%d", sessionID),
		"messageId": messageID,
		"ack":       ack,
	})
}

// defaultPublishEvent wraps payload in an envelope and routes it to wbot.events via RabbitMQ.
func (s *WhatsAppService) defaultPublishEvent(tenantID string, sessionID int, eventType string, payload map[string]interface{}) {
	envelope := map[string]interface{}{
		"id":        fmt.Sprintf("%d-%d", time.Now().UnixNano(), sessionID),
		"timestamp": time.Now().UnixMilli(),
		"tenantId":  tenantID,
		"type":      eventType,
		"payload":   eventPayloadWithTenant(tenantID, payload),
	}
	if err := s.rabbit.PublishEvent(fmt.Sprintf("wbot.%s.%d.%s", tenantID, sessionID, eventType), envelope); err != nil {
		log.Printf("Failed to publish %s for session %d: %v", eventType, sessionID, err)
	}
}

func BuildPostgresDSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASS"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)
}

func eventPayloadWithTenant(tenantID string, payload map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(payload)+1)
	for k, v := range payload {
		out[k] = v
	}
	out["tenantId"] = tenantID
	return out
}
