package models

import (
	"time"

	"github.com/google/uuid"
)

// ActivityMaterial registra um material usado na execução da Activity —
// IsBillable marca se entra na cobrança do cliente (flag por registro, não
// global).
type ActivityMaterial struct {
	ID           int       `gorm:"primaryKey" json:"id"`
	ActivityID   int       `gorm:"column:activityId;not null" json:"activityId"`
	MaterialName string    `gorm:"column:materialName;not null" json:"materialName"`
	Quantity     float64   `gorm:"not null;default:1" json:"quantity"`
	Unit         string    `gorm:"not null;default:'un'" json:"unit"`
	IsBillable   bool      `gorm:"column:isBillable;not null;default:false" json:"isBillable"`
	Notes        string    `json:"notes,omitempty"`
	TenantID     uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CreatedAt    time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (ActivityMaterial) TableName() string {
	return "ActivityMaterials"
}
