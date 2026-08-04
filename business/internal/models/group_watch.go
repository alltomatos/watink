package models

import (
	"time"

	"github.com/google/uuid"
)

// GroupWatchTag is a phrase/keyword the tenant wants to monitor across every
// group ticket (plugin "groups", feature de monitoramento). Matching is
// case-insensitive substring against Message.Body, done in
// plugins/groups_watch.go on every "message.received" domain event.
type GroupWatchTag struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	TenantID  uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	Phrase    string    `gorm:"column:phrase;not null" json:"phrase"`
	Active    bool      `gorm:"column:active;not null;default:true" json:"active"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (GroupWatchTag) TableName() string {
	return "group_watch_tags"
}

// GroupWatchMatch is one hit of a GroupWatchTag against an inbound group
// message — Phrase/GroupSubject/ContactName are snapshotted at match time
// (never joined live) so the feed still reads correctly after the tag is
// edited/deleted or the group is renamed.
type GroupWatchMatch struct {
	ID           int       `gorm:"primaryKey" json:"id"`
	TenantID     uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	TagID        int       `gorm:"column:tagId;not null" json:"tagId"`
	Phrase       string    `gorm:"column:phrase;not null" json:"phrase"`
	TicketID     int       `gorm:"column:ticketId;not null" json:"ticketId"`
	MessageID    string    `gorm:"column:messageId;not null" json:"messageId"`
	GroupSubject string    `gorm:"column:groupSubject" json:"groupSubject"`
	ContactName  string    `gorm:"column:contactName" json:"contactName"`
	Snippet      string    `gorm:"column:snippet" json:"snippet"`
	CreatedAt    time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (GroupWatchMatch) TableName() string {
	return "group_watch_matches"
}
