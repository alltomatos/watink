package models

import (
	"time"

	"github.com/google/uuid"
)

// Protocol é o registro de atendimento do plugin Helpdesk — nunca migrado em
// produção antes desta revisão (tabela "Protocols" existia só em teste). O
// desenho abaixo é livre de dado legado: sem migração de coluna, redesenhado
// para casar com o contrato já consumido pelo frontend (frontend/src/pages/Helpdesk).
type Protocol struct {
	ID             int    `gorm:"primaryKey" json:"id"`
	ProtocolNumber string `gorm:"column:protocolNumber;unique;not null" json:"protocolNumber"`
	Subject        string `gorm:"not null" json:"subject"`
	Description    string `json:"description"`
	Category       string `json:"category"`
	Status         string `gorm:"not null;default:'open'" json:"status"`
	Priority       string `gorm:"not null;default:'medium'" json:"priority"`
	// Token autoriza o acesso público sem login (GET /public/protocols/:token) —
	// gerado uma vez na criação (crypto/rand), nunca reaproveitado.
	Token     string    `gorm:"unique;not null" json:"token"`
	ContactID int       `gorm:"column:contactId;not null" json:"contactId"`
	TicketID  *int      `gorm:"column:ticketId" json:"ticketId"`
	TenantID  uuid.UUID `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	// Relations
	Contact Contact `gorm:"foreignKey:ContactID" json:"contact,omitempty"`
}

func (Protocol) TableName() string {
	return "Protocols"
}
