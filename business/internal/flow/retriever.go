package flow

import (
	"context"

	"github.com/google/uuid"
)

// RetrievedChunk is one context fragment returned by the knowledge retrieval
// service, with its source citation and similarity score.
type RetrievedChunk struct {
	Text     string
	SourceID int
	Score    float64
	Citation string
}

// Retriever fetches the top-K most relevant chunks for a query within a
// tenant's knowledge base. internal/knowledge.PgVectorRetriever is the native
// in-process implementation.
type Retriever interface {
	Retrieve(ctx context.Context, tenantID uuid.UUID, kbID, topK int, minScore float64, query string) ([]RetrievedChunk, error)
}
