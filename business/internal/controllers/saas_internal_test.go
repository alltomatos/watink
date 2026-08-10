package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =====================================================================
// SetInstancePolicy
// =====================================================================

func TestSetInstancePolicy_InvalidMode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)
	ctrl := NewSaaSInternalController(db, nil)

	payload := map[string]interface{}{"marketplaceMode": "not-a-mode"}
	body, _ := json.Marshal(payload)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/internal/saas/instance/policy", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	ctrl.SetInstancePolicy(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSetInstancePolicy_CreatesWhenAbsent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)
	ctrl := NewSaaSInternalController(db, nil)

	payload := map[string]interface{}{"marketplaceMode": "plan_only"}
	body, _ := json.Marshal(payload)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/internal/saas/instance/policy", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	ctrl.SetInstancePolicy(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var count int64
	db.Model(&models.InstancePolicy{}).Count(&count)
	assert.Equal(t, int64(1), count)

	var policy models.InstancePolicy
	require.NoError(t, db.First(&policy).Error)
	assert.Equal(t, "plan_only", policy.MarketplaceMode)
}

func TestSetInstancePolicy_UpdatesWhenPresent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSaasTestDB(t)
	require.NoError(t, db.Create(&models.InstancePolicy{MarketplaceMode: "self_service"}).Error)
	ctrl := NewSaaSInternalController(db, nil)

	payload := map[string]interface{}{"marketplaceMode": "catalog_visible"}
	body, _ := json.Marshal(payload)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/internal/saas/instance/policy", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	ctrl.SetInstancePolicy(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var count int64
	db.Model(&models.InstancePolicy{}).Count(&count)
	assert.Equal(t, int64(1), count)

	var policy models.InstancePolicy
	require.NoError(t, db.First(&policy).Error)
	assert.Equal(t, "catalog_visible", policy.MarketplaceMode)
}
