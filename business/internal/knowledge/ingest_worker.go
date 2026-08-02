package knowledge

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"github.com/streadway/amqp"
	"gorm.io/gorm"
)

const ingestQueueName = "knowledge.ingest"

// JobQueue is the AMQP surface the worker needs: consume ingestion jobs and
// publish status events. Satisfied by *services.RabbitMQService; kept as a
// local interface so this package doesn't import internal/services (and so
// tests can inject a fake).
type JobQueue interface {
	ConsumeKnowledgeJobs(queueName string, routingKeys []string, handler func(amqp.Delivery) error) error
	PublishKnowledgeEvent(routingKey string, payload interface{}) error
}

// ObjectDownloader is the subset of domain.ObjectStore the worker needs to
// read an uploaded file's bytes.
type ObjectDownloader interface {
	Download(ctx context.Context, key string) (io.ReadCloser, error)
}

// jobMessage mirrors the payload published by CreateSource/ReingestSource in
// internal/controllers/knowledge_base_mutation.go — the wire contract is
// unchanged from the old watink-knowledge service, so no frontend/controller
// changes are needed to switch consumers.
type jobMessage struct {
	TenantID        string `json:"tenantId"`
	KnowledgeBaseID int    `json:"knowledgeBaseId"`
	SourceID        int    `json:"sourceId"`
	Type            string `json:"type"` // "text" | "url" | "file"
	Payload         struct {
		Text      string `json:"text"`
		URL       string `json:"url"`
		ObjectKey string `json:"objectKey"`
		FileName  string `json:"fileName"`
	} `json:"payload"`
}

// IngestWorker consumes knowledge.ingest jobs and runs the full
// fetch/parse/chunk/embed/store pipeline in-process — replacing the
// watink-knowledge Python worker, whose event loop shared a single process
// with its HTTP server (so any ingestion in flight starved /retrieve). Here,
// each job runs in its own AMQP consumer goroutine; retrieval is a separate
// code path (retriever.go) with its own DB connection, so the two never
// contend for the same event loop.
type IngestWorker struct {
	db    *gorm.DB
	queue JobQueue
	store ObjectDownloader
	embed *embedClient
}

func NewIngestWorker(db *gorm.DB, queue JobQueue, store ObjectDownloader) *IngestWorker {
	return &IngestWorker{db: db, queue: queue, store: store, embed: newEmbedClient()}
}

// Start begins consuming knowledge.ingest. Non-blocking: the AMQP client runs
// the consume loop in its own goroutine (see ConsumeKnowledgeJobs).
func (w *IngestWorker) Start() error {
	return w.queue.ConsumeKnowledgeJobs(ingestQueueName, []string{"knowledge.*.ingest"}, w.handleDelivery)
}

// handleDelivery parses and validates the envelope, then processes the job.
// A malformed envelope (bad JSON, tenant mismatch) returns an error so the
// message is nacked/DLQ'd — it can never be turned into a valid source
// update. Any failure *after* that point (fetch/parse/embed) is caught and
// turned into a "error" status update on the source instead of propagating,
// so one bad document never blocks or crashes the worker, and the job is
// acked (retrying a permanently-broken URL forever helps no one — the UI's
// "Tentar novamente" button exists for that).
func (w *IngestWorker) handleDelivery(d amqp.Delivery) error {
	var job jobMessage
	if err := json.Unmarshal(d.Body, &job); err != nil {
		return fmt.Errorf("invalid job payload: %w", err)
	}

	// Routing key is "knowledge.<tenantId>.ingest" — the authority for which
	// tenant this job belongs to (same invariant the Python service enforced;
	// the body alone must never be trusted as the sole tenant source).
	rkParts := strings.Split(d.RoutingKey, ".")
	if len(rkParts) != 3 || rkParts[0] != "knowledge" || rkParts[2] != "ingest" {
		return fmt.Errorf("unexpected routing key %q", d.RoutingKey)
	}
	if rkParts[1] != job.TenantID {
		return fmt.Errorf("tenant mismatch: routing key %q vs body %q", rkParts[1], job.TenantID)
	}

	tenantID, err := uuid.Parse(job.TenantID)
	if err != nil {
		return fmt.Errorf("invalid tenantId: %w", err)
	}

	w.processJob(context.Background(), tenantID, job)
	return nil
}

func (w *IngestWorker) processJob(ctx context.Context, tenantID uuid.UUID, job jobMessage) {
	w.publishStatus(tenantID, job.SourceID, "processing", "", 0)

	text, err := w.fetchDocument(ctx, job)
	if err != nil {
		w.fail(tenantID, job.SourceID, err.Error())
		return
	}

	hash := contentHash(text)

	var source models.KnowledgeBaseSource
	if err := w.db.Where(`id = ? AND "tenantId" = ?`, job.SourceID, tenantID).First(&source).Error; err != nil {
		w.fail(tenantID, job.SourceID, "source not found")
		return
	}

	// Unchanged content since the last successful ingestion: skip the
	// (costly) chunk+embed+store cycle entirely and just report ready again.
	// This is what makes reingest of an unchanged page/file cheap.
	if source.ContentHash != "" && source.ContentHash == hash {
		w.markReady(tenantID, &source, source.ChunkCount, hash)
		return
	}

	chunks := ChunkText(text, job.Payload.URL)
	if len(chunks) == 0 {
		w.fail(tenantID, job.SourceID, "ERR_NO_CHUNKS: sem texto extraível")
		return
	}

	cfg, ok := tenantEmbedConfig(w.db, tenantID)
	if !ok {
		w.fail(tenantID, job.SourceID, "ERR_NO_EMBEDDING_CONFIG: configure o modelo de embedding em Configurações")
		return
	}

	texts := make([]string, len(chunks))
	for i, c := range chunks {
		texts[i] = c.Text
	}
	vectors, err := w.embed.EmbedTexts(ctx, cfg, texts)
	if err != nil {
		w.fail(tenantID, job.SourceID, fmt.Sprintf("ERR_EMBEDDING_FAILED: %v", err))
		return
	}

	stored, err := w.storeChunks(ctx, tenantID, job.KnowledgeBaseID, job.SourceID, chunks, vectors, cfg)
	if err != nil {
		w.fail(tenantID, job.SourceID, fmt.Sprintf("ERR_STORE_FAILED: %v", err))
		return
	}

	source.RawContent = ""
	if job.Type == "text" {
		// Persisted so ReingestSource can replay it later — the old service
		// only ever had the text inside the (transient) AMQP message.
		source.RawContent = job.Payload.Text
	}
	w.markReady(tenantID, &source, stored, hash)
}

// fetchDocument dispatches by job type to get the raw extracted text.
func (w *IngestWorker) fetchDocument(ctx context.Context, job jobMessage) (string, error) {
	switch job.Type {
	case "text":
		text := strings.TrimSpace(job.Payload.Text)
		if text == "" {
			return "", fmt.Errorf("ERR_EMPTY_TEXT: fonte de texto vazia")
		}
		return text, nil
	case "url":
		doc, err := FetchURL(ctx, job.Payload.URL)
		if err != nil {
			return "", err
		}
		return doc.Text, nil
	case "file":
		return w.fetchFile(ctx, job)
	default:
		return "", fmt.Errorf("ERR_UNKNOWN_JOB_TYPE: %q", job.Type)
	}
}

func (w *IngestWorker) fetchFile(ctx context.Context, job jobMessage) (string, error) {
	if w.store == nil {
		return "", fmt.Errorf("ERR_NO_OBJECT_STORE")
	}
	rc, err := w.store.Download(ctx, job.Payload.ObjectKey)
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	defer func() { _ = rc.Close() }()

	data, err := io.ReadAll(rc)
	if err != nil {
		return "", fmt.Errorf("read: %w", err)
	}

	ext := strings.ToLower(fileExt(job.Payload.FileName))
	switch ext {
	case "pdf":
		return ParsePDF(data)
	case "docx":
		return ParseDOCX(data)
	case "xlsx":
		return ParseXLSX(data)
	case "csv":
		return ParseCSV(data)
	default: // txt, md, and anything else treated as plain text
		return ParseText(data)
	}
}

func fileExt(name string) string {
	i := strings.LastIndex(name, ".")
	if i < 0 || i == len(name)-1 {
		return ""
	}
	return name[i+1:]
}

// storeChunks writes the new chunk set transactionally: an advisory lock
// scoped to this tenant+source serializes concurrent reingest of the same
// source, then old chunks are deleted and the new ones inserted. Returns the
// count of rows actually inserted (post ON CONFLICT), not len(chunks) — the
// old service reported chunkCount from the pre-insert slice, which could
// overcount when content hashed to an existing row.
func (w *IngestWorker) storeChunks(ctx context.Context, tenantID uuid.UUID, kbID, sourceID int, chunks []Chunk, vectors [][]float32, cfg EmbedConfig) (int, error) {
	if len(chunks) != len(vectors) {
		return 0, fmt.Errorf("chunk/vector count mismatch: %d vs %d", len(chunks), len(vectors))
	}

	tx := w.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return 0, tx.Error
	}
	defer tx.Rollback()

	lockKey := fmt.Sprintf("%s:%d", tenantID.String(), sourceID)
	if err := tx.Exec(`SELECT pg_advisory_xact_lock(hashtext(?))`, lockKey).Error; err != nil {
		return 0, fmt.Errorf("advisory lock: %w", err)
	}

	if err := tx.Exec(`DELETE FROM "KBChunk" WHERE "tenantId" = ? AND "sourceId" = ?`, tenantID, sourceID).Error; err != nil {
		return 0, fmt.Errorf("delete old chunks: %w", err)
	}

	inserted := 0
	for i, c := range chunks {
		metadata, _ := json.Marshal(map[string]any{"heading": c.Heading})
		res := tx.Exec(
			`INSERT INTO "KBChunk" ("tenantId","knowledgeBaseId","sourceId",content,"contentHash",embedding,model,dim,ordinal,metadata)
			 VALUES (?,?,?,?,?,?::halfvec,?,?,?,?)
			 ON CONFLICT ("tenantId","knowledgeBaseId","sourceId","contentHash") DO NOTHING`,
			tenantID, kbID, sourceID, c.Text, contentHash(c.Text), vectorLiteral(vectors[i]), cfg.Model, len(vectors[i]), i, string(metadata),
		)
		if res.Error != nil {
			return 0, fmt.Errorf("insert chunk %d: %w", i, res.Error)
		}
		inserted += int(res.RowsAffected)
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}
	return inserted, nil
}

func (w *IngestWorker) markReady(tenantID uuid.UUID, source *models.KnowledgeBaseSource, chunkCount int, hash string) {
	if err := w.db.Session(&gorm.Session{NewDB: true}).Model(source).Updates(map[string]interface{}{
		"status":         "ready",
		"lastError":      "",
		"chunkCount":     chunkCount,
		"contentHash":    hash,
		"rawContent":     source.RawContent,
		"lastIngestedAt": gorm.Expr("now()"),
	}).Error; err != nil {
		log.Printf("[IngestWorker] failed to mark source %d ready: %v", source.ID, err)
	}
	w.publishStatus(tenantID, source.ID, "ready", "", chunkCount)
}

func (w *IngestWorker) fail(tenantID uuid.UUID, sourceID int, msg string) {
	if err := w.db.Exec(
		`UPDATE "KnowledgeBaseSources" SET status = 'error', "lastError" = ? WHERE id = ? AND "tenantId" = ?`,
		msg, sourceID, tenantID,
	).Error; err != nil {
		log.Printf("[IngestWorker] failed to mark source %d error: %v", sourceID, err)
	}
	w.publishStatus(tenantID, sourceID, "error", msg, 0)
}

func (w *IngestWorker) publishStatus(tenantID uuid.UUID, sourceID int, status, lastError string, chunkCount int) {
	if w.queue == nil {
		return
	}
	err := w.queue.PublishKnowledgeEvent(
		fmt.Sprintf("knowledge.%s.status", tenantID.String()),
		map[string]interface{}{
			"tenantId":   tenantID.String(),
			"sourceId":   sourceID,
			"status":     status,
			"lastError":  lastError,
			"chunkCount": chunkCount,
		},
	)
	if err != nil {
		log.Printf("[IngestWorker] failed to publish status for source %d: %v", sourceID, err)
	}
}

func contentHash(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}
