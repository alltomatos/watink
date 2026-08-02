package knowledge

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// overFetchFactor over-fetches candidates before applying minScore, so the
// score filter runs BEFORE the final topK cut instead of after — the old
// Python service applied LIMIT topK first and only then dropped low-score
// rows, so a weak top-6 could hide a strong 7th chunk. Retrieve fetches
// topK*overFetchFactor first, filters by score, then truncates to topK.
const overFetchFactor = 3

type chunkCandidate struct {
	Content  string  `gorm:"column:content"`
	SourceID int     `gorm:"column:sourceId"`
	Ordinal  int     `gorm:"column:ordinal"`
	Score    float64 `gorm:"column:score"`
}

// PgVectorRetriever implements flow.Retriever directly against Postgres/pgvector,
// replacing the HTTP call to the watink-knowledge Python service. It embeds the
// query with the tenant's configured model, then does a single SELECT against
// KBChunk — tenant/kb scoped, filtered to the tenant's current embedding model
// (chunks from a since-changed model are excluded rather than mixed in, which
// used to return semantically random results silently) and iterative HNSW scan
// enabled so the tenant filter doesn't starve recall.
type PgVectorRetriever struct {
	db    *gorm.DB
	embed *embedClient
}

func NewPgVectorRetriever(db *gorm.DB) *PgVectorRetriever {
	return &PgVectorRetriever{db: db, embed: newEmbedClient()}
}

func (r *PgVectorRetriever) Retrieve(ctx context.Context, tenantID uuid.UUID, kbID, topK int, minScore float64, query string) ([]flow.RetrievedChunk, error) {
	if topK <= 0 {
		topK = 6
	}

	cfg, ok := tenantEmbedConfig(r.db, tenantID)
	if !ok {
		return nil, fmt.Errorf("ERR_NO_EMBEDDING_CONFIG")
	}

	vectors, err := r.embed.EmbedTexts(ctx, cfg, []string{query})
	if err != nil || len(vectors) != 1 {
		return nil, fmt.Errorf("embed query: %w", err)
	}
	queryVec := vectorLiteral(vectors[0])

	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer tx.Rollback()

	// hnsw.iterative_scan: without it, the HNSW index can return fewer than
	// topK rows after the tenant/kb WHERE filter is applied, because the
	// index prunes candidates before the filter runs — the recall collapse
	// that made "the right chunk" invisible to real questions.
	if err := tx.Exec(`SET LOCAL hnsw.iterative_scan = relaxed_order`).Error; err != nil {
		// Older pgvector without this GUC — degrade gracefully, don't fail retrieval.
		_ = err
	}

	var rows []chunkCandidate
	fetchLimit := topK * overFetchFactor
	err = tx.Raw(
		`SELECT content, "sourceId", ordinal, 1 - (embedding <=> ?::halfvec) AS score
		 FROM "KBChunk"
		 WHERE "tenantId" = ? AND "knowledgeBaseId" = ? AND model = ?
		 ORDER BY embedding <=> ?::halfvec
		 LIMIT ?`,
		queryVec, tenantID, kbID, cfg.Model, queryVec, fetchLimit,
	).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("retrieve: %w", err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	chunks := make([]flow.RetrievedChunk, 0, topK)
	for _, row := range rows {
		if row.Score < minScore {
			continue
		}
		chunks = append(chunks, flow.RetrievedChunk{
			Text:     row.Content,
			SourceID: row.SourceID,
			Score:    row.Score,
			Citation: fmt.Sprintf("fonte %d, trecho %d", row.SourceID, row.Ordinal),
		})
		if len(chunks) == topK {
			break
		}
	}
	return chunks, nil
}

// vectorLiteral renders a []float32 as a pgvector literal ("[0.1,0.2,...]"),
// the format pgvector's halfvec input parser accepts.
func vectorLiteral(v []float32) string {
	parts := make([]string, len(v))
	for i, f := range v {
		parts[i] = strconv.FormatFloat(float64(f), 'f', -1, 32)
	}
	return "[" + strings.Join(parts, ",") + "]"
}
