package models

import (
	"time"

	"github.com/google/uuid"
)

// MatchType values for GroupCampaignReply -- kept as separate counters
// everywhere they're reported (issue #601), never blended into one
// "engagement" number: "window" counts ANY group chatter in the capture
// window, related or not.
const (
	GroupCampaignReplyMatchQuoted = "quoted" // strong: reply quotes the campaign message (QuotedMsgID)
	GroupCampaignReplyMatchWindow = "window" // weak: any group message inside CaptureWindowMinutes
)

// GroupCampaignReply is one captured inbound reply attributed to a
// GroupCampaignSend.
//
// TenantID+MessageID carry a composite uniqueIndex matching the raw SQL
// name in database.go addCustomIndexes -- declared here too so
// testutil.NewTestDB (AutoMigrate only) enforces it in tests. Makes a
// "message.received" redelivery a no-op instead of a duplicate reply.
type GroupCampaignReply struct {
	ID          int64     `gorm:"primaryKey" json:"id"`
	TenantID    uuid.UUID `gorm:"column:tenantId;type:uuid;not null;uniqueIndex:idx_group_campaign_replies_message" json:"tenantId"`
	CampaignID  int       `gorm:"column:campaignId;not null" json:"campaignId"`
	RunID       int       `gorm:"column:runId;not null" json:"runId"`
	SendID      int64     `gorm:"column:sendId;not null" json:"sendId"`
	JID         string    `gorm:"column:jid;not null" json:"jid"`
	TicketID    int       `gorm:"column:ticketId;not null" json:"ticketId"`
	MessageID   string    `gorm:"column:messageId;not null;uniqueIndex:idx_group_campaign_replies_message" json:"messageId"` // inbound Message.ID
	Participant string    `gorm:"column:participant" json:"participant,omitempty"`
	ContactName string    `gorm:"column:contactName" json:"contactName,omitempty"`
	Body        string    `gorm:"column:body" json:"body,omitempty"` // capped at 1000 chars by the handler
	MatchType   string    `gorm:"column:matchType;not null" json:"matchType"`
	IsOptOut    bool      `gorm:"column:isOptOut;not null;default:false" json:"isOptOut"`
	RepliedAt   time.Time `gorm:"column:repliedAt;not null" json:"repliedAt"`
	CreatedAt   time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (GroupCampaignReply) TableName() string {
	return "group_campaign_replies"
}
