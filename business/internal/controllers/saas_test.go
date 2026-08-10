package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupSaasTestDB creates a PostgreSQL test DB with the tables used by saas controllers.
func setupSaasTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	return testutil.NewTestDB(t)
}

// injectSaasContext injects DB and superadmin identity into a gin context.
// saas.go uses auth.GetDB(c) which reads c.Get("db") — no tenant scoping required.
func injectSaasContext(c *gin.Context, db *gorm.DB) {
	c.Set("db", db)
	c.Set("alcance", "plataforma")
	c.Set("userId", float64(1))
	// tenantId is not required by saas handlers (they are not tenant-scoped)
}

// =====================================================================
// ListTenants
// =====================================================================

func TestListTenants_Empty(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/saas/tenants", nil)
	injectSaasContext(c, db)

	ListTenants(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var result []models.Tenant
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Len(t, result, 0)
}

func TestListTenants_ReturnsAll(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	tenantA := models.Tenant{ID: uuid.New(), Name: "Tenant A"}
	tenantB := models.Tenant{ID: uuid.New(), Name: "Tenant B"}
	require.NoError(t, db.Create(&tenantA).Error)
	require.NoError(t, db.Create(&tenantB).Error)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/saas/tenants", nil)
	injectSaasContext(c, db)

	ListTenants(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var result []models.Tenant
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Len(t, result, 2)
}

// =====================================================================
// GetTenantPlan
// =====================================================================

func TestGetTenantPlan_InvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "tenantId", Value: "not-a-uuid"}}
	c.Request, _ = http.NewRequest("GET", "/saas/tenants/not-a-uuid/plan", nil)
	injectSaasContext(c, db)

	GetTenantPlan(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetTenantPlan_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	missingID := uuid.New()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "tenantId", Value: missingID.String()}}
	c.Request, _ = http.NewRequest("GET", "/saas/tenants/"+missingID.String()+"/plan", nil)
	injectSaasContext(c, db)

	GetTenantPlan(c)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestGetTenantPlan_Found(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	tenant := models.Tenant{ID: uuid.New(), Name: "Watink Corp"}
	require.NoError(t, db.Create(&tenant).Error)
	plan := models.Plan{Name: "Pro", Price: 199.90}
	require.NoError(t, db.Create(&plan).Error)
	subscription := models.TenantSubscription{TenantID: tenant.ID, PlanID: plan.ID, Status: "active"}
	require.NoError(t, db.Create(&subscription).Error)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "tenantId", Value: tenant.ID.String()}}
	c.Request, _ = http.NewRequest("GET", "/saas/tenants/"+tenant.ID.String()+"/plan", nil)
	injectSaasContext(c, db)

	GetTenantPlan(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var result models.TenantSubscription
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Equal(t, tenant.ID, result.TenantID)
	assert.Equal(t, "Pro", result.Plan.Name)
}

// =====================================================================
// ListPlans
// =====================================================================

func TestListPlans_Empty(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/saas/plans", nil)
	injectSaasContext(c, db)

	ListPlans(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var result []models.Plan
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Len(t, result, 0)
}

func TestListPlans_ReturnsAll(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	require.NoError(t, db.Create(&models.Plan{Name: "free", Price: 0}).Error)
	require.NoError(t, db.Create(&models.Plan{Name: "pro", Price: 99.90}).Error)
	require.NoError(t, db.Create(&models.Plan{Name: "enterprise", Price: 499.00}).Error)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/saas/plans", nil)
	injectSaasContext(c, db)

	ListPlans(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var result []models.Plan
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Len(t, result, 3)
}

// =====================================================================
// CreatePlan
// =====================================================================

func TestCreatePlan_MissingBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/saas/plans", bytes.NewReader([]byte("not-json")))
	c.Request.Header.Set("Content-Type", "application/json")
	injectSaasContext(c, db)

	CreatePlan(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreatePlan_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	payload := map[string]interface{}{
		"name":             "starter",
		"price":            29.90,
		"usersLimit":       5,
		"connectionsLimit": 2,
		"queuesLimit":      3,
		"pluginQuota":      1,
		"active":           true,
	}
	body, _ := json.Marshal(payload)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/saas/plans", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	injectSaasContext(c, db)

	CreatePlan(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var result models.Plan
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Equal(t, "starter", result.Name)
	assert.InDelta(t, 29.90, result.Price, 0.01)

	// Verify persisted in DB
	var count int64
	db.Model(&models.Plan{}).Where("name = ?", "starter").Count(&count)
	assert.Equal(t, int64(1), count)
}

func TestCreatePlan_NoDuplicateName(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)

	require.NoError(t, db.Create(&models.Plan{Name: "unique"}).Error)

	payload := map[string]interface{}{"name": "unique", "price": 10.0}
	body, _ := json.Marshal(payload)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/saas/plans", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	injectSaasContext(c, db)

	CreatePlan(c)

	// SQLite UNIQUE constraint violation → 500 via RespondWithInternalError
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}
