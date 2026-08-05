package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

// mockSettingRepo implements domain.SettingRepository for testing.
type mockSettingRepo struct {
	settings []models.Setting
	err      error
}

func (m *mockSettingRepo) FindPublicSettings(_ context.Context, _ []string) ([]models.Setting, error) {
	return m.settings, m.err
}

func setupSettingTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	return testutil.NewTestDB(t)
}

func setupSettingContext(t *testing.T, db *gorm.DB, tenantID uuid.UUID, method, path string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var req *http.Request
	if body != nil {
		req, _ = http.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, _ = http.NewRequest(method, path, nil)
	}
	c.Request = req
	c.Set("tenantId", tenantID)
	c.Set("alcance", "tenant")
	c.Set("userId", float64(1))
	scoped := db.Where(`"tenantId" = ?`, tenantID)
	c.Set("db", scoped)
	return c, w
}

func TestSettingController_ListSettings(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSettingTestDB(t)
	tenantID := uuid.New()

	db.Exec(`INSERT INTO "Settings" (key, value, "tenantId") VALUES (?,?,?)`, "siteName", "Watink", tenantID)
	db.Exec(`INSERT INTO "Settings" (key, value, "tenantId") VALUES (?,?,?)`, "otherKey", "other", uuid.New())

	ctrl := NewSettingController(&mockSettingRepo{}, nil)
	c, w := setupSettingContext(t, db, tenantID, "GET", "/settings", nil)

	ctrl.ListSettings(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var settings []map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &settings))
	assert.Len(t, settings, 1)
	assert.Equal(t, "siteName", settings[0]["key"])
}

func TestSettingController_ListSettings_NoAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/settings", nil)
	c.Request = req
	// no tenantId set — GetScoped will abort with 401

	ctrl := NewSettingController(&mockSettingRepo{}, nil)
	ctrl.ListSettings(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSettingController_UpdateSetting_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSettingTestDB(t)
	tenantID := uuid.New()

	ctrl := NewSettingController(&mockSettingRepo{}, nil)
	payload, _ := json.Marshal(map[string]string{"value": "NewValue"})
	c, w := setupSettingContext(t, db, tenantID, "PUT", "/settings/siteName", payload)
	c.Params = gin.Params{{Key: "key", Value: "siteName"}}

	ctrl.UpdateSetting(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var s map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &s))
	assert.Equal(t, "NewValue", s["value"])
}

func TestSettingController_UpdateSetting_MissingValue(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSettingTestDB(t)
	tenantID := uuid.New()

	ctrl := NewSettingController(&mockSettingRepo{}, nil)
	payload, _ := json.Marshal(map[string]string{})
	c, w := setupSettingContext(t, db, tenantID, "PUT", "/settings/key", payload)
	c.Params = gin.Params{{Key: "key", Value: "key"}}

	ctrl.UpdateSetting(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSettingController_UpdateSetting_EmptyValue_AllowsClearingSetting(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSettingTestDB(t)
	tenantID := uuid.New()

	ctrl := NewSettingController(&mockSettingRepo{}, nil)
	payload, _ := json.Marshal(map[string]string{"value": ""})
	c, w := setupSettingContext(t, db, tenantID, "PUT", "/settings/systemLogo", payload)
	c.Params = gin.Params{{Key: "key", Value: "systemLogo"}}

	ctrl.UpdateSetting(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var s map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &s))
	assert.Equal(t, "", s["value"])
}

func TestSettingController_GetPublicSettings_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockSettingRepo{
		settings: []models.Setting{{Key: "systemLogo", Value: "logo.png"}},
	}

	ctrl := NewSettingController(repo, nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/public-settings", nil)
	c.Request = req

	ctrl.GetPublicSettings(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var result []map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Len(t, result, 1)
}

func TestSettingController_GetPublicSettings_Error(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockSettingRepo{err: errors.New("db error")}

	ctrl := NewSettingController(repo, nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/public-settings", nil)
	c.Request = req

	ctrl.GetPublicSettings(c)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}
