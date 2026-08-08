package controllers

import (
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListTenants returns all tenants.
// Route is guarded by SuperAdminOnly middleware — only superadmins reach this handler.
// @Summary      Listar tenants (superadmin)
// @Tags         saas
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Security     BearerAuth
// @Router       /saas/tenants [get]
func ListTenants(c *gin.Context) {
	var tenants []models.Tenant
	if err := auth.GetDB(c).Find(&tenants).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListTenants")
		return
	}
	c.JSON(http.StatusOK, tenants)
}

// GetTenantPlan returns the tenant's subscription + plan.
// Route is guarded by SuperAdminOnly middleware.
// @Summary      Plano do tenant (superadmin)
// @Tags         saas
// @Produce      json
// @Param        tenantId  path      string  true  "UUID do tenant"
// @Success      200       {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /saas/tenants/{tenantId}/plan [get]
func GetTenantPlan(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("tenantId"))
	if err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	var subscription models.TenantSubscription
	if err := auth.GetDB(c).Preload("Plan").Where(`"tenantId" = ?`, tenantID).First(&subscription).Error; err != nil {
		utils.RespondWithInternalError(c, err, "GetTenantPlan")
		return
	}

	c.JSON(http.StatusOK, subscription)
}

// ListPlans returns all plans.
// Route is guarded by SuperAdminOnly middleware.
// @Summary      Listar planos (superadmin)
// @Tags         saas
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Security     BearerAuth
// @Router       /saas/plans [get]
func ListPlans(c *gin.Context) {
	var plans []models.Plan
	if err := auth.GetDB(c).Find(&plans).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListPlans")
		return
	}
	c.JSON(http.StatusOK, plans)
}

// CreatePlan creates a new plan. Route is guarded by SuperAdminOnly middleware.
// @Summary      Criar plano (superadmin)
// @Tags         saas
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados do plano"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /saas/plans [post]
func CreatePlan(c *gin.Context) {
	var plan models.Plan
	if err := c.ShouldBindJSON(&plan); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	if _, err := utils.ValidateStringField(plan.Name, "name", 100); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := auth.GetDB(c).Create(&plan).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreatePlan")
		return
	}

	c.JSON(http.StatusOK, plan)
}
