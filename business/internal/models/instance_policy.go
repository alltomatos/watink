package models

import "time"

// InstancePolicy é uma tabela de linha única, instance-wide (nunca por
// tenant) — guarda a política de marketplace resolvida para esta instância
// do Watink, escrita pelo control plane Watink SaaS via
// PUT /internal/saas/instance/policy (Passo 3 do plano de marketplaceMode,
// ADR 0026). Ausência de linha é um estado válido: marketplaceMode() cai
// para o fallback por env var (ver plugin_marketplace_policy.go).
//
// Os campos Saas* guardam o contrato de pareamento com um Watink SaaS
// hospedado (Modo SaaS) — substituem as envs SAAS_BASE_URL/SAAS_INSTANCE_ID/
// SAAS_INTERNAL_TOKEN como fonte de verdade, permitindo ativar o contrato
// pela UI sem editar .env nem reiniciar o processo. Todos nullable: uma
// instância sem Modo SaaS ativado simplesmente não os preenche, e a
// resolução cai para o fallback por env var (mesma precedência do
// marketplaceMode). SaasInternalTokenEnc é sempre cifrado at-rest
// (business/pkg/cryptobox) — nunca gravar o token em texto plano.
type InstancePolicy struct {
	ID                   int        `gorm:"primaryKey" json:"id"`
	MarketplaceMode      string     `gorm:"column:marketplaceMode;not null" json:"marketplaceMode"`
	SaasBaseURL          *string    `gorm:"column:saasBaseUrl" json:"saasBaseUrl,omitempty"`
	SaasInstanceID       *string    `gorm:"column:saasInstanceId" json:"saasInstanceId,omitempty"`
	SaasInternalTokenEnc *string    `gorm:"column:saasInternalTokenEnc" json:"-"`
	PairedAt             *time.Time `gorm:"column:pairedAt" json:"pairedAt,omitempty"`
	LastSyncAt           *time.Time `gorm:"column:lastSyncAt" json:"lastSyncAt,omitempty"`
	UpdatedAt            time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (InstancePolicy) TableName() string {
	return "InstancePolicies"
}
