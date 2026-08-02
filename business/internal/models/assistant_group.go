package models

import (
	"time"

	"github.com/google/uuid"
)

// AssistantGroup is the per-group visibility toggle for an Assistant when
// GroupsMode="selective" — relational (not JSON), same precedent as
// AssistantRouterOption/PipelineStage. Default Active=false: a group is
// invisible to the Assistant until explicitly activated (the UI presents
// every known group under "Inativo" and moves it to "Ativo" on click).
type AssistantGroup struct {
	ID          int       `gorm:"primaryKey" json:"id"`
	TenantID    uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	AssistantID int       `gorm:"column:assistantId;not null" json:"assistantId"`
	// ContactID references the group's Contact row (Contact.IsGroup=true) —
	// groups are only known once they've sent at least one message, same as
	// every other Contact in this codebase (no dedicated WhatsApp group
	// listing exists yet).
	ContactID int  `gorm:"column:contactId;not null" json:"contactId"`
	Active    bool `gorm:"default:false" json:"active"`

	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Assistant *Assistant `gorm:"foreignKey:AssistantID" json:"-"`
	Contact   *Contact   `gorm:"foreignKey:ContactID" json:"contact,omitempty"`
}

func (AssistantGroup) TableName() string { return "AssistantGroups" }
