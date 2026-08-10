package models

import (
	"time"

	"github.com/google/uuid"
)

// GroupCampaignSend is one (run x group) delivery -- THE pacing unit.
// ScheduledAt is PRE-COMPUTED by buildSendSchedule (issue #593) at
// materialization time, never derived from "last sent + interval" at drain
// time -- the drain cron (issue #594) is a stateless `WHERE scheduledAt <=
// now()` sweep, satisfying the "never time.Sleep for long delays"
// invariant literally.
//
// EnvID is the idempotency key handed to flow.WhatsAppAdapter.Send (Redis
// dedup, "wbot:msg:"+EnvID). MessageID == EnvID by construction (see
// sendOne, issue #595) -- the WhatsApp message id our engine assigns is the
// SAME as our row's key, which is what makes quoted-reply correlation
// (issue #598) possible without a second lookup table.
//
// RunID+JID carry a composite uniqueIndex matching the raw SQL name in
// database.go addCustomIndexes -- declared here too so testutil.NewTestDB
// (AutoMigrate only) enforces it in tests.
type GroupCampaignSend struct {
	ID           int64      `gorm:"primaryKey" json:"id"`
	TenantID     uuid.UUID  `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CampaignID   int        `gorm:"column:campaignId;not null" json:"campaignId"`
	RunID        int        `gorm:"column:runId;not null;uniqueIndex:idx_group_campaign_sends_run_jid" json:"runId"`
	WhatsappID   int        `gorm:"column:whatsappId;not null" json:"whatsappId"`
	JID          string     `gorm:"column:jid;not null;uniqueIndex:idx_group_campaign_sends_run_jid" json:"jid"`
	Subject      string     `gorm:"column:subject" json:"subject,omitempty"`
	VariantID    *int       `gorm:"column:variantId" json:"variantId,omitempty"`
	VariantIndex int        `gorm:"column:variantIndex;not null;default:0" json:"variantIndex"`
	Status       string     `gorm:"column:status;not null;default:pending" json:"status"`
	ScheduledAt  time.Time  `gorm:"column:scheduledAt;not null" json:"scheduledAt"`
	ClaimedAt    *time.Time `gorm:"column:claimedAt" json:"claimedAt,omitempty"`
	SentAt       *time.Time `gorm:"column:sentAt" json:"sentAt,omitempty"`
	Attempts     int        `gorm:"column:attempts;not null;default:0" json:"attempts"`
	LastError    string     `gorm:"column:lastError" json:"lastError,omitempty"`
	EnvID        string     `gorm:"column:envId;not null" json:"envId"`
	MessageID    string     `gorm:"column:messageId" json:"messageId,omitempty"`
	TicketID     *int       `gorm:"column:ticketId" json:"ticketId,omitempty"`
	ReplyCount   int        `gorm:"column:replyCount;not null;default:0" json:"replyCount"`
	CreatedAt    time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (GroupCampaignSend) TableName() string {
	return "group_campaign_sends"
}

// Send status values.
const (
	GroupCampaignSendStatusPending  = "pending"
	GroupCampaignSendStatusSending  = "sending"
	GroupCampaignSendStatusSent     = "sent"
	GroupCampaignSendStatusFailed   = "failed"
	GroupCampaignSendStatusSkipped  = "skipped"
	GroupCampaignSendStatusCanceled = "canceled"
)
