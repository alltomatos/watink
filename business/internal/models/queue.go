package models

import (
	"time"

	"github.com/google/uuid"
)

type Queue struct {
	ID int `gorm:"primaryKey" json:"id"`
	// Nome é único POR TENANT (não global) — multi-tenant: dois tenants podem ter
	// uma fila "Atendimento Inicial". O unique global antigo (uni_Queues_name)
	// quebrava o provisionamento do 2º tenant; é dropado na migração.
	Name string `gorm:"uniqueIndex:idx_queues_tenant_name;not null" json:"name"`
	// Color é cosmético — NÃO é único (o unique global antigo uni_Queues_color
	// impedia dois tenants de usarem a mesma cor). Dropado na migração.
	Color                string    `gorm:"not null" json:"color"`
	GreetingMessage      string    `gorm:"column:greetingMessage" json:"greetingMessage"`
	DistributionStrategy string    `gorm:"column:distributionStrategy;default:'MANUAL'" json:"distributionStrategy"`
	PrioritizeWallet     bool      `gorm:"column:prioritizeWallet;default:false" json:"prioritizeWallet"`
	ParentID             *int      `gorm:"column:parentId" json:"parentId"`
	TenantID             uuid.UUID `gorm:"column:tenantId;type:uuid;uniqueIndex:idx_queues_tenant_name" json:"tenantId"`
	CreatedAt            time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt            time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	// Relations
	Parent    *Queue     `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Whatsapps []Whatsapp `gorm:"many2many:whatsapp_queues;" json:"whatsapps,omitempty"`
}

func (Queue) TableName() string {
	return "Queues"
}
