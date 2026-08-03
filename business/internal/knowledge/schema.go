// Package knowledge implements the native (in-process) RAG pipeline for the
// Watink core: pgvector schema, embeddings, retrieval, ingestion and agent
// runtime — replacing the watink-knowledge Python microservice.
package knowledge

import (
	"log"

	"gorm.io/gorm"
)

// EnsureSchema creates/repairs the KBChunk table and its indexes, idempotently,
// outside GORM's AutoMigrate (halfvec/HNSW columns are not modelable via GORM
// tags — same pattern as addCustomIndexes()/PostGIS in internal/database).
//
// Call once at boot, after AutoMigrate has created KnowledgeBases and
// KnowledgeBaseSources (KBChunk's FKs reference both). Failures are logged and
// non-fatal, matching the rest of the best-effort DDL in this codebase.
func EnsureSchema(db *gorm.DB) {
	if err := ensureSchema(db); err != nil {
		log.Printf("knowledge.EnsureSchema: %v", err)
	}
}

func ensureSchema(db *gorm.DB) error {
	// Orphaned chunks (no matching Source) predate the FK below — they were
	// left behind by the Python service, which never cascaded deletes. Clean
	// them up before adding the constraint, or the constraint creation fails.
	if err := db.Exec(`DELETE FROM "KBChunk" WHERE "sourceId" NOT IN (SELECT id FROM "KnowledgeBaseSources")`).Error; err != nil {
		// KBChunk may not exist yet on a fresh database — that's fine, the
		// CREATE TABLE below handles it. Any other error is logged by the
		// caller but doesn't block the rest of the DDL.
		log.Printf("knowledge.ensureSchema: orphan cleanup skipped: %v", err)
	}

	stmts := []string{
		`CREATE EXTENSION IF NOT EXISTS vector`,
		`CREATE TABLE IF NOT EXISTS "KBChunk" (
			id BIGSERIAL PRIMARY KEY,
			"tenantId" UUID NOT NULL,
			"knowledgeBaseId" INTEGER NOT NULL,
			"sourceId" INTEGER NOT NULL,
			content TEXT NOT NULL,
			"contentHash" TEXT NOT NULL,
			embedding halfvec(2048) NOT NULL,
			model TEXT NOT NULL,
			dim INTEGER NOT NULL,
			ordinal INTEGER NOT NULL,
			metadata JSONB,
			"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		// FKs added as separate ALTERs (not inline in CREATE TABLE) so a table
		// created by the old Python service without them can still be repaired
		// idempotently by re-running this function.
		`ALTER TABLE "KBChunk" DROP CONSTRAINT IF EXISTS kbchunk_kb_fk`,
		`ALTER TABLE "KBChunk" ADD CONSTRAINT kbchunk_kb_fk
			FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBases"(id) ON DELETE CASCADE`,
		`ALTER TABLE "KBChunk" DROP CONSTRAINT IF EXISTS kbchunk_source_fk`,
		`ALTER TABLE "KBChunk" ADD CONSTRAINT kbchunk_source_fk
			FOREIGN KEY ("sourceId") REFERENCES "KnowledgeBaseSources"(id) ON DELETE CASCADE`,
		`ALTER TABLE "KBChunk" ADD COLUMN IF NOT EXISTS metadata JSONB`,
		`CREATE INDEX IF NOT EXISTS kbchunk_tenant_kb_idx ON "KBChunk" ("tenantId","knowledgeBaseId")`,
		`CREATE INDEX IF NOT EXISTS kbchunk_source_idx ON "KBChunk" ("sourceId")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS kbchunk_dedup_idx ON "KBChunk" ("tenantId","knowledgeBaseId","sourceId","contentHash")`,
		`CREATE INDEX IF NOT EXISTS kbchunk_embedding_hnsw ON "KBChunk" USING hnsw (embedding halfvec_cosine_ops)`,
	}

	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			log.Printf("knowledge.ensureSchema: %q failed (best-effort, continuing): %v", stmt, err)
		}
	}
	return nil
}
