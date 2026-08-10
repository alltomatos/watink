// Package usagestats centraliza a coleta de uso por tenant consumida pelo
// control plane Watink SaaS — tanto pelo caminho push
// (/internal/saas/tenants/{id}/usage, saas_internal.go) quanto pelo pull
// (POST /instance/sync, saasclient/worker.go). Cross-tenant por natureza:
// consumido só por código já fora de IsAuth/TenantMiddleware.
package usagestats

import (
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// messagesWindow é o período considerado para mensagens enviadas/recebidas —
// contagem all-time seria uma varredura cara e sem valor de KPI para tenants
// antigos; 30 dias reflete uso corrente.
const messagesWindow = 30 * 24 * time.Hour

// TenantUsage é o snapshot de uso de um tenant devolvido ao Watink SaaS.
type TenantUsage struct {
	Users            int64     `json:"users"`
	Connections      int64     `json:"connections"`
	Queues           int64     `json:"queues"`
	PluginsActive    int64     `json:"pluginsActive"`
	MessagesSent     int64     `json:"messagesSent"`
	MessagesReceived int64     `json:"messagesReceived"`
	CollectedAt      time.Time `json:"collectedAt"`
}

// Collect roda as seis contagens de uso do tenant. db deve ser um handle
// sem escopo de tenant já aplicado (o chamador é sempre cross-tenant por
// design — control plane).
func Collect(db *gorm.DB, tenantID uuid.UUID) (TenantUsage, error) {
	var usage TenantUsage
	usage.CollectedAt = time.Now().UTC()

	if err := db.Model(&models.User{}).Where(`"tenantId" = ?`, tenantID).Count(&usage.Users).Error; err != nil {
		return usage, err
	}
	if err := db.Model(&models.Whatsapp{}).Where(`"tenantId" = ?`, tenantID).Count(&usage.Connections).Error; err != nil {
		return usage, err
	}
	if err := db.Model(&models.Queue{}).Where(`"tenantId" = ?`, tenantID).Count(&usage.Queues).Error; err != nil {
		return usage, err
	}
	if err := db.Model(&models.PluginInstallation{}).Where(`"tenantId" = ? AND active = ?`, tenantID, true).Count(&usage.PluginsActive).Error; err != nil {
		return usage, err
	}

	since := usage.CollectedAt.Add(-messagesWindow)
	if err := db.Model(&models.Message{}).
		Where(`"tenantId" = ? AND "fromMe" = ? AND "createdAt" >= ?`, tenantID, true, since).
		Count(&usage.MessagesSent).Error; err != nil {
		return usage, err
	}
	if err := db.Model(&models.Message{}).
		Where(`"tenantId" = ? AND "fromMe" = ? AND "createdAt" >= ?`, tenantID, false, since).
		Count(&usage.MessagesReceived).Error; err != nil {
		return usage, err
	}

	return usage, nil
}

// ToMap serializa para o formato solto (map[string]any) esperado pelo campo
// Tenants do contrato de sync (pull) — mantém o contrato existente sem
// introduzir um tipo compartilhado entre os dois repos (watink-saas é
// consumidor externo, nunca importa este pacote).
func (u TenantUsage) ToMap(tenantID uuid.UUID) map[string]any {
	return map[string]any{
		"id":               tenantID.String(),
		"users":            u.Users,
		"connections":      u.Connections,
		"queues":           u.Queues,
		"pluginsActive":    u.PluginsActive,
		"messagesSent":     u.MessagesSent,
		"messagesReceived": u.MessagesReceived,
		"collectedAt":      u.CollectedAt,
	}
}
