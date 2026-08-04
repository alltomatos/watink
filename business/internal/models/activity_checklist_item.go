package models

import (
	"time"

	"github.com/google/uuid"
)

// ActivityChecklistItem é um item do checklist de execução da Activity.
// InputType determina como Value é preenchido pelo executor: text (texto
// livre), number (número serializado como string) ou photo (chave/URL do
// objeto no S3 — nunca base64).
type ActivityChecklistItem struct {
	ID         int       `gorm:"primaryKey" json:"id"`
	ActivityID int       `gorm:"column:activityId;not null" json:"activityId"`
	Label      string    `gorm:"not null" json:"label"`
	IsRequired bool      `gorm:"column:isRequired;not null;default:false" json:"isRequired"`
	IsDone     bool      `gorm:"column:isDone;not null;default:false" json:"isDone"`
	InputType  string    `gorm:"column:inputType;not null;default:'text'" json:"inputType"`
	Value      string    `json:"value,omitempty"`
	Position   int       `gorm:"not null;default:0" json:"position"`
	TenantID   uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CreatedAt  time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (ActivityChecklistItem) TableName() string {
	return "ActivityChecklistItems"
}
