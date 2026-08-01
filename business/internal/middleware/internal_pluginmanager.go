package middleware

import (
	"crypto/subtle"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// InternalPluginManagerOnly protege o grupo de rotas /internal/plugin-manager
// (consumido pelo plugin-manager local, mesma rede interna do compose/swarm,
// nunca exposto via Nginx público). Compara o header X-Internal-Token (tempo
// constante) com a env PLUGIN_MANAGER_INTERNAL_TOKEN.
//
// Fail-closed: env ausente/vazia → 503 para qualquer chamada. Token distinto
// de SAAS_INTERNAL_TOKEN e INTERNAL_TOKEN (knowledge) de propósito — blast
// radius separado por cliente interno, mesmo padrão de internal_saas.go.
func InternalPluginManagerOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := os.Getenv("PLUGIN_MANAGER_INTERNAL_TOKEN")
		if expected == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "plugin-manager stats disabled"})
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
