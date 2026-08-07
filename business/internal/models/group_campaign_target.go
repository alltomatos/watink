package models

import (
	"time"

	"github.com/google/uuid"
)

// GroupCampaignTarget is one group selected as a recipient of a
// GroupCampaign. Subject/IsConnectionAdmin are SNAPSHOTS taken from
// GroupCache at selection time (display only, never re-derived live) --
// the picker (frontend, issue #600) reads live from GroupCache separately
// when re-selecting.
//
// WhatsappID is denormalized here (always equal to the parent
// GroupCampaign.WhatsappID today) so a future multi-connection campaign is
// a UI/validation change, not a migration.
//
// CampaignID+JID carry a composite uniqueIndex named to match the raw SQL
// in database.go addCustomIndexes (idempotent between the two -- see
// comment there) -- declared here too so testutil.NewTestDB (which only
// runs AutoMigrate, never addCustomIndexes) creates the constraint in tests.
type GroupCampaignTarget struct {
	ID                int       `gorm:"primaryKey" json:"id"`
	TenantID          uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CampaignID        int       `gorm:"column:campaignId;not null;uniqueIndex:idx_group_campaign_targets_campaign_jid" json:"campaignId"`
	WhatsappID        int       `gorm:"column:whatsappId;not null" json:"whatsappId"`
	JID               string    `gorm:"column:jid;not null;uniqueIndex:idx_group_campaign_targets_campaign_jid" json:"jid"`
	Subject           string    `gorm:"column:subject" json:"subject,omitempty"`
	IsConnectionAdmin bool      `gorm:"column:isConnectionAdmin" json:"isConnectionAdmin"`
	CreatedAt         time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (GroupCampaignTarget) TableName() string {
	return "group_campaign_targets"
}
