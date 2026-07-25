package controllers

import (
	"errors"
	"net/http"
	"os"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// saasProvisioner é o subconjunto do SetupService que o control plane SaaS usa
// para nascer/atualizar tenants. Interface local (idioma Go: aceitar a interface
// onde se consome) para não acoplar o controller ao tipo concreto nem tocar em
// domain.SetupServiceInterface (e seus mocks).
type saasProvisioner interface {
	ProvisionTenant(data domain.TenantSeedData, spec domain.ProvisionPlanSpec, idempotencyKey string) (domain.ProvisionResult, error)
	PushSubscription(tenantID uuid.UUID, spec domain.ProvisionPlanSpec, status string, expiresAt *time.Time) error
}

// SaaSInternalController serve o grupo /internal/saas — a API interna consumida
// EXCLUSIVAMENTE pelo control plane Watink SaaS (via X-Internal-Token). Opera
// cross-tenant com o DB sem escopo e WHERE explícito; nunca passa por
// IsAuth/TenantMiddleware.
type SaaSInternalController struct {
	db   *gorm.DB
	prov saasProvisioner
}

func NewSaaSInternalController(db *gorm.DB, prov saasProvisioner) *SaaSInternalController {
	return &SaaSInternalController{db: db, prov: prov}
}

// Ping godoc
// @Summary      Ping do control plane SaaS
// @Tags         internal-saas
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /internal/saas/ping [get]
func (ctrl *SaaSInternalController) Ping(c *gin.Context) {
	var count int64
	if err := ctrl.db.Model(&models.Tenant{}).Count(&count).Error; err != nil {
		utils.RespondWithInternalError(c, err, "SaaSPing")
		return
	}
	version := os.Getenv("APP_VERSION")
	if version == "" {
		version = "dev"
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "version": version, "tenants": count})
}

type provisionPlanBody struct {
	Name             string  `json:"name"`
	UsersLimit       int     `json:"usersLimit"`
	ConnectionsLimit int     `json:"connectionsLimit"`
	QueuesLimit      int     `json:"queuesLimit"`
	PluginQuota      int     `json:"pluginQuota"`
	Price            float64 `json:"price"`
	Active           bool    `json:"active"`
}

func (b provisionPlanBody) toSpec() domain.ProvisionPlanSpec {
	return domain.ProvisionPlanSpec{
		Name:             b.Name,
		UsersLimit:       b.UsersLimit,
		ConnectionsLimit: b.ConnectionsLimit,
		QueuesLimit:      b.QueuesLimit,
		PluginQuota:      b.PluginQuota,
		Price:            b.Price,
		Active:           b.Active,
	}
}

type provisionTenantBody struct {
	CompanyName    string            `json:"companyName" binding:"required"`
	FirstName      string            `json:"firstName" binding:"required"`
	LastName       string            `json:"lastName"`
	Email          string            `json:"email" binding:"required,email"`
	Password       string            `json:"password" binding:"required"`
	Document       string            `json:"document"`
	IdempotencyKey string            `json:"idempotencyKey"`
	Plan           provisionPlanBody `json:"plan"`
}

// ProvisionTenant godoc
// @Summary      Provisionar tenant (control plane SaaS)
// @Tags         internal-saas
// @Accept       json
// @Produce      json
// @Success      201  {object}  map[string]interface{}
// @Failure      409  {object}  map[string]interface{}
// @Router       /internal/saas/tenants [post]
func (ctrl *SaaSInternalController) ProvisionTenant(c *gin.Context) {
	var req provisionTenantBody
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	// Mesmas validações do setup público (senha forte, tamanhos).
	if _, err := utils.ValidateStringField(req.CompanyName, "companyName", 255); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(req.FirstName, "firstName", 100); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(req.LastName, "lastName", 100); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(req.Password, "password", 128); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validatePasswordStrength(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(req.Document, "document", 50); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data := domain.TenantSeedData{
		CompanyName: req.CompanyName,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		Email:       normalizeEmail(req.Email),
		Password:    req.Password,
		Document:    req.Document,
	}
	result, err := ctrl.prov.ProvisionTenant(data, req.Plan.toSpec(), req.IdempotencyKey)
	if err != nil {
		if errors.Is(err, services.ErrEmailAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "email_already_exists"})
			return
		}
		utils.RespondWithInternalError(c, err, "SaaSProvisionTenant")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"tenantId": result.TenantID, "ownerUserId": result.OwnerUserID})
}

type setStatusBody struct {
	Status string `json:"status" binding:"required"`
	Reason string `json:"reason"`
}

// SetStatus godoc
// @Summary      Alterar status comercial do tenant (control plane SaaS)
// @Tags         internal-saas
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      404  {object}  map[string]interface{}
// @Router       /internal/saas/tenants/{tenantId}/status [patch]
func (ctrl *SaaSInternalController) SetStatus(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("tenantId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant id"})
		return
	}
	var body setStatusBody
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	switch body.Status {
	case "active", "suspended", "canceled":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be active, suspended or canceled"})
		return
	}
	res := ctrl.db.Model(&models.Tenant{}).Where("id = ?", tenantID).Update("status", body.Status)
	if res.Error != nil {
		utils.RespondWithInternalError(c, res.Error, "SaaSSetStatus")
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"tenantId": tenantID.String(), "status": body.Status})
}

type pushSubscriptionBody struct {
	Plan         provisionPlanBody `json:"plan"`
	Subscription struct {
		Status    string     `json:"status" binding:"required"`
		ExpiresAt *time.Time `json:"expiresAt"`
	} `json:"subscription"`
}

// PushSubscription godoc
// @Summary      Push do snapshot de assinatura (control plane SaaS)
// @Tags         internal-saas
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      404  {object}  map[string]interface{}
// @Router       /internal/saas/tenants/{tenantId}/subscription [put]
func (ctrl *SaaSInternalController) PushSubscription(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("tenantId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant id"})
		return
	}
	var body pushSubscriptionBody
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	switch body.Subscription.Status {
	case "active", "trialing", "expired", "canceled":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "subscription status must be active, trialing, expired or canceled"})
		return
	}
	if err := ctrl.prov.PushSubscription(tenantID, body.Plan.toSpec(), body.Subscription.Status, body.Subscription.ExpiresAt); err != nil {
		if errors.Is(err, services.ErrTenantNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
			return
		}
		utils.RespondWithInternalError(c, err, "SaaSPushSubscription")
		return
	}
	c.JSON(http.StatusOK, gin.H{"tenantId": tenantID.String(), "status": body.Subscription.Status})
}

// Usage godoc
// @Summary      Uso corrente do tenant (control plane SaaS)
// @Tags         internal-saas
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /internal/saas/tenants/{tenantId}/usage [get]
func (ctrl *SaaSInternalController) Usage(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("tenantId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant id"})
		return
	}
	var users, connections, queues, pluginsActive int64
	if err := ctrl.db.Model(&models.User{}).Where(`"tenantId" = ?`, tenantID).Count(&users).Error; err != nil {
		utils.RespondWithInternalError(c, err, "SaaSUsageUsers")
		return
	}
	if err := ctrl.db.Model(&models.Whatsapp{}).Where(`"tenantId" = ?`, tenantID).Count(&connections).Error; err != nil {
		utils.RespondWithInternalError(c, err, "SaaSUsageConnections")
		return
	}
	if err := ctrl.db.Model(&models.Queue{}).Where(`"tenantId" = ?`, tenantID).Count(&queues).Error; err != nil {
		utils.RespondWithInternalError(c, err, "SaaSUsageQueues")
		return
	}
	if err := ctrl.db.Model(&models.PluginInstallation{}).Where(`"tenantId" = ? AND active = ?`, tenantID, true).Count(&pluginsActive).Error; err != nil {
		utils.RespondWithInternalError(c, err, "SaaSUsagePlugins")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"users":         users,
		"connections":   connections,
		"queues":        queues,
		"pluginsActive": pluginsActive,
		"collectedAt":   time.Now().UTC(),
	})
}

type tenantListRow struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Document   string    `json:"document"`
	Status     string    `json:"status"`
	OwnerEmail string    `json:"ownerEmail"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ListTenants godoc
// @Summary      Listar tenants para importação (control plane SaaS)
// @Tags         internal-saas
// @Produce      json
// @Success      200  {array}  map[string]interface{}
// @Router       /internal/saas/tenants [get]
func (ctrl *SaaSInternalController) ListTenants(c *gin.Context) {
	rows := make([]tenantListRow, 0)
	err := ctrl.db.Table(`"Tenants" t`).
		Select(`t.id, t.name, t.document, t.status, u.email AS owner_email, t."createdAt" AS created_at`).
		Joins(`LEFT JOIN "Users" u ON u.id = t."ownerId"`).
		Order(`t."createdAt" ASC`).
		Scan(&rows).Error
	if err != nil {
		utils.RespondWithInternalError(c, err, "SaaSListTenants")
		return
	}
	c.JSON(http.StatusOK, rows)
}
