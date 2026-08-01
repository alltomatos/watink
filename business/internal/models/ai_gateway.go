package models

import (
	"time"

	"github.com/google/uuid"
)

// AiGateway is an AI provider registered inside the "Assistentes de IA" plugin
// (Configurações → Agentes de IA, visible only while the plugin is active).
// Distinct from omniroute (core, single tenant-wide endpoint used by
// embeddings/Retrieval RAG): AiGateway is plural and plugin-scoped, feeding
// only Assistant completions. ApiKeyEnc is cryptobox-encrypted at rest and
// never serialized (json:"-").
type AiGateway struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	TenantID  uuid.UUID `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	Name      string    `gorm:"not null" json:"name"`
	Provider  string    `gorm:"not null" json:"provider"` // openai|anthropic|other
	ApiKeyEnc string    `gorm:"column:apiKeyEnc;type:text" json:"-"`
	BaseURL   *string   `gorm:"column:baseUrl" json:"baseUrl"`
	Model     string    `gorm:"not null" json:"model"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (AiGateway) TableName() string { return "AiGateways" }

// HasApiKey reports whether a credential is stored (without exposing it) —
// same pattern as Proxy.HasPassword, lets edit forms leave the field blank
// and only overwrite when the user types a new value.
func (g AiGateway) HasApiKey() bool { return g.ApiKeyEnc != "" }
