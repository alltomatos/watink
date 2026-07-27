package models

import (
	"time"

	"github.com/google/uuid"
)

type Whatsapp struct {
	ID              int        `gorm:"primaryKey" json:"id"`
	Session         string     `json:"session"`
	Qrcode          string     `gorm:"type:text" json:"qrcode"`
	Status          string     `json:"status"`
	Battery         string     `json:"battery"`
	Plugged         bool       `json:"plugged"`
	Name            string     `gorm:"unique;not null" json:"name"`
	IsDefault       bool       `gorm:"column:isDefault;not null;default:false" json:"isDefault"`
	Retries         int        `gorm:"not null;default:0" json:"retries"`
	GreetingMessage string     `gorm:"column:greetingMessage" json:"greetingMessage"`
	FarewellMessage string     `gorm:"column:farewellMessage" json:"farewellMessage"`
	TenantID        uuid.UUID  `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	SyncHistory     bool       `gorm:"column:syncHistory;default:false" json:"syncHistory"`
	SyncPeriod      string     `gorm:"column:syncPeriod" json:"syncPeriod"`
	Number          string     `json:"number"`
	ProfilePicUrl   string     `gorm:"column:profilePicUrl" json:"profilePicUrl"`
	KeepAlive       bool       `gorm:"column:keepAlive;default:false" json:"keepAlive"`
	CreatedAt       time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt       time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
	FirstConnection *time.Time `gorm:"column:firstConnection" json:"firstConnection"`
	LastConnectedAt *time.Time `gorm:"column:lastConnectedAt" json:"lastConnectedAt"`
	EngineType      string     `gorm:"column:engineType;default:'whatsmeow'" json:"engineType"`
	Wid             string     `gorm:"column:wid;size:100" json:"wid"`
	// Proxy assignment (anti-ban). ProxyMode: "none" | "single" | "group".
	//   single → ProxyID fixo. group → ProxyGroupID + ProxyID guarda o pick atual
	//   (sticky) ou o último usado (rotate).
	ProxyMode         string `gorm:"column:proxyMode;default:'none'" json:"proxyMode"`
	ProxyID           *int   `gorm:"column:proxyId" json:"proxyId"`
	ProxyGroupID      *int   `gorm:"column:proxyGroupId" json:"proxyGroupId"`
	ConnectionGroupID *int   `gorm:"column:connectionGroupId;index" json:"connectionGroupId"`

	// IzapiaSessionID is the session id assigned by the izapia API (distinct from
	// this row's own ID). Only set when EngineType == "izapia".
	IzapiaSessionID *string `gorm:"column:izapiaSessionId" json:"izapiaSessionId"`
	// IzapiaWebhookSecretEnc is the cryptobox-encrypted secret used to sign the
	// izapia webhook payload for this session, generated on first StartSession.
	// Never serialized.
	IzapiaWebhookSecretEnc *string `gorm:"column:izapiaWebhookSecretEnc;type:text" json:"-"`

	// Relations
	Tickets []Ticket `gorm:"foreignKey:WhatsappID" json:"tickets,omitempty"`
	Queues  []Queue  `gorm:"many2many:whatsapp_queues;" json:"queues,omitempty"`
}

func (Whatsapp) TableName() string {
	return "Whatsapps"
}
