package knowledge

import (
	"log"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"gorm.io/gorm"
)

// BuildRetrieverAndResponder returns the flow.Retriever/flow.AgentResponder
// pair backed by the native in-process pgvector pipeline (this package). Call
// once at boot and wire the result into every flow.Skeleton via
// SetRetriever/SetResponder — there are two Skeleton instances in this
// codebase today (services.EventListener's, for real inbound WhatsApp
// messages, and routes.go's, for the on-demand /flows/:id/run and playground
// endpoints), and both must be switched together or retrieval behavior would
// silently differ between the two entry points.
func BuildRetrieverAndResponder(db *gorm.DB) (flow.Retriever, flow.AgentResponder) {
	log.Println("[knowledge] using in-process pgvector RAG")
	retriever := NewPgVectorRetriever(db)
	responder := NewGoAgentResponder(db, retriever)
	return retriever, responder
}
