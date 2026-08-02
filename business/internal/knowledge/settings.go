package knowledge

import (
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// tenantEmbedConfig loads a tenant's embedding gateway config from Settings
// (manual WHERE "tenantId" — RLS is inert in worker/retrieval paths, per the
// module's documented invariant). Falls back to the general AI gateway
// (aiCustomBaseURL/aiApiKey) when no dedicated embedding gateway is set, same
// fallback the old Python service used. Dim is intentionally NOT hardcoded
// here — callers validate/derive it from what the gateway actually returns
// or from the last successfully embedded chunk for the tenant+model.
func tenantEmbedConfig(db *gorm.DB, tenantID uuid.UUID) (EmbedConfig, bool) {
	if db == nil {
		return EmbedConfig{}, false
	}
	// Session(NewDB:true): defensive, matching agent.go's agentMinScore —
	// callers may hand in a db already scoped to a different table.
	db = db.Session(&gorm.Session{NewDB: true})

	var settings []models.Setting
	db.Where(`"tenantId" = ? AND key IN ?`, tenantID, []string{
		"aiEmbeddingModel", "aiEmbeddingBaseURL", "aiEmbeddingApiKey",
		"aiCustomBaseURL", "aiApiKey",
	}).Find(&settings)

	m := make(map[string]string, len(settings))
	for _, s := range settings {
		m[s.Key] = s.Value
	}

	model := strings.TrimSpace(m["aiEmbeddingModel"])
	if model == "" {
		return EmbedConfig{}, false
	}

	baseURL := strings.TrimSpace(m["aiEmbeddingBaseURL"])
	if baseURL == "" {
		baseURL = strings.TrimSpace(m["aiCustomBaseURL"])
	}
	apiKey := strings.TrimSpace(m["aiEmbeddingApiKey"])
	if apiKey == "" {
		apiKey = strings.TrimSpace(m["aiApiKey"])
	}
	if baseURL == "" || apiKey == "" {
		return EmbedConfig{}, false
	}

	return EmbedConfig{BaseURL: baseURL, APIKey: apiKey, Model: model}, true
}
