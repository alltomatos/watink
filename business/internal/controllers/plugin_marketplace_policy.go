package controllers

import (
	"encoding/json"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// marketplaceMode resolve o modo de marketplace desta instância (ADR 0026).
// Delega para services.ResolveMarketplaceMode — única implementação do
// fallback InstancePolicy > SAAS_INTERNAL_TOKEN > self_service (issue #630;
// antes havia uma cópia duplicada aqui e outra em
// services.setup_service.go, uma para cada lado do ciclo de import).
func marketplaceMode(db *gorm.DB) string {
	return services.ResolveMarketplaceMode(db)
}

// planEntitlements resolve os slugs de plugin `pro` que o plano atual do
// tenant concede (Plan.PluginEntitlements, populado pelo snapshot do Watink
// SaaS). Fail-closed: qualquer situação que impeça saber com certeza o que o
// plano concede (sem assinatura, sem plano, JSON inválido) devolve slice
// vazio -- nenhum plugin implicitamente liberado.
func planEntitlements(db *gorm.DB, tenantID uuid.UUID) []string {
	var sub models.TenantSubscription
	if err := db.Session(&gorm.Session{NewDB: true}).Preload("Plan").Where(`"tenantId" = ?`, tenantID).First(&sub).Error; err != nil {
		return []string{}
	}
	if len(sub.Plan.PluginEntitlements) == 0 {
		return []string{}
	}
	var slugs []string
	if err := json.Unmarshal(sub.Plan.PluginEntitlements, &slugs); err != nil {
		return []string{}
	}
	return slugs
}

func entitlementIncludes(entitlements []string, slug string) bool {
	for _, s := range entitlements {
		if s == slug {
			return true
		}
	}
	return false
}
