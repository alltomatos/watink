package knowledge

import (
	"log"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"gorm.io/gorm"
)

// ModeEnvVar is the environment variable selecting the RAG implementation.
// "native" uses the in-process pgvector pipeline built in this package;
// anything else (including unset) keeps the existing HTTP calls to the
// watink-knowledge microservice — the safe default during the migration
// window, with instant rollback (env change, no redeploy of code) if the
// native path misbehaves in production.
const ModeEnvVar = "KNOWLEDGE_MODE"

// BuildRetrieverAndResponder returns the flow.Retriever/flow.AgentResponder
// pair for the given mode. Call once at boot and wire the result into every
// flow.Skeleton via SetRetriever/SetResponder — there are two Skeleton
// instances in this codebase today (services.EventListener's, for real
// inbound WhatsApp messages, and routes.go's, for the on-demand /flows/:id/run
// and playground endpoints), and both must be switched together or retrieval
// behavior would silently differ between the two entry points.
func BuildRetrieverAndResponder(mode string, db *gorm.DB) (flow.Retriever, flow.AgentResponder) {
	if mode == "native" {
		log.Println("[knowledge] KNOWLEDGE_MODE=native — using in-process pgvector RAG")
		retriever := NewPgVectorRetriever(db)
		responder := NewGoAgentResponder(db, retriever)
		return retriever, responder
	}
	log.Println("[knowledge] KNOWLEDGE_MODE=http (default) — using watink-knowledge microservice")
	return flow.NewHTTPRetrieverFromEnv(), flow.NewHTTPAgentClientFromEnv()
}
