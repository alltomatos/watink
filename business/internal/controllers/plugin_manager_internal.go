package controllers

import (
	"net/http"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// BuildInfo é a versão real do binário rodando -- os mesmos GitCommit/
// GitBranch/GitCommitDate setados via -ldflags no build (Dockerfile.business)
// e já expostos publicamente em GET /api/v1/about. Injetado por main.go
// (única fonte de verdade desses valores, package main) via SetupRoutes.
type BuildInfo struct {
	GitCommit     string
	GitBranch     string
	GitCommitDate string
}

// PluginManagerInternalController serve o grupo /internal/plugin-manager —
// API interna consumida EXCLUSIVAMENTE pelo plugin-manager local (via
// X-Internal-Token), que repassa esses números no `counters` do heartbeat
// pro Watink Hub. Opera cross-tenant com o DB sem escopo (soma TODOS os
// tenants da instância) — o Hub não conhece cada tenant em separado (ADR 0003),
// só a instância como um todo.
type PluginManagerInternalController struct {
	db    *gorm.DB
	build BuildInfo
}

func NewPluginManagerInternalController(db *gorm.DB, build BuildInfo) *PluginManagerInternalController {
	return &PluginManagerInternalController{db: db, build: build}
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

	// dbVersion é a versão real do servidor Postgres -- não existe tabela de
	// migration dedicada (GORM AutoMigrate puro), então isto é o dado
	// concreto mais próximo de "versão do banco" que existe de fato.
	var dbVersion string
	if err := ctrl.db.Raw("SHOW server_version").Scan(&dbVersion).Error; err != nil {
		dbVersion = "unknown"
	}

	c.JSON(http.StatusOK, gin.H{
		"users":            users,
		"connections":      connections,
		"messagesSent":     messagesSent,
		"messagesReceived": messagesReceived,
		"gitCommit":        ctrl.build.GitCommit,
		"gitBranch":        ctrl.build.GitBranch,
		"gitCommitDate":    ctrl.build.GitCommitDate,
		"dbEngine":         "PostgreSQL",
		"dbVersion":        dbVersion,
		"admins":           admins,
		"collectedAt":      time.Now().UTC(),
	})
}
