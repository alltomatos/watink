package middleware

import (
	"log/slog"
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TenantStatusGate bloqueia requests de um Tenant com Status "suspended" ou
// "canceled" (Onda 2/A.3 do watink-saas — control plane que grava esse status
// via PATCH /internal/saas/tenants/:tenantId/status). Usuários com
// Alcance="plataforma" (superadmin) sempre passam — o dono precisa continuar
// operando a instância mesmo com tenants suspensos por inadimplência.
//
// Chain order: IsAuth (seta tenantId/alcance) → TenantStatusGate → (handlers).
// Falha ao consultar o status (erro de banco) NUNCA bloqueia — fail-open aqui
// de propósito: uma indisponibilidade transitória do Postgres não pode
// derrubar o acesso de todos os tenants ativos por causa de um gate de
// billing. O invariante fail-closed do ecossistema é para CRESCIMENTO de
// licença de plugin (Hub), não para o uso já pago do produto.
func TenantStatusGate(svc *services.TenantStatusService) gin.HandlerFunc {
	return func(c *gin.Context) {
		alcance, _ := c.Get("alcance")
		if alcanceStr, ok := alcance.(string); ok && alcanceStr == "plataforma" {
			c.Next()
			return
		}

		// Bypass de logout (docs/integration-core.md §2.1): um tenant
		// suspenso/cancelado precisa continuar conseguindo sair da conta.
		// /auth/refresh_token não passa por aqui -- fica fora do grupo
		// `protected` (routes.go), então não precisa de bypass explícito.
		if c.FullPath() == "/api/v1/auth/logout" {
			c.Next()
			return
		}

		tenantIDRaw, exists := c.Get("tenantId")
		if !exists {
			c.Next()
			return
		}
		tenantIDStr, _ := tenantIDRaw.(string)
		tenantID, err := uuid.Parse(tenantIDStr)
		if err != nil {
			c.Next()
			return
		}

		status, err := svc.GetStatus(tenantID)
		if err != nil {
			slog.Warn("TenantStatusGate: falha ao consultar status do tenant, seguindo (fail-open)", "tenantId", tenantID, "error", err)
			c.Next()
			return
		}

		if status == "suspended" || status == "canceled" {
			c.JSON(http.StatusForbidden, gin.H{"error": "tenant_" + status, "status": status})
			c.Abort()
			return
		}

		c.Next()
	}
}
