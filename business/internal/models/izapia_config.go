package models

import (
	"time"

	"github.com/google/uuid"
)

// IzapiaConfig holds a tenant's izapia API credential (one row per tenant).
// The API base URL is always the official one (api.izapia.com, see
// izapia.DefaultBaseURL) — the tenant only configures the API key, no URL
// field. ApiKeyEnc is stored encrypted-at-rest (cryptobox/AES-GCM) and is
// never serialized — mirrors the Proxy.PasswordEnc pattern.
type IzapiaConfig struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	TenantID  uuid.UUID `gorm:"column:tenantId;type:uuid;uniqueIndex" json:"tenantId"`
	ApiKeyEnc string    `gorm:"column:apiKeyEnc;type:text" json:"-"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (IzapiaConfig) TableName() string { return "IzapiaConfigs" }

// HasApiKey reports whether a credential is stored (without exposing it).
func (c IzapiaConfig) HasApiKey() bool { return c.ApiKeyEnc != "" }
