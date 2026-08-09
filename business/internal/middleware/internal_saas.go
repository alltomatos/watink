package middleware

import (
	"crypto/subtle"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// InternalSaaSOnly protege o grupo de rotas /internal/saas (control plane do
// Watink SaaS). Compara o header X-Internal-Token (tempo constante) com o
// token resolvido nesta ordem: (1) contrato de Modo SaaS gravado no banco via
// cache (ver services.SaaSContractService/SaaSTokenCache) — (2) env
// SAAS_INTERNAL_TOKEN, para os deploys auto-hospedados que já configuram o
// contrato por .env. cache pode ser nil (instalação que nunca ativou o Modo
// SaaS pela UI) — nesse caso o comportamento é idêntico ao de antes desta
// mudança, resolvendo só pela env.
//
// Fail-closed: nem banco nem env → 503 para qualquer chamada. Uma instalação
// que não usa o Watink SaaS simplesmente não configura nenhum dos dois e NADA
// muda para ela. O segredo é distinto do INTERNAL_TOKEN (serviço de
// knowledge) de propósito — blast radius separado — e cada instalação define
// o SEU token, então comprometer um não abre os demais.
//
// Estas rotas operam cross-tenant por natureza (como as /saas de superadmin):
// não passam por IsAuth/TenantMiddleware e usam o DB sem escopo com WHERE
// explícito. Montar SEMPRE fora da cadeia JWT protegida.
func InternalSaaSOnly(cache *SaaSTokenCache) gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := ""
		if cache != nil {
			if token, ok := cache.Token(); ok {
				expected = token
			}
		}
		if expected == "" {
			expected = os.Getenv("SAAS_INTERNAL_TOKEN")
		}
		if expected == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "saas control plane disabled"})
			c.Abort()
			return
		}
		got := c.GetHeader("X-Internal-Token")
		if subtle.ConstantTimeCompare([]byte(got), []byte(expected)) != 1 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid internal token"})
			c.Abort()
			return
		}
		c.Next()
	}
}
