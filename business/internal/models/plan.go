package models

import (
	"time"

	"gorm.io/datatypes"
)

type Plan struct {
	ID               int            `gorm:"primaryKey" json:"id"`
	Name             string         `gorm:"unique;not null" json:"name"`
	UsersLimit       int            `gorm:"column:usersLimit;default:0" json:"usersLimit"`
	ConnectionsLimit int            `gorm:"column:connectionsLimit;default:0" json:"connectionsLimit"`
	QueuesLimit      int            `gorm:"column:queuesLimit;default:0" json:"queuesLimit"`
	PluginQuota      int            `gorm:"column:pluginQuota;default:0" json:"pluginQuota"`
	// PluginEntitlements é a lista de slugs de plugins `pro` que este plano
	// concede — eixo comercial próprio, distinto da licença do Hub (autoridade
	// sobre PODER usar) e de PluginInstallations (alocação, ESTÁ usando).
	// Populado pelo snapshot do Watink SaaS (plan_only mode); vazio/nulo = nenhum.
	PluginEntitlements datatypes.JSON `gorm:"column:pluginEntitlements;type:jsonb;default:'[]'" json:"pluginEntitlements"`
	Price              float64        `gorm:"type:decimal(10,2)" json:"price"`
	Active             bool           `gorm:"default:true" json:"active"`
	CreatedAt          time.Time      `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt          time.Time      `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Plan) TableName() string {
	return "Plans"
}
