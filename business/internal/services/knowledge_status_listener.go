package services

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	amqp "github.com/streadway/amqp"
	"gorm.io/gorm"
)

// KnowledgeStatusListener consumes ingestion status events emitted by the
// native ingest worker (internal/knowledge.IngestWorker.publishStatus) on the
// knowledge.events exchange and reflects them onto the KnowledgeBaseSources
// row, then broadcasts the change to the owning tenant over SSE. A separate
// consumer from the worker itself so the ingestion hot path never blocks on
// Broadcaster delivery.
//
// Tenant isolation: RLS is INERT in this worker path (the app never sets
// app.current_tenant), so every write carries WHERE "tenantId" MANUALLY and
// uses Session(NewDB:true). The tenant comes from the routing key
// (knowledge.<tenant>.status), never the body.
type KnowledgeStatusListener struct {
	db        *gorm.DB
	broadcast domain.Broadcaster
}

// NewKnowledgeStatusListener builds the listener with an injected DB and a
// nil-safe broadcaster.
func NewKnowledgeStatusListener(db *gorm.DB, broadcast domain.Broadcaster) *KnowledgeStatusListener {
	return &KnowledgeStatusListener{db: db, broadcast: domain.BroadcastOrNop(broadcast)}
}

// knowledgeStatusPayload is the body of a knowledge.events status message.
// tenantId is intentionally absent — it travels in the routing key.
type knowledgeStatusPayload struct {
	SourceID   int    `json:"sourceId"`
	Status     string `json:"status"`
	ChunkCount int    `json:"chunkCount"`
	Error      string `json:"error"`
}

// Start binds the listener to the knowledge.status.business queue and consumes
// the knowledge.*.status routing keys. The consumer is anything that can wire a
// knowledge-events consumer (the concrete RabbitMQService).
func (l *KnowledgeStatusListener) Start(consumer interface {
	ConsumeKnowledgeEvents(string, []string, func(amqp.Delivery) error) error
}) error {
	return consumer.ConsumeKnowledgeEvents(
		"knowledge.status.business",
		[]string{"knowledge.*.status"},
		l.handle,
	)
}

// handle reflects one status event onto the source row and broadcasts it.
// Returns an error only on a real parse/DB failure, so the DLQ can retry.
func (l *KnowledgeStatusListener) handle(d amqp.Delivery) error {
	var p knowledgeStatusPayload
	if err := json.Unmarshal(d.Body, &p); err != nil {
		log.Printf("[knowledge] bad status payload: %v", err)
		return err
	}

	// Extract the tenant from the routing key: knowledge.<tenant>.status.
	parts := strings.Split(d.RoutingKey, ".")
	if len(parts) < 3 {
		log.Printf("[knowledge] unexpected routing key %q — skipping", d.RoutingKey)
		return nil
	}
	tenant := parts[1]

	updates := map[string]interface{}{
		"status":     p.Status,
		"chunkCount": p.ChunkCount,
		"lastError":  p.Error,
		"updatedAt":  time.Now(),
	}
	if p.Status == "ready" {
		updates["lastIngestedAt"] = time.Now()
	}

	res := l.db.Session(&gorm.Session{NewDB: true}).
		Model(&models.KnowledgeBaseSource{}).
		Where(`id = ? AND "tenantId" = ?`, p.SourceID, tenant).
		Updates(updates)
	if res.Error != nil {
		log.Printf("[knowledge] failed to update source %d (tenant %s): %v", p.SourceID, tenant, res.Error)
		return res.Error
	}

	l.broadcast.EmitToTenantRoom(tenant, "knowledgeSource", map[string]interface{}{
		"action":     "update",
		"sourceId":   p.SourceID,
		"status":     p.Status,
		"chunkCount": p.ChunkCount,
		"lastError":  p.Error,
	})

	return nil
}
