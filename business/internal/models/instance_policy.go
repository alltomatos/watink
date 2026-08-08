package models

import "time"

// InstancePolicy é uma tabela de linha única, instance-wide (nunca por
// tenant) — guarda a política de marketplace resolvida para esta instância
// do Watink, escrita pelo control plane Watink SaaS via
// PUT /internal/saas/instance/policy (Passo 3 do plano de marketplaceMode,
// ADR 0026). Ausência de linha é um estado válido: marketplaceMode() cai
// para o fallback por env var (ver plugin_marketplace_policy.go).
type InstancePolicy struct {
	ID              int       `gorm:"primaryKey" json:"id"`
	MarketplaceMode string    `gorm:"column:marketplaceMode;not null" json:"marketplaceMode"`
	UpdatedAt       time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (InstancePolicy) TableName() string {
	return "InstancePolicies"
}
