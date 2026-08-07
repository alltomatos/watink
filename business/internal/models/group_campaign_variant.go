package models

import (
	"time"

	"github.com/google/uuid"
)

// GroupCampaignVariant is one message variant of a GroupCampaign -- the
// anti-fingerprint rotation: identical content posted into dozens of groups
// in sequence is the most obvious spam pattern there is, so a campaign
// rotates between N variants across its targets (see buildSendSchedule,
// issue #593).
//
// A table, not a JSONB array on GroupCampaign: reports group replies BY
// variant (issue #601), and a stable row id survives editing in a way an
// array index does not.
//
// Deliberately NO Shortcut, NO Slug (unlike models.QuickAnswer) -- Type/
// Message/Content are exactly the shape flow.BuildQuickAnswerCommand
// consumes (see flow.NormalizeQuickAnswerContent, issue #592), but this is
// its own entity, never a QuickAnswer.
type GroupCampaignVariant struct {
	ID         int       `gorm:"primaryKey" json:"id"`
	TenantID   uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CampaignID int       `gorm:"column:campaignId;not null" json:"campaignId"`
	Position   int       `gorm:"column:position;not null;default:0" json:"position"`
	Label      string    `gorm:"column:label" json:"label,omitempty"`
	Type       string    `gorm:"column:type;not null;default:text" json:"type"`
	Message    string    `gorm:"column:message" json:"message"`
	Content    string    `gorm:"column:content;type:jsonb;default:'null'" json:"content"`
	Active     bool      `gorm:"column:active;not null;default:true" json:"active"`
	CreatedAt  time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (GroupCampaignVariant) TableName() string {
	return "group_campaign_variants"
}
