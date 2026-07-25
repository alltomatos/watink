package models

import (
	"time"

	"github.com/google/uuid"
)

// ProtocolLog é o histórico de mutações de um Protocol — mesmo padrão do
// TicketLog (models/ticket_log.go), adaptado ao contrato consumido pelo
// frontend (HistoryItem: action, previousValue?, newValue?, comment?,
// createdAt, user?).
type ProtocolLog struct {
	ID            int       `gorm:"primaryKey" json:"id"`
	ProtocolID    int       `gorm:"column:protocolId;not null" json:"protocolId"`
	UserID        *int      `gorm:"column:userId" json:"userId"`
	Action        string    `gorm:"not null" json:"action"` // create, status, priority, comment
	PreviousValue string    `gorm:"column:previousValue" json:"previousValue,omitempty"`
	NewValue      string    `gorm:"column:newValue" json:"newValue,omitempty"`
	Comment       string    `json:"comment,omitempty"`
	TenantID      uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CreatedAt     time.Time `gorm:"column:createdAt" json:"createdAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (ProtocolLog) TableName() string {
	return "ProtocolLogs"
}
