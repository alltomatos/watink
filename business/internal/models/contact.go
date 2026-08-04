package models

import (
	"time"

	"github.com/google/uuid"
)

type Contact struct {
	ID            int       `gorm:"primaryKey" json:"id"`
	Name          string    `gorm:"not null" json:"name"`
	Number        string    `gorm:"unique" json:"number"`
	ProfilePicUrl string    `gorm:"column:profilePicUrl" json:"profilePicUrl"`
	Email         string    `gorm:"not null;default:''" json:"email"`
	IsGroup       bool      `gorm:"column:isGroup;not null;default:false" json:"isGroup"`
	// GroupParticipantCount é preenchido só para IsGroup=true, via
	// enriquecimento oportunista (plugins/groups_watch.go
	// enrichContactFromGroup) toda vez que o plugin Grupos busca
	// GroupInfo.Participants do WhatsApp -- nunca setado para contato
	// individual. nil = nunca enriquecido (grupo listado só via mensagem
	// recebida, sem passar pelo plugin Grupos ainda).
	GroupParticipantCount *int `gorm:"column:groupParticipantCount" json:"groupParticipantCount,omitempty"`
	TenantID      uuid.UUID `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	Lid           *string   `gorm:"unique" json:"lid"`
	WalletUserID  *int      `gorm:"column:walletUserId" json:"walletUserId"`
	// ClientID is nullable — a Contact can exist and generate Tickets without
	// ever being linked to a Client (someone messages in without being
	// registered). A Contact belongs to at most one Client; the link is
	// always manual (ADR 0023) — no unique constraint here, since multiple
	// Contacts may point to the same Client.
	ClientID  *int      `gorm:"column:clientId" json:"clientId"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	// Relations
	Tickets []Ticket `gorm:"foreignKey:ContactID" json:"tickets,omitempty"`
	Wallet  *User    `gorm:"foreignKey:WalletUserID" json:"wallet,omitempty"`
	Client  *Client  `gorm:"foreignKey:ClientID" json:"client,omitempty"`
}

func (Contact) TableName() string {
	return "Contacts"
}
