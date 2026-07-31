package controllers

import (
	"net/http"
	"os"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PluginManagerInternalController serve o grupo /internal/plugin-manager —
// API interna consumida EXCLUSIVAMENTE pelo plugin-manager local (via
// X-Internal-Token), que repassa esses números no `counters` do heartbeat
// pro Watink Hub. Opera cross-tenant com o DB sem escopo (soma TODOS os
// tenants da instância) — o Hub não conhece cada tenant em separado (ADR 0003),
// só a instância como um todo.
type PluginManagerInternalController struct {
	db *gorm.DB
}

func NewPluginManagerInternalController(db *gorm.DB) *PluginManagerInternalController {
	return &PluginManagerInternalController{db: db}
}

type instanceStatsAdmin struct {
	TenantName string `json:"tenantName"`
	OwnerEmail string `json:"ownerEmail"`
}

type instanceStatsAdminRow struct {
	TenantName string `gorm:"column:tenant_name"`
	OwnerEmail string `gorm:"column:owner_email"`
}

// InstanceStats godoc
// @Summary      Uso agregado da instância (plugin-manager)
// @Tags         internal-plugin-manager
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /internal/plugin-manager/instance-stats [get]
func (ctrl *PluginManagerInternalController) InstanceStats(c *gin.Context) {
	var users, connections, messagesSent, messagesReceived int64

	if err := ctrl.db.Model(&models.User{}).Count(&users).Error; err != nil {
		utils.RespondWithInternalError(c, err, "PluginManagerInstanceStatsUsers")
		return
	}
	if err := ctrl.db.Model(&models.Whatsapp{}).Count(&connections).Error; err != nil {
		utils.RespondWithInternalError(c, err, "PluginManagerInstanceStatsConnections")
		return
	}
	if err := ctrl.db.Model(&models.Message{}).Where(`"fromMe" = ?`, true).Count(&messagesSent).Error; err != nil {
		utils.RespondWithInternalError(c, err, "PluginManagerInstanceStatsMessagesSent")
		return
	}
	if err := ctrl.db.Model(&models.Message{}).Where(`"fromMe" = ?`, false).Count(&messagesReceived).Error; err != nil {
		utils.RespondWithInternalError(c, err, "PluginManagerInstanceStatsMessagesReceived")
		return
	}

	var adminRows []instanceStatsAdminRow
	if err := ctrl.db.Table(`"Tenants" t`).
		Select(`t.name AS tenant_name, u.email AS owner_email`).
		Joins(`LEFT JOIN "Users" u ON u.id = t."ownerId"`).
		Order(`t."createdAt" ASC`).
		Scan(&adminRows).Error; err != nil {
		utils.RespondWithInternalError(c, err, "PluginManagerInstanceStatsAdmins")
		return
	}
	admins := make([]instanceStatsAdmin, 0, len(adminRows))
	for _, row := range adminRows {
		admins = append(admins, instanceStatsAdmin(row))
	}

	schemaVersion := os.Getenv("APP_VERSION")
	if schemaVersion == "" {
		schemaVersion = "dev"
	}

	c.JSON(http.StatusOK, gin.H{
		"users":            users,
		"connections":      connections,
		"messagesSent":     messagesSent,
		"messagesReceived": messagesReceived,
		"schemaVersion":    schemaVersion,
		"admins":           admins,
		"collectedAt":      time.Now().UTC(),
	})
}
