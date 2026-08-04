package models

import (
	"time"

	"github.com/google/uuid"
)

// ActivityAssignee é o vínculo N:N entre Activity e User — atribuição é N:N
// desde a Fase 0 (decisão confirmada: suportar equipe, não só um técnico
// responsável). Nunca modelar como userId único na tabela Activity.
type ActivityAssignee struct {
	ID         int       `gorm:"primaryKey" json:"id"`
	ActivityID int       `gorm:"column:activityId;not null" json:"activityId"`
	UserID     int       `gorm:"column:userId;not null" json:"userId"`
	TenantID   uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CreatedAt  time.Time `gorm:"column:createdAt" json:"createdAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (ActivityAssignee) TableName() string {
	return "ActivityAssignees"
}
