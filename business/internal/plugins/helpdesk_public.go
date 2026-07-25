package plugins

import (
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/gin-gonic/gin"
)

// handlePublicProtocol — GET /public/protocols/:token, SEM autenticação. O
// token é a única credencial (gerado em generateProtocolToken na criação);
// não passa pelo gating de licença do plugin (RegisterPublicRoute — ver
// helpdesk.go), então não há tenant a validar antes do lookup. Shape de
// resposta casa com frontend/src/pages/PublicProtocol/publicProtocolTypes.ts,
// deliberadamente mais enxuto que o Protocol autenticado (sem token/id
// internos, sem dados de Contact).
func handlePublicProtocol(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db := core.GetDB()

		var protocol models.Protocol
		if err := db.Where("token = ?", c.Param("token")).First(&protocol).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "protocol not found"})
			return
		}

		var tenant models.Tenant
		db.Where("id = ?", protocol.TenantID).First(&tenant)

		var history []models.ProtocolLog
		db.Preload("User").Where(`"protocolId" = ?`, protocol.ID).Order(`"createdAt" ASC`).Find(&history)

		items := make([]gin.H, 0, len(history))
		for _, h := range history {
			item := gin.H{
				"id":        strconv.Itoa(h.ID),
				"action":    h.Action,
				"createdAt": h.CreatedAt,
			}
			if h.Comment != "" {
				item["comment"] = h.Comment
			}
			if h.PreviousValue != "" || h.NewValue != "" {
				item["changes"] = h.PreviousValue + " → " + h.NewValue
			}
			if h.User.ID != 0 {
				item["user"] = gin.H{"name": h.User.Name}
			}
			items = append(items, item)
		}

		c.JSON(http.StatusOK, gin.H{
			"protocolNumber": protocol.ProtocolNumber,
			"status":         protocol.Status,
			"priority":       protocol.Priority,
			"subject":        protocol.Subject,
			"description":    protocol.Description,
			"category":       protocol.Category,
			"createdAt":      protocol.CreatedAt,
			"tenant":         gin.H{"name": tenant.Name},
			"history":        items,
		})
	}
}
