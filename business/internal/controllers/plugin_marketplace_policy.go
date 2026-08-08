package controllers

import (
	"encoding/json"
	"errors"
	"os"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// marketplaceMode resolve o modo de marketplace desta instância (ADR 0026),
// em ordem de precedência:
//
//  1. InstancePolicy gravada (Passo 3 do watink-saas, via
//     PUT /internal/saas/instance/policy) — sempre vence quando existe.
//  2. SAAS_INTERNAL_TOKEN setado (instância gerida por um Watink SaaS, mas
//     ainda sem política explícita gravada) → "catalog_visible", a promessa
//     do ADR 0026 até o SaaS empurrar a política real.
//  3. Nenhum dos dois → "self_service", o comportamento de hoje (Checkout
//     direto no Hub, sem intermediação de plano) byte-por-byte.
func marketplaceMode(db *gorm.DB) string {
	// Session(NewDB:true) obrigatório: db aqui é tipicamente o handle já
	// escopado por tenant devolvido por auth.GetScoped (WHERE "tenantId" =
	// ?) -- InstancePolicy não tem essa coluna, e reusar o handle sem sessão
	// nova acumula esse Where nas queries seguintes feitas no mesmo db
	// (bug real: quebrou os testes de Activate na primeira versão desta
	// função).
	var policy models.InstancePolicy
	err := db.Session(&gorm.Session{NewDB: true}).First(&policy).Error
	if err == nil {
		return policy.MarketplaceMode
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		// Falha inesperada de leitura: mesmo fallback de "sem política
		// gravada" -- não é um caso de licença (fail-closed em CRESCIMENTO),
		// é resolução de modo comercial, então degrada para o sinal seguinte.
		return marketplaceModeFromEnv()
	}
	return marketplaceModeFromEnv()
}

func marketplaceModeFromEnv() string {
	if os.Getenv("SAAS_INTERNAL_TOKEN") != "" {
		return "catalog_visible"
	}
	return "self_service"
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
