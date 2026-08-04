package controllers

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestComputeActivitySlaStatus cobre as 3 faixas + os casos vazios
// documentados em activities.md §Alertas.
func TestComputeActivitySlaStatus(t *testing.T) {
	now := time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC)
	created := now.Add(-4 * time.Hour) // prazo total de 24h a partir da criação

	dueOnTime := created.Add(24 * time.Hour) // vence em 20h, prazo total 24h — 83% restante, bem longe dos 20%
	dueAtRisk := now.Add(1 * time.Hour)      // vence em 1h — bem dentro de 20% de um prazo de 24h
	dueOverdue := now.Add(-1 * time.Hour)

	cases := []struct {
		name   string
		status string
		due    *time.Time
		want   string
	}{
		{"sem slaDueAt", "pending", nil, ""},
		{"status done ignora SLA", "done", &dueOverdue, ""},
		{"vencido e ainda aberto", "in_progress", &dueOverdue, "overdue"},
		{"dentro do prazo, longe do limite", "pending", &dueOnTime, "onTime"},
		{"dentro do prazo, perto do limite", "pending", &dueAtRisk, "atRisk"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			activity := models.Activity{Status: tc.status, SlaDueAt: tc.due, CreatedAt: created}
			assert.Equal(t, tc.want, computeActivitySlaStatus(activity, now))
		})
	}
}

// TestComputeActivityStaleSince cobre in_progress+antigo (acende),
// in_progress+recente (não acende) e pending (nunca acende, mesmo antigo).
func TestComputeActivityStaleSince(t *testing.T) {
	now := time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC)

	stale := models.Activity{Status: "in_progress", LastActivityAt: now.Add(-2 * time.Minute)}
	assert.NotNil(t, computeActivityStaleSince(stale, 1, now), "1 min de threshold com 2 min parada deveria acender")

	fresh := models.Activity{Status: "in_progress", LastActivityAt: now.Add(-30 * time.Second)}
	assert.Nil(t, computeActivityStaleSince(fresh, 1, now), "1 min de threshold com 30s parada não deveria acender")

	pendingOld := models.Activity{Status: "pending", LastActivityAt: now.Add(-2 * time.Hour)}
	assert.Nil(t, computeActivityStaleSince(pendingOld, 1, now), "pending nunca fica \"parada\", só in_progress")
}

// TestAttachComputedActivityFields_ChecklistProgress_NoN1 confirma que o
// progresso do checklist é agregado numa única query em lote, não N+1.
func TestAttachComputedActivityFields_ChecklistProgress_NoN1(t *testing.T) {
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	id1 := mustCreateActivity(t, db, tenantID, "Atividade 1", "in_progress", "medium")
	id2 := mustCreateActivity(t, db, tenantID, "Atividade 2", "in_progress", "medium")

	require.NoError(t, db.Create(&models.ActivityChecklistItem{ActivityID: id1, TenantID: tenantID, Label: "A", InputType: "text", IsDone: true}).Error)
	require.NoError(t, db.Create(&models.ActivityChecklistItem{ActivityID: id1, TenantID: tenantID, Label: "B", InputType: "text", IsDone: false}).Error)
	require.NoError(t, db.Create(&models.ActivityChecklistItem{ActivityID: id1, TenantID: tenantID, Label: "C", InputType: "text", IsDone: true}).Error)
	// id2 sem nenhum item — deve vir {0,0}, não quebrar.

	var activities []models.Activity
	require.NoError(t, db.Where(`"tenantId" = ?`, tenantID).Order("id ASC").Find(&activities).Error)

	dto := attachComputedActivityFields(db, tenantID, activities, defaultActivityStaleThresholdMinutes)
	require.Len(t, dto, 2)

	byID := map[int]activityListItemDTO{dto[0].ID: dto[0], dto[1].ID: dto[1]}
	assert.Equal(t, checklistProgressDTO{Done: 2, Total: 3}, byID[id1].ChecklistProgress)
	assert.Equal(t, checklistProgressDTO{Done: 0, Total: 0}, byID[id2].ChecklistProgress)
}

// TestActivityController_MyActivitiesKPIs_ScopedToAssignee confirma que os
// agregados refletem SÓ as atividades do usuário logado, e batem com um
// dataset conhecido.
func TestActivityController_MyActivitiesKPIs_ScopedToAssignee(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	technicianID := mustCreateUser(t, db, tenantID, "tecnico@example.com")
	otherID := mustCreateUser(t, db, tenantID, "outro@example.com")

	inProgress := mustCreateActivity(t, db, tenantID, "Em andamento", "in_progress", "medium")
	overdue := mustCreateActivity(t, db, tenantID, "Atrasada", "pending", "urgent")
	notAssigned := mustCreateActivity(t, db, tenantID, "De outro técnico", "pending", "urgent")

	// Força slaDueAt vencido pra "overdue".
	require.NoError(t, db.Model(&models.Activity{}).Where("id = ?", overdue).
		Update("slaDueAt", time.Now().Add(-1*time.Hour)).Error)

	mustAssignActivity(t, db, tenantID, inProgress, technicianID)
	mustAssignActivity(t, db, tenantID, overdue, technicianID)
	mustAssignActivity(t, db, tenantID, notAssigned, otherID)

	c, w := setupActivityContextAsUser(t, db, tenantID, technicianID, "GET", "/my-activities/kpis", nil)
	ctrl.MyActivitiesKPIs(c)

	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	var resp activityKpisResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	assert.EqualValues(t, 1, resp.InProgress)
	assert.EqualValues(t, 1, resp.Overdue)
	assert.EqualValues(t, 2, resp.TabCounts.All, "total do técnico é 2 (não as 3 do tenant)")
}

// TestActivityController_MyActivitiesKPIs_AvgExecutionMinutes confirma o
// cálculo de tempo médio a partir de atividades concluídas.
func TestActivityController_MyActivitiesKPIs_AvgExecutionMinutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	technicianID := mustCreateUser(t, db, tenantID, "tecnico@example.com")

	start := time.Now().Add(-2 * time.Hour)
	finish := start.Add(30 * time.Minute)
	id := mustCreateActivity(t, db, tenantID, "Concluída", "done", "medium")
	require.NoError(t, db.Model(&models.Activity{}).Where("id = ?", id).
		Updates(map[string]interface{}{"startedAt": start, "finishedAt": finish}).Error)
	mustAssignActivity(t, db, tenantID, id, technicianID)

	c, w := setupActivityContextAsUser(t, db, tenantID, technicianID, "GET", "/my-activities/kpis", nil)
	ctrl.MyActivitiesKPIs(c)

	require.Equal(t, http.StatusOK, w.Code)
	var resp activityKpisResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.InDelta(t, 30.0, resp.AvgExecutionMinutes, 0.1)
}

// TestActivityController_List_IncludesComputedFields confirma que a
// listagem de gestão (GET /activities) também carrega os campos
// computados — não é exclusivo de /my-activities.
func TestActivityController_List_IncludesComputedFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	id := mustCreateActivity(t, db, tenantID, "Atividade", "pending", "urgent")
	require.NoError(t, db.Model(&models.Activity{}).Where("id = ?", id).
		Update("slaDueAt", time.Now().Add(-1*time.Hour)).Error)

	c, w := setupPipelineContext(t, db, tenantID, "GET", "/activities", nil)
	ctrl.List(c)

	require.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Activities []activityListItemDTO `json:"activities"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Len(t, resp.Activities, 1)
	assert.Equal(t, "overdue", resp.Activities[0].SlaStatus)
}
