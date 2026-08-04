package models

import (
	"time"

	"github.com/google/uuid"
)

// GroupCache is the persisted snapshot of one WhatsApp group/community for
// one connection -- the read path for GET /groups (plugin "groups") serves
// from THIS table, never live from WhatsApp, so opening the Grupos tab
// never risks a ban and never blocks on a slow/timing-out whatsmeow call.
// Freshness comes from the periodic background sync
// (plugins/groups_cache_sync.go), not from the request itself.
//
// No Participants column (only the count) -- the full list is only ever
// needed on the single-group detail view, which stays live (GetGroup),
// never bulk. Storing a few hundred groups worth of full participant JSON
// per connection here would be pure bloat for a list screen that only
// renders subject/picture/counts.
type GroupCache struct {
	ID                int       `gorm:"primaryKey" json:"id"`
	TenantID          uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	WhatsappID        int       `gorm:"column:whatsappId;not null" json:"whatsappId"`
	JID               string    `gorm:"column:jid;not null" json:"jid"`
	Subject           string    `json:"subject"`
	Description       string    `json:"description"`
	Owner             string    `json:"owner"`
	IsCommunity       bool      `gorm:"column:isCommunity" json:"isCommunity"`
	IsSubGroup        bool      `gorm:"column:isSubGroup" json:"isSubGroup"`
	ParentJID         string    `gorm:"column:parentJID" json:"parentJID,omitempty"`
	Announce          bool      `json:"announce"`
	Locked            bool      `json:"locked"`
	MemberAddMode     string    `gorm:"column:memberAddMode" json:"memberAddMode"`
	JoinApprovalMode  bool      `gorm:"column:joinApprovalMode" json:"joinApprovalMode"`
	PictureURL        string    `gorm:"column:pictureURL" json:"pictureURL,omitempty"`
	ParticipantCount  int       `gorm:"column:participantCount" json:"participantCount"`
	IsConnectionAdmin bool      `gorm:"column:isConnectionAdmin" json:"isConnectionAdmin"`
	CreatedAt         time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt         time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (GroupCache) TableName() string {
	return "group_caches"
}
