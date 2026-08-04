package models

import (
	"time"

	"github.com/google/uuid"
)

// ActivityOccurrence registra um evento durante a execução — info
// (informativo), impediment (impedimento) ou delay (atraso). TimeImpact é o
// impacto em minutos, opcional.
type ActivityOccurrence struct {
	ID          int       `gorm:"primaryKey" json:"id"`
	ActivityID  int       `gorm:"column:activityId;not null" json:"activityId"`
	Description string    `gorm:"not null" json:"description"`
	Type        string    `gorm:"not null;default:'info'" json:"type"`
	TimeImpact  *int      `gorm:"column:timeImpact" json:"timeImpact,omitempty"`
	TenantID    uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CreatedAt   time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (ActivityOccurrence) TableName() string {
	return "ActivityOccurrences"
}
