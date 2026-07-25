package models

import "time"

// ProtocolAttachment é um arquivo anexado a um Protocol, armazenado via
// mediastore.SaveMediaReader (pkg/mediastore) — mesmo mecanismo de mídia já
// usado por mensagens (content-addressed, sob /public/media).
type ProtocolAttachment struct {
	ID         int       `gorm:"primaryKey" json:"id"`
	ProtocolID int       `gorm:"column:protocolId;not null" json:"protocolId"`
	FileName   string    `gorm:"column:fileName" json:"fileName"`
	URL        string    `gorm:"not null" json:"url"`
	MimeType   string    `gorm:"column:mimeType" json:"mimeType"`
	CreatedAt  time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (ProtocolAttachment) TableName() string {
	return "ProtocolAttachments"
}
