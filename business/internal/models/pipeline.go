package models

import (
	"time"

	"github.com/google/uuid"
)

type Pipeline struct {
	ID          int       `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `gorm:"default:''" json:"description"`
	Type        string    `gorm:"default:'kanban'" json:"type"`
	TenantID    uuid.UUID `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	CreatedAt   time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	// Relations
	Stages []PipelineStage `gorm:"foreignKey:PipelineID" json:"stages,omitempty"`

	// DealsCount and DealsValue are populated on-demand (never persisted) by
	// PipelineController.List as quick metrics for the listing card.
	DealsCount int64   `gorm:"-" json:"dealsCount,omitempty"`
	DealsValue float64 `gorm:"-" json:"dealsValue,omitempty"`
}

func (Pipeline) TableName() string {
	return "Pipelines"
}

type PipelineStage struct {
	ID         int       `gorm:"primaryKey" json:"id"`
	Name       string    `gorm:"not null" json:"name"`
	PipelineID int       `gorm:"column:pipelineId;not null" json:"pipelineId"`
	Order      int       `gorm:"default:0" json:"order"`
	CreatedAt  time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Pipeline *Pipeline `gorm:"foreignKey:PipelineID" json:"pipeline,omitempty"`
}

func (PipelineStage) TableName() string {
	return "PipelineStages"
}
