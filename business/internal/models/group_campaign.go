package models

import (
	"time"

	"github.com/google/uuid"
)

// GroupCampaign is a scheduled bulk post to WhatsApp groups (plugin "groups",
// 4th tab "Campanhas") -- a DIFFERENT entity from the FlowBuilder Fase-4
// "Campaign"/"CampaignRecipient" (CONTEXT.md), which is a contact-blast
// anchored on a FlowRun. Reusing that name would recreate exactly the
// homonym problem CLAUDE.md already flags for "whatsappGroups" vs "groups"
// -- every type here is prefixed GroupCampaign on purpose.
//
// One connection per campaign (WhatsappID): a chip can only post to groups
// it's a member of, and posting the same content into one group from two
// numbers is a STRONGER spam signal than one -- so the ADR 0016 reputation-
// weighted chip rotation does NOT apply here (see ADR 0030).
type GroupCampaign struct {
	ID          int       `gorm:"primaryKey" json:"id"`
	TenantID    uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	Name        string    `gorm:"column:name;not null" json:"name"`
	Description string    `gorm:"column:description" json:"description"`
	WhatsappID  int       `gorm:"column:whatsappId;not null" json:"whatsappId"`
	Status      string    `gorm:"column:status;not null;default:draft" json:"status"`
	PauseReason string    `gorm:"column:pauseReason" json:"pauseReason,omitempty"`

	// Schedule: immediate | once | recurring. See groups_campaign_schedule.go
	// (issue #593) for computeNextOccurrence.
	ScheduleMode     string     `gorm:"column:scheduleMode;not null;default:immediate" json:"scheduleMode"`
	StartAt          *time.Time `gorm:"column:startAt" json:"startAt,omitempty"`
	RecurrenceRule   string     `gorm:"column:recurrenceRule" json:"recurrenceRule,omitempty"` // weekly | monthly | ""
	RecurrenceDays   string     `gorm:"column:recurrenceDays" json:"recurrenceDays,omitempty"` // CSV: weekly 0..6 (0=Sun), monthly 1..31
	RecurrenceTime   string     `gorm:"column:recurrenceTime" json:"recurrenceTime,omitempty"` // "HH:MM"
	Timezone         string     `gorm:"column:timezone;not null;default:America/Sao_Paulo" json:"timezone"`
	RecurrenceEndAt  *time.Time `gorm:"column:recurrenceEndAt" json:"recurrenceEndAt,omitempty"` // nil = indeterminado
	NextOccurrenceAt *time.Time `gorm:"column:nextOccurrenceAt" json:"nextOccurrenceAt,omitempty"`

	// Pacing (anti-ban) -- clamped server-side, never trusted from the client
	// as-is (see clampPacing, issue #593).
	IntervalSeconds   int `gorm:"column:intervalSeconds;not null;default:60" json:"intervalSeconds"`
	JitterSeconds     int `gorm:"column:jitterSeconds;not null;default:15" json:"jitterSeconds"`
	BatchSize         int `gorm:"column:batchSize;not null;default:10" json:"batchSize"`
	BatchPauseSeconds int `gorm:"column:batchPauseSeconds;not null;default:300" json:"batchPauseSeconds"`

	// Reply capture (issue #598). "quoted" (default) only trusts a reply that
	// quotes the campaign message; "quoted_and_window" also counts any group
	// message inside CaptureWindowMinutes as a weak signal -- never blended
	// into one number in reports (see GroupCampaignReply.MatchType).
	CaptureMode          string `gorm:"column:captureMode;not null;default:quoted" json:"captureMode"`
	CaptureWindowMinutes int    `gorm:"column:captureWindowMinutes;not null;default:60" json:"captureWindowMinutes"`

	// ADR 0016/0030: the non-dismissible risk acceptance, persisted as audit
	// trail -- required before /start (issue #597) accepts the campaign.
	RiskAckAt     *time.Time `gorm:"column:riskAckAt" json:"riskAckAt,omitempty"`
	RiskAckUserID *int       `gorm:"column:riskAckUserId" json:"riskAckUserId,omitempty"`
	CreatedByID   *int       `gorm:"column:createdById" json:"createdById,omitempty"`

	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (GroupCampaign) TableName() string {
	return "group_campaigns"
}

// Status values.
const (
	GroupCampaignStatusDraft     = "draft"
	GroupCampaignStatusScheduled = "scheduled"
	GroupCampaignStatusRunning   = "running"
	GroupCampaignStatusPaused    = "paused"
	GroupCampaignStatusCompleted = "completed"
	GroupCampaignStatusCanceled  = "canceled"
)

// ScheduleMode values.
const (
	GroupCampaignScheduleImmediate = "immediate"
	GroupCampaignScheduleOnce      = "once"
	GroupCampaignScheduleRecurring = "recurring"
)

// RecurrenceRule values.
const (
	GroupCampaignRecurrenceWeekly  = "weekly"
	GroupCampaignRecurrenceMonthly = "monthly"
)

// CaptureMode values.
const (
	GroupCampaignCaptureQuoted          = "quoted"
	GroupCampaignCaptureQuotedAndWindow = "quoted_and_window"
)
