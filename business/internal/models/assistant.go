package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Assistant is a tenant-scoped AI conversational automation bound to a
// WhatsApp connection. Mode selects one of 4 behaviors (pipeline/flow/persona/
// router); mode-specific fields live in Config (see assistant_config.go) —
// common fields (connection, trigger, advanced) are typed columns so the
// "one active Assistant per connection" rule can be enforced/queried cheaply.
// See docs/agents/assistants.md and ADR 0027.
type Assistant struct {
	ID          int       `gorm:"primaryKey" json:"id"`
	TenantID    uuid.UUID `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `gorm:"default:''" json:"description"`

	WhatsAppID                *int      `gorm:"column:whatsappId" json:"whatsappId"`
	Whatsapp                  *Whatsapp `gorm:"foreignKey:WhatsAppID" json:"whatsapp,omitempty"`
	AllowMultipleOnConnection bool      `gorm:"column:allowMultipleOnConnection;default:false" json:"allowMultipleOnConnection"`

	Mode   string         `gorm:"not null" json:"mode"` // pipeline|flow|persona|router
	Config datatypes.JSON `gorm:"type:jsonb" json:"config"`

	// Gatilho
	TriggerType     string `gorm:"column:triggerType;default:'any'" json:"triggerType"` // any|keyword
	TriggerOperator string `gorm:"column:triggerOperator" json:"triggerOperator"`       // contains|equals|starts_with|ends_with|regex
	TriggerValue    string `gorm:"column:triggerValue" json:"triggerValue"`

	// Avançado
	SessionExpiryMinutes *int    `gorm:"column:sessionExpiryMinutes" json:"sessionExpiryMinutes"`
	TypingDelayMs        *int    `gorm:"column:typingDelayMs" json:"typingDelayMs"`
	DebounceSeconds      *int    `gorm:"column:debounceSeconds" json:"debounceSeconds"`
	EndKeyword           *string `gorm:"column:endKeyword" json:"endKeyword"`
	ExpiryMessage        *string `gorm:"column:expiryMessage" json:"expiryMessage"`
	ClosingMessage       *string `gorm:"column:closingMessage" json:"closingMessage"`
	StopOnHumanReply     bool    `gorm:"column:stopOnHumanReply;default:true" json:"stopOnHumanReply"`
	IgnoreGroups         bool    `gorm:"column:ignoreGroups;default:true" json:"ignoreGroups"`
	// GroupsMode selects how groups are handled, orthogonal to IgnoreGroups
	// (kept unchanged for backward compat — see assistant_runtime_group_test.go):
	//   "legacy"    (default) — IgnoreGroups alone decides (all-or-nothing).
	//   "selective" — IgnoreGroups is bypassed; only groups with an Active
	//                 AssistantGroup row are visible, and the Assistant only
	//                 REPLIES when @-mentioned in the group (otherwise it
	//                 just observes — the message is still saved/visible in
	//                 the ticket, only the automated reply is skipped).
	GroupsMode string `gorm:"column:groupsMode;default:'legacy'" json:"groupsMode"`

	Active    bool      `gorm:"default:true" json:"active"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Assistant) TableName() string { return "Assistants" }
