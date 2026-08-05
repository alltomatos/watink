package models

import (
	"time"

	"github.com/google/uuid"
)

// GroupWatchTag is a phrase/keyword the tenant wants to monitor across every
// group ticket (plugin "groups", feature de monitoramento). Matching is
// case-insensitive substring against Message.Body, done in
// plugins/groups_watch.go on every "message.received" domain event.
// GroupWatchMatchMode selects how GroupWatchTag.Phrase is compared against
// an inbound message body in handleGroupWatchMessage (groups_watch.go).
type GroupWatchMatchMode string

const (
	// GroupWatchMatchContains: substring match (case-insensitive) — the
	// default. Catches derivations ("ajuda" matches "AJUDANTE", "preciso de
	// ajuda").
	GroupWatchMatchContains GroupWatchMatchMode = "contains"
	// GroupWatchMatchExact: the ENTIRE message body must equal the phrase
	// (case-insensitive, trimmed) — no partial/derived matches.
	GroupWatchMatchExact GroupWatchMatchMode = "exact"
)

type GroupWatchTag struct {
	ID       int       `gorm:"primaryKey" json:"id"`
	TenantID uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	Phrase   string    `gorm:"column:phrase;not null" json:"phrase"`
	Active   bool      `gorm:"column:active;not null;default:true" json:"active"`
	// MatchMode: "contains" (derivativa, default) ou "exact" (mensagem
	// precisa ser exatamente igual à frase, ignorando maiúsculas/espaços).
	MatchMode GroupWatchMatchMode `gorm:"column:matchMode;not null;default:contains" json:"matchMode"`
	// NotifyGlobally: quando true, uma menção dessa tag dispara um toast em
	// QUALQUER tela do app (via SSE, ouvido em layout/MainLayout.tsx), não
	// só no feed da aba Monitoramento. Default false — cada tag opta
	// explicitamente por interromper o usuário fora da tela de monitoramento.
	NotifyGlobally bool      `gorm:"column:notifyGlobally;not null;default:false" json:"notifyGlobally"`
	CreatedAt      time.Time `gorm:"column:createdAt" json:"createdAt"`
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
	// NotifyGlobally is snapshotted from the tag at match time (same
	// "never joined live" pattern as Phrase/GroupSubject/ContactName above)
	// so the frontend's global listener knows whether to toast without a
	// second round-trip to fetch the tag.
	NotifyGlobally bool      `gorm:"column:notifyGlobally;not null;default:false" json:"notifyGlobally"`
	CreatedAt      time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (GroupWatchMatch) TableName() string {
	return "group_watch_matches"
}
