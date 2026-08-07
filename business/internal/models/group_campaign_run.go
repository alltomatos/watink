package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// GroupCampaignRun is ONE occurrence of a GroupCampaign -- immediate/once
// produce exactly one run; recurring produces one per fired occurrence.
// This is both the recurrence requirement AND the materialization
// idempotency anchor: CampaignID+OccurrenceKey carry a composite
// uniqueIndex (name matches the raw SQL in database.go addCustomIndexes,
// idempotent between the two; declared here too so testutil.NewTestDB,
// which only runs AutoMigrate, enforces it in tests) that stops two nodes
// from racing the materializer cron into double-materializing the same
// occurrence.
//
// VariantsSnapshot freezes the campaign's active variants at the moment
// this run started -- the run executes what existed then, even if the
// campaign is edited afterwards. Direct precedent: FlowRun.GraphSnapshot
// (ADR 0011/0013).
type GroupCampaignRun struct {
	ID            int        `gorm:"primaryKey" json:"id"`
	TenantID      uuid.UUID  `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CampaignID    int        `gorm:"column:campaignId;not null;uniqueIndex:idx_group_campaign_runs_occurrence" json:"campaignId"`
	OccurrenceKey string     `gorm:"column:occurrenceKey;not null;uniqueIndex:idx_group_campaign_runs_occurrence" json:"occurrenceKey"` // UTC RFC3339 of the occurrence, or "manual-<unix>" for /test
	Status        string     `gorm:"column:status;not null;default:pending" json:"status"`
	SkipReason    string     `gorm:"column:skipReason" json:"skipReason,omitempty"`
	ScheduledFor  time.Time  `gorm:"column:scheduledFor;not null" json:"scheduledFor"`
	StartedAt     *time.Time `gorm:"column:startedAt" json:"startedAt,omitempty"`
	FinishedAt    *time.Time `gorm:"column:finishedAt" json:"finishedAt,omitempty"`

	VariantsSnapshot datatypes.JSON `gorm:"column:variantsSnapshot;type:jsonb" json:"variantsSnapshot"`

	// Sequence is the 0-based ordinal of this occurrence within the
	// campaign's history -- drives the variant-rotation offset
	// (buildSendSchedule's seq param, issue #593) so occurrence #2 doesn't
	// hit the same group with the same variant as occurrence #1.
	Sequence int `gorm:"column:sequence;not null;default:0" json:"sequence"`

	TotalSends   int `gorm:"column:totalSends;not null;default:0" json:"totalSends"`
	SentCount    int `gorm:"column:sentCount;not null;default:0" json:"sentCount"`
	FailedCount  int `gorm:"column:failedCount;not null;default:0" json:"failedCount"`
	SkippedCount int `gorm:"column:skippedCount;not null;default:0" json:"skippedCount"`
	ReplyCount   int `gorm:"column:replyCount;not null;default:0" json:"replyCount"`

	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (GroupCampaignRun) TableName() string {
	return "group_campaign_runs"
}

// Run status values.
const (
	GroupCampaignRunStatusPending   = "pending"
	GroupCampaignRunStatusRunning   = "running"
	GroupCampaignRunStatusCompleted = "completed"
	GroupCampaignRunStatusCanceled  = "canceled"
	GroupCampaignRunStatusFailed    = "failed"
)
