package models

import (
	"time"

	"github.com/google/uuid"
)

// AssistantRouterOption is a menu entry of an Assistant in "router" mode —
// relational (not JSON), same precedent as PipelineStage: N ordered items,
// each referencing another entity by FK, needing referential integrity and
// reordering. TargetAssistant must be on the SAME connection as the router
// (WhatsAppID must match) — enforced by the controller, not the DB.
type AssistantRouterOption struct {
	ID                int       `gorm:"primaryKey" json:"id"`
	RouterAssistantID int       `gorm:"column:routerAssistantId;not null" json:"routerAssistantId"`
	Label             string    `gorm:"not null" json:"label"`
	Order             int       `gorm:"default:0" json:"order"`
	TargetAssistantID int       `gorm:"column:targetAssistantId;not null" json:"targetAssistantId"`
	TenantID          uuid.UUID `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	CreatedAt         time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt         time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	RouterAssistant *Assistant `gorm:"foreignKey:RouterAssistantID" json:"-"`
	TargetAssistant *Assistant `gorm:"foreignKey:TargetAssistantID" json:"targetAssistant,omitempty"`
}

func (AssistantRouterOption) TableName() string { return "AssistantRouterOptions" }
