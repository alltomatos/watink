package controllers

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCalculateSLADueAt_DefaultsByPriority cobre os 4 defaults documentados
// em activities.md §SLA (urgent=2h, high=8h, medium=24h, low=72h) — falta de
// config nunca bloqueia a criação de uma Activity.
func TestCalculateSLADueAt_DefaultsByPriority(t *testing.T) {
	from := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	cfg := defaultActivitySLAConfig()

	cases := []struct {
		priority string
		want     time.Duration
	}{
		{"urgent", 2 * time.Hour},
		{"high", 8 * time.Hour},
		{"medium", 24 * time.Hour},
		{"low", 72 * time.Hour},
	}
	for _, tc := range cases {
		got := CalculateSLADueAt(cfg, tc.priority, from)
		require.NotNil(t, got)
		assert.Equal(t, from.Add(tc.want), *got, "priority=%s", tc.priority)
	}
}

// TestCalculateSLADueAt_CustomConfig confirma que a calculadora respeita a
// config do tenant quando presente, para as 4 prioridades.
func TestCalculateSLADueAt_CustomConfig(t *testing.T) {
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	cfg := ActivitySLAConfig{Low: 10, Medium: 20, High: 30, Urgent: 40}

	assert.Equal(t, from.Add(40*time.Minute), *CalculateSLADueAt(cfg, "urgent", from))
	assert.Equal(t, from.Add(30*time.Minute), *CalculateSLADueAt(cfg, "high", from))
	assert.Equal(t, from.Add(20*time.Minute), *CalculateSLADueAt(cfg, "medium", from))
	assert.Equal(t, from.Add(10*time.Minute), *CalculateSLADueAt(cfg, "low", from))
}

// TestActivityController_GetSLAConfig_DefaultsWhenUnset garante que
// GET /activities/sla-config nunca falha por ausência de Setting — devolve
// os defaults.
func TestActivityController_GetSLAConfig_DefaultsWhenUnset(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	ctrl := NewActivityController(nil)
	c, w := setupPipelineContext(t, db, tenantID, "GET", "/activities/sla-config", nil)

	ctrl.GetSLAConfig(c)

	require.Equal(t, http.StatusOK, w.Code)
	var resp activitySLAConfigResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, defaultActivitySLAConfig(), resp.SlaConfig)
	assert.Equal(t, defaultActivityStaleThresholdMinutes, resp.StaleThresholdMinutes)
}

// TestActivityController_UpdateSLAConfig_PersistsAndReads confirma que o
// PUT grava as duas Settings e que um GET subsequente lê os valores
// persistidos, não os defaults — regressão do bug de sempre reler o padrão.
func TestActivityController_UpdateSLAConfig_PersistsAndReads(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	payload, _ := json.Marshal(updateActivitySLAConfigRequest{
		SlaConfig:             ActivitySLAConfig{Low: 100, Medium: 200, High: 300, Urgent: 400},
		StaleThresholdMinutes: 15,
	})
	c, w := setupPipelineContext(t, db, tenantID, "PUT", "/activities/sla-config", payload)
	ctrl.UpdateSLAConfig(c)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	c2, w2 := setupPipelineContext(t, db, tenantID, "GET", "/activities/sla-config", nil)
	ctrl.GetSLAConfig(c2)

	require.Equal(t, http.StatusOK, w2.Code)
	var resp activitySLAConfigResponse
	require.NoError(t, json.Unmarshal(w2.Body.Bytes(), &resp))
	assert.Equal(t, ActivitySLAConfig{Low: 100, Medium: 200, High: 300, Urgent: 400}, resp.SlaConfig)
	assert.Equal(t, 15, resp.StaleThresholdMinutes)
}

// TestActivityController_UpdateSLAConfig_TenantIsolation garante que a
// config de um tenant nunca vaza para outro.
func TestActivityController_UpdateSLAConfig_TenantIsolation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	ctrl := NewActivityController(nil)

	payload, _ := json.Marshal(updateActivitySLAConfigRequest{
		SlaConfig:             ActivitySLAConfig{Low: 1, Medium: 2, High: 3, Urgent: 4},
		StaleThresholdMinutes: 5,
	})
	c, w := setupPipelineContext(t, db, tenantA, "PUT", "/activities/sla-config", payload)
	ctrl.UpdateSLAConfig(c)
	require.Equal(t, http.StatusOK, w.Code)

	c2, w2 := setupPipelineContext(t, db, tenantB, "GET", "/activities/sla-config", nil)
	ctrl.GetSLAConfig(c2)

	require.Equal(t, http.StatusOK, w2.Code)
	var resp activitySLAConfigResponse
	require.NoError(t, json.Unmarshal(w2.Body.Bytes(), &resp))
	assert.Equal(t, defaultActivitySLAConfig(), resp.SlaConfig, "tenant B não deve ver a config do tenant A")
}
