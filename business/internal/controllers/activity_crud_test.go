package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// TestActivityController_Create_Success cobre o happy-path: 201,
// status=pending, slaDueAt calculado a partir da prioridade + defaults
// (nenhuma config de SLA salva neste teste).
func TestActivityController_Create_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	before := time.Now()
	payload, _ := json.Marshal(map[string]interface{}{
		"title":       "Instalar roteador",
		"description": "Cliente sem sinal no 2º andar",
		"priority":    "urgent",
	})
	c, w := setupPipelineContext(t, db, tenantID, "POST", "/activities", payload)
	ctrl.Create(c)

	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	var created models.Activity
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))

	assert.Equal(t, "pending", created.Status)
	assert.Equal(t, "urgent", created.Priority)
	require.NotNil(t, created.SlaDueAt)
	// default urgent = 120min — tolerância de alguns segundos pela execução do teste.
	assert.WithinDuration(t, before.Add(2*time.Hour), *created.SlaDueAt, 10*time.Second)
}

// TestActivityController_Create_WithAssigneesAndItems confirma que
// assigneeIds e items do payload viram ActivityAssignee/ActivityChecklistItem
// na mesma transação de criação.
func TestActivityController_Create_WithAssigneesAndItems(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	require.NoError(t, db.Exec(`INSERT INTO "Users" (name, email, "passwordHash", "tenantId") VALUES (?,?,?,?)`,
		"Técnico A", "tecnico-a@example.com", "hash", tenantID).Error)
	var userID int
	require.NoError(t, db.Raw(`SELECT id FROM "Users" WHERE "tenantId" = ?`, tenantID).Scan(&userID).Error)

	payload, _ := json.Marshal(map[string]interface{}{
		"title":       "Manutenção preventiva",
		"priority":    "medium",
		"assigneeIds": []int{userID},
		"items": []map[string]interface{}{
			{"label": "Conferir voltagem", "inputType": "number", "isRequired": true, "position": 1},
			{"label": "Foto do painel", "inputType": "photo", "position": 2},
		},
	})
	c, w := setupPipelineContext(t, db, tenantID, "POST", "/activities", payload)
	ctrl.Create(c)

	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	var created models.Activity
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))

	require.Len(t, created.Assignees, 1)
	assert.Equal(t, userID, created.Assignees[0].UserID)
	require.Len(t, created.Items, 2)
}

// TestActivityController_Create_IgnoresCrossTenantAssignee confirma que um
// userId de outro tenant é silenciosamente descartado, nunca vira um
// vínculo cross-tenant.
func TestActivityController_Create_IgnoresCrossTenantAssignee(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	ctrl := NewActivityController(nil)

	require.NoError(t, db.Exec(`INSERT INTO "Users" (name, email, "passwordHash", "tenantId") VALUES (?,?,?,?)`,
		"Usuário de B", "userb@example.com", "hash", tenantB).Error)
	var userBID int
	require.NoError(t, db.Raw(`SELECT id FROM "Users" WHERE "tenantId" = ?`, tenantB).Scan(&userBID).Error)

	payload, _ := json.Marshal(map[string]interface{}{
		"title":       "Atividade do tenant A",
		"priority":    "low",
		"assigneeIds": []int{userBID},
	})
	c, w := setupPipelineContext(t, db, tenantA, "POST", "/activities", payload)
	ctrl.Create(c)

	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	var created models.Activity
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	assert.Empty(t, created.Assignees, "userId de outro tenant não pode virar assignee")
}

// TestActivityController_List_ReturnsWholeTenant_WithFilters confirma que
// List é tenant-wide (não filtra por assignee — isso é GET /my-activities,
// issue seguinte) e que os filtros funcionam.
func TestActivityController_List_ReturnsWholeTenant_WithFilters(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	ctrl := NewActivityController(nil)

	mustCreateActivity(t, db, tenantA, "Trocar cabo de rede", "pending", "high")
	mustCreateActivity(t, db, tenantA, "Instalar antena", "done", "low")
	mustCreateActivity(t, db, tenantB, "Atividade de outro tenant", "pending", "high")

	c, w := setupPipelineContext(t, db, tenantA, "GET", "/activities", nil)
	ctrl.List(c)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string][]models.Activity
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp["activities"], 2, "List deve trazer as duas atividades do tenant, não só as de um assignee")

	c2, w2 := setupPipelineContext(t, db, tenantA, "GET", "/activities?status=done", nil)
	ctrl.List(c2)
	require.Equal(t, http.StatusOK, w2.Code)
	var resp2 map[string][]models.Activity
	require.NoError(t, json.Unmarshal(w2.Body.Bytes(), &resp2))
	require.Len(t, resp2["activities"], 1)
	assert.Equal(t, "Instalar antena", resp2["activities"][0].Title)
}

// TestActivityController_Update_RecalculatesSlaOnlyWhenPending é o critério
// central do ADR 0029: mudar a prioridade recalcula slaDueAt enquanto
// status=pending, e NÃO recalcula a partir de in_progress.
func TestActivityController_Update_RecalculatesSlaOnlyWhenPending(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	// pending: recalcula
	pendingID := mustCreateActivity(t, db, tenantID, "Atividade pendente", "pending", "low")
	var before models.Activity
	require.NoError(t, db.Where("id = ?", pendingID).First(&before).Error)

	payload, _ := json.Marshal(map[string]interface{}{"title": "Atividade pendente", "priority": "urgent"})
	c, w := setupPipelineContextWithParam(t, db, tenantID, "PUT", "/activities/"+itoa(pendingID), payload, "id", itoa(pendingID))
	ctrl.Update(c)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var afterPending models.Activity
	require.NoError(t, db.Where("id = ?", pendingID).First(&afterPending).Error)
	require.NotNil(t, afterPending.SlaDueAt)
	require.NotNil(t, before.SlaDueAt)
	assert.NotEqual(t, before.SlaDueAt.Unix(), afterPending.SlaDueAt.Unix(), "slaDueAt deveria mudar quando status=pending")

	// in_progress: congelado
	inProgressID := mustCreateActivity(t, db, tenantID, "Atividade em execução", "in_progress", "low")
	var beforeIP models.Activity
	require.NoError(t, db.Where("id = ?", inProgressID).First(&beforeIP).Error)

	payload2, _ := json.Marshal(map[string]interface{}{"title": "Atividade em execução", "priority": "urgent"})
	c2, w2 := setupPipelineContextWithParam(t, db, tenantID, "PUT", "/activities/"+itoa(inProgressID), payload2, "id", itoa(inProgressID))
	ctrl.Update(c2)
	require.Equal(t, http.StatusOK, w2.Code, "body: %s", w2.Body.String())

	var afterIP models.Activity
	require.NoError(t, db.Where("id = ?", inProgressID).First(&afterIP).Error)
	require.NotNil(t, afterIP.SlaDueAt)
	assert.Equal(t, beforeIP.SlaDueAt.Unix(), afterIP.SlaDueAt.Unix(), "slaDueAt NÃO deveria mudar quando status=in_progress")
}

// TestActivityController_Update_TenantIsolation garante 404 (não vazamento)
// ao tentar editar Activity de outro tenant.
func TestActivityController_Update_TenantIsolation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	ctrl := NewActivityController(nil)

	id := mustCreateActivity(t, db, tenantA, "Atividade A", "pending", "medium")

	payload, _ := json.Marshal(map[string]interface{}{"title": "Sequestrada", "priority": "low"})
	c, w := setupPipelineContextWithParam(t, db, tenantB, "PUT", "/activities/"+itoa(id), payload, "id", itoa(id))
	ctrl.Update(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// TestActivityController_Delete_SoftDeletes confirma soft-delete (mesmo
// padrão de Client) — a linha continua no banco com deletedAt preenchido.
func TestActivityController_Delete_SoftDeletes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	id := mustCreateActivity(t, db, tenantID, "Para remover", "pending", "medium")

	c, w := setupPipelineContextWithParam(t, db, tenantID, "DELETE", "/activities/"+itoa(id), nil, "id", itoa(id))
	ctrl.Delete(c)
	require.Equal(t, http.StatusOK, w.Code)

	var count int64
	db.Unscoped().Model(&models.Activity{}).Where("id = ? AND deleted_at IS NOT NULL", id).Count(&count)
	assert.EqualValues(t, 1, count)

	var visibleCount int64
	db.Model(&models.Activity{}).Where("id = ?", id).Count(&visibleCount)
	assert.EqualValues(t, 0, visibleCount, "soft-deleted não deve aparecer em query normal")
}

// TestActivityController_UpdateAssignees_UpsertByDifference cobre
// adicionar+remover num único PUT: envia a lista final completa e confirma
// que só a diferença muda.
func TestActivityController_UpdateAssignees_UpsertByDifference(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	require.NoError(t, db.Exec(`INSERT INTO "Users" (name, email, "passwordHash", "tenantId") VALUES (?,?,?,?)`, "User 1", "u1@example.com", "hash", tenantID).Error)
	require.NoError(t, db.Exec(`INSERT INTO "Users" (name, email, "passwordHash", "tenantId") VALUES (?,?,?,?)`, "User 2", "u2@example.com", "hash", tenantID).Error)
	var u1, u2 int
	require.NoError(t, db.Raw(`SELECT id FROM "Users" WHERE email = 'u1@example.com'`).Scan(&u1).Error)
	require.NoError(t, db.Raw(`SELECT id FROM "Users" WHERE email = 'u2@example.com'`).Scan(&u2).Error)

	id := mustCreateActivity(t, db, tenantID, "Atividade em equipe", "pending", "medium")

	payload1, _ := json.Marshal(updateActivityAssigneesRequest{UserIDs: []int{u1}})
	c1, w1 := setupPipelineContextWithParam(t, db, tenantID, "PUT", "/activities/"+itoa(id)+"/assignees", payload1, "id", itoa(id))
	ctrl.UpdateAssignees(c1)
	require.Equal(t, http.StatusOK, w1.Code, "body: %s", w1.Body.String())

	// troca u1 por u2
	payload2, _ := json.Marshal(updateActivityAssigneesRequest{UserIDs: []int{u2}})
	c2, w2 := setupPipelineContextWithParam(t, db, tenantID, "PUT", "/activities/"+itoa(id)+"/assignees", payload2, "id", itoa(id))
	ctrl.UpdateAssignees(c2)
	require.Equal(t, http.StatusOK, w2.Code, "body: %s", w2.Body.String())

	var assignees []models.ActivityAssignee
	db.Where(`"activityId" = ?`, id).Find(&assignees)
	require.Len(t, assignees, 1)
	assert.Equal(t, u2, assignees[0].UserID)
}

// mustCreateActivity insere uma Activity mínima diretamente via GORM (sem
// passar pelo controller) para os testes que precisam de fixtures.
func mustCreateActivity(t *testing.T, db *gorm.DB, tenantID uuid.UUID, title, status, priority string) int {
	t.Helper()
	activity := models.Activity{
		TenantID:       tenantID,
		Title:          title,
		Status:         status,
		Priority:       priority,
		LastActivityAt: time.Now(),
		SlaDueAt:       CalculateSLADueAt(defaultActivitySLAConfig(), priority, time.Now()),
	}
	require.NoError(t, db.Create(&activity).Error)
	return activity.ID
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
