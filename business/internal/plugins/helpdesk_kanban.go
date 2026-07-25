package plugins

import (
	"net/http"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/gin-gonic/gin"
)

// kanbanColumnDef espelha os 5 status já conhecidos pelo frontend
// (helpdeskTypes.ts: statusLabels/getStatusBadgeClass) — mantidos em paridade
// aqui para o backend devolver label/color/bgColor prontos, sem duplicar a
// lista em dois lugares divergentes.
type kanbanColumnDef struct {
	status  string
	label   string
	color   string
	bgColor string
}

var kanbanColumns = []kanbanColumnDef{
	{"open", "Aberto", "var(--status-info)", "bg-info/10"},
	{"in_progress", "Em Andamento", "var(--status-warning)", "bg-warning/10"},
	{"pending", "Pendente", "var(--muted-foreground)", "bg-muted"},
	{"resolved", "Resolvido", "var(--status-success)", "bg-success/10"},
	{"closed", "Fechado", "var(--muted-foreground)", "bg-muted"},
}

// handleKanban — GET /helpdesk/protocols/kanban
func handleKanban(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := auth.TenantUUIDFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
			return
		}

		var protocols []models.Protocol
		core.GetDB().Preload("Contact").Preload("Contact.Client").
			Where(`"tenantId" = ?`, tenantID).
			Order(`"createdAt" DESC`).Find(&protocols)

		byStatus := make(map[string][]kanbanProtocolDTO, len(kanbanColumns))
		for _, p := range protocols {
			byStatus[p.Status] = append(byStatus[p.Status], toKanbanProtocolDTO(p))
		}

		columns := make([]gin.H, 0, len(kanbanColumns))
		for _, def := range kanbanColumns {
			items := byStatus[def.status]
			if items == nil {
				items = []kanbanProtocolDTO{}
			}
			columns = append(columns, gin.H{
				"status":    def.status,
				"label":     def.label,
				"color":     def.color,
				"bgColor":   def.bgColor,
				"protocols": items,
			})
		}

		c.JSON(http.StatusOK, gin.H{"columns": columns})
	}
}

type statusCount struct {
	Status string `json:"status"`
	Count  int64  `json:"count"`
}
type priorityCount struct {
	Priority string `json:"priority"`
	Count    int64  `json:"count"`
}
type categoryCount struct {
	Category string `json:"category"`
	Count    int64  `json:"count"`
}

// handleDashboard — GET /helpdesk/protocols/dashboard. slaStatus é um
// PLACEHOLDER honesto: não existe (ainda) configuração de SLA/prazo por
// prioridade ou categoria em nenhum lugar do sistema — o heurístico aqui
// (open/in_progress com mais de 24h = overdue) é um valor razoável só
// enquanto não houver uma política de SLA real configurável.
func handleDashboard(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := auth.TenantUUIDFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
			return
		}

		db := core.GetDB()

		var statusCounts []statusCount
		db.Model(&models.Protocol{}).
			Select("status, count(*) as count").
			Where(`"tenantId" = ?`, tenantID).
			Group("status").Scan(&statusCounts)

		var priorityCounts []priorityCount
		db.Model(&models.Protocol{}).
			Select("priority, count(*) as count").
			Where(`"tenantId" = ?`, tenantID).
			Group("priority").Scan(&priorityCounts)

		var categoryCounts []categoryCount
		db.Model(&models.Protocol{}).
			Select("category, count(*) as count").
			Where(`"tenantId" = ? AND category != ''`, tenantID).
			Group("category").Order("count DESC").Limit(10).Scan(&categoryCounts)

		var onTime, overdue int64
		slaThreshold := time.Now().Add(-24 * time.Hour)
		db.Model(&models.Protocol{}).
			Where(`"tenantId" = ? AND status IN ('open','in_progress') AND "createdAt" >= ?`, tenantID, slaThreshold).
			Count(&onTime)
		db.Model(&models.Protocol{}).
			Where(`"tenantId" = ? AND status IN ('open','in_progress') AND "createdAt" < ?`, tenantID, slaThreshold).
			Count(&overdue)

		c.JSON(http.StatusOK, gin.H{
			"statusCounts":   statusCounts,
			"priorityCounts": priorityCounts,
			"categoryCounts": categoryCounts,
			"slaStatus":      gin.H{"onTime": onTime, "overdue": overdue},
		})
	}
}
