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
	// TranscriptionModel/SpeechModel selecionam os modelos usados nos
	// endpoints OpenAI-compatible /audio/transcriptions e /audio/speech do
	// MESMO baseUrl/apiKey acima — nem todo gateway credencia os mesmos
	// modelos para chat e para áudio (ex.: "whisper-1" cru pode não ter
	// credencial, enquanto "openrouter/openai/whisper-large-v3-turbo" tem).
	// nil/vazio = Assistant com AcceptsAudio/RespondsWithAudio ligado nesse
	// gateway falha com erro claro em vez de adivinhar um nome de modelo.
	TranscriptionModel *string   `gorm:"column:transcriptionModel" json:"transcriptionModel"`
	SpeechModel        *string   `gorm:"column:speechModel" json:"speechModel"`
	CreatedAt          time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt          time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (AiGateway) TableName() string { return "AiGateways" }

// HasApiKey reports whether a credential is stored (without exposing it) —
// same pattern as Proxy.HasPassword, lets edit forms leave the field blank
// and only overwrite when the user types a new value.
func (g AiGateway) HasApiKey() bool { return g.ApiKeyEnc != "" }
