package models

import (
	"time"

	"github.com/google/uuid"
)

// AssistantProactiveLog records a proactive message the pipeline-mode
// Assistant runtime already sent for a given (Assistant, Deal, event) triple
// — the idempotency guard for the idle-sweep cron (assistant_scheduler.go),
// so a Deal parked past idleThresholdDays is nudged once, not every tick.
// The unique index IS the guard: a duplicate insert is caught and treated as
// "already sent", not an error.
type AssistantProactiveLog struct {
	ID          int       `gorm:"primaryKey" json:"id"`
	TenantID    uuid.UUID `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	AssistantID int       `gorm:"column:assistantId;not null" json:"assistantId"`
	DealID      int       `gorm:"column:dealId;not null" json:"dealId"`
	EventType   string    `gorm:"column:eventType;not null" json:"eventType"`
	SentAt      time.Time `gorm:"column:sentAt" json:"sentAt"`
}

func (AssistantProactiveLog) TableName() string { return "AssistantProactiveLogs" }
