package controllers

import (
	"errors"
	"os"

	"github.com/alltomatos/watinkdev/business/internal/models"
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
	var policy models.InstancePolicy
	err := db.First(&policy).Error
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
