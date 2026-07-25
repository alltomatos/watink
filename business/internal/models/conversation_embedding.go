package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type ConversationEmbedding struct {
	ID           int            `gorm:"primaryKey" json:"id"`
	TicketID     int            `gorm:"column:ticketId" json:"ticketId"`
	ContactID    int            `gorm:"column:contactId" json:"contactId"`
	Summary      string         `gorm:"type:text" json:"summary"`
	Topics       datatypes.JSON `gorm:"type:jsonb" json:"topics"`
	Sentiment    float64        `gorm:"type:float" json:"sentiment"`
	MessageCount int            `gorm:"column:messageCount;default:0" json:"messageCount"`
	Embedding    []float64      `gorm:"type:float8[]" json:"embedding"`
	Metadata     datatypes.JSON `gorm:"type:jsonb" json:"metadata"`
	ProcessedAt  time.Time      `gorm:"column:processedAt" json:"processedAt"`
	TenantID     uuid.UUID      `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	CreatedAt    time.Time      `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time      `gorm:"column:updatedAt" json:"updatedAt"`

	// Relations
	Ticket  Ticket  `gorm:"foreignKey:TicketID" json:"ticket,omitempty"`
	Contact Contact `gorm:"foreignKey:ContactID" json:"contact,omitempty"`
	Tenant  Tenant  `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
}

func (ConversationEmbedding) TableName() string {
	return "ConversationEmbeddings"
}
