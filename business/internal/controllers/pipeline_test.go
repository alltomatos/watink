package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPipelineTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	return testutil.NewTestDB(t)
}

func setupPipelineContext(t *testing.T, db *gorm.DB, tenantID uuid.UUID, method, path string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
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

func setupPipelineContextWithParam(t *testing.T, db *gorm.DB, tenantID uuid.UUID, method, path string, body []byte, paramKey, paramVal string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	c, w := setupPipelineContext(t, db, tenantID, method, path, body)
	c.Params = gin.Params{{Key: paramKey, Value: paramVal}}
	return c, w
}

func TestPipelineController_List_ReturnsOnlyOwnTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()

	db.Exec(`INSERT INTO "Pipelines" (name, "tenantId") VALUES (?,?)`, "CRM", tenantA)
	db.Exec(`INSERT INTO "Pipelines" (name, "tenantId") VALUES (?,?)`, "Outros", tenantB)

	ctrl := NewPipelineController()
	c, w := setupPipelineContext(t, db, tenantA, "GET", "/pipelines", nil)

	ctrl.List(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var pipelines []map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &pipelines))
	assert.Len(t, pipelines, 1)
	assert.Equal(t, "CRM", pipelines[0]["name"])
}

func TestPipelineController_List_IncludesDealMetrics(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	createPayload, _ := json.Marshal(map[string]interface{}{
		"name":   "Com Métricas",
		"stages": []map[string]string{{"name": "A"}, {"name": "B"}},
	})
	c, w := setupPipelineContext(t, db, tenantID, "POST", "/pipelines", createPayload)
	NewPipelineController().Create(c)
	require.Equal(t, http.StatusOK, w.Code)

	var created map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	var stageAID, stageBID int
	for _, s := range created["stages"].([]interface{}) {
		sm := s.(map[string]interface{})
		switch sm["name"].(string) {
		case "A":
			stageAID = int(sm["id"].(float64))
		case "B":
			stageBID = int(sm["id"].(float64))
		}
	}

	require.NoError(t, db.Exec(
		`INSERT INTO "Deals" (name, "stageId", "contactId", "tenantId", status, value) VALUES (?,?,?,?,?,?)`,
		"D1", stageAID, 1, tenantID, "open", 100.50,
	).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO "Deals" (name, "stageId", "contactId", "tenantId", status, value) VALUES (?,?,?,?,?,?)`,
		"D2", stageBID, 1, tenantID, "open", 200.00,
	).Error)

	ctrl := NewPipelineController()
	c2, w2 := setupPipelineContext(t, db, tenantID, "GET", "/pipelines", nil)
	ctrl.List(c2)

	assert.Equal(t, http.StatusOK, w2.Code)
	var pipelines []map[string]interface{}
	require.NoError(t, json.Unmarshal(w2.Body.Bytes(), &pipelines))
	require.Len(t, pipelines, 1)
	assert.Equal(t, float64(2), pipelines[0]["dealsCount"])
	assert.InDelta(t, 300.50, pipelines[0]["dealsValue"], 0.001)
}

func TestPipelineController_List_NoDeals_ZeroMetrics(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	db.Exec(`INSERT INTO "Pipelines" (name, "tenantId") VALUES (?,?)`, "Sem Deals", tenantID)

	ctrl := NewPipelineController()
	c, w := setupPipelineContext(t, db, tenantID, "GET", "/pipelines", nil)
	ctrl.List(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var pipelines []map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &pipelines))
	require.Len(t, pipelines, 1)
	// omitempty + zero value: field is absent from JSON, which is equivalent to zero.
	if v, ok := pipelines[0]["dealsCount"]; ok {
		assert.Equal(t, float64(0), v)
	}
}

func TestPipelineController_Create_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	payload, _ := json.Marshal(map[string]interface{}{
		"name":   "Vendas",
		"stages": []map[string]string{{"name": "Prospecção"}, {"name": "Proposta"}, {"name": "Fechamento"}},
	})
	ctrl := NewPipelineController()
	c, w := setupPipelineContext(t, db, tenantID, "POST", "/pipelines", payload)

	ctrl.Create(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "Vendas", resp["name"])
	stages, ok := resp["stages"].([]interface{})
	require.True(t, ok)
	assert.Len(t, stages, 3)
}

// TestPipelineController_Update_SQLiteAmbiguousColumn verifies that Update no
// longer stacks two tenantId WHERE clauses (auth.GetScopedDB + tx.Where).
// Previously caused "ambiguous column name: tenantId" on SQLite.
// Fixed in pipeline.go: tx.Session(&gorm.Session{NewDB:true}).Save(&pipeline).
func TestPipelineController_Update_SQLiteAmbiguousColumn(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	// seed a pipeline
	db.Exec(`INSERT INTO "Pipelines" (name, "tenantId") VALUES (?, ?)`, "Before", tenantID.String())
	var id int
	_ = db.Raw(`SELECT id FROM "Pipelines" WHERE "tenantId" = ?`, tenantID.String()).Row().Scan(&id)

	payload, _ := json.Marshal(map[string]interface{}{"name": "After"})
	ctrl := NewPipelineController()
	c, w := setupPipelineContext(t, db, tenantID, "PUT", "/pipelines/"+strconv.Itoa(id), payload)
	c.Params = gin.Params{{Key: "pipelineId", Value: strconv.Itoa(id)}}
	ctrl.Update(c)

	assert.Equal(t, http.StatusOK, w.Code, "Update should not fail with ambiguous column after fix: %s", w.Body.String())
}

func TestPipelineController_Update_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	payload, _ := json.Marshal(map[string]string{"name": "X"})
	ctrl := NewPipelineController()
	c, w := setupPipelineContext(t, db, tenantID, "PUT", "/pipelines/9999", payload)
	c.Params = gin.Params{{Key: "pipelineId", Value: "9999"}}

	ctrl.Update(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPipelineController_Delete_RemovesPipelineStagesAndDeals(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	createPayload, _ := json.Marshal(map[string]interface{}{
		"name":   "Para Excluir",
		"stages": []map[string]string{{"name": "A"}, {"name": "B"}},
	})
	c, w := setupPipelineContext(t, db, tenantID, "POST", "/pipelines", createPayload)
	NewPipelineController().Create(c)
	require.Equal(t, http.StatusOK, w.Code)

	var created map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	pipelineID := int(created["id"].(float64))
	var stageAID int
	for _, s := range created["stages"].([]interface{}) {
		sm := s.(map[string]interface{})
		if sm["name"].(string) == "A" {
			stageAID = int(sm["id"].(float64))
		}
	}
	require.NotZero(t, stageAID)

	require.NoError(t, db.Exec(
		`INSERT INTO "Deals" (name, "stageId", "contactId", "tenantId", status) VALUES (?,?,?,?,?)`,
		"Negócio A", stageAID, 1, tenantID, "open",
	).Error)

	c2, w2 := setupPipelineContextWithParam(t, db, tenantID, "DELETE", fmt.Sprintf("/pipelines/%d", pipelineID), nil, "pipelineId", strconv.Itoa(pipelineID))
	NewPipelineController().Delete(c2)
	assert.Equal(t, http.StatusOK, w2.Code, "delete body: %s", w2.Body.String())

	var pipelineCount int64
	require.NoError(t, db.Raw(`SELECT COUNT(*) FROM "Pipelines" WHERE id = ?`, pipelineID).Scan(&pipelineCount).Error)
	assert.Equal(t, int64(0), pipelineCount, "pipeline must be deleted")

	var stageCount int64
	require.NoError(t, db.Raw(`SELECT COUNT(*) FROM "PipelineStages" WHERE "pipelineId" = ?`, pipelineID).Scan(&stageCount).Error)
	assert.Equal(t, int64(0), stageCount, "stages must be deleted with the pipeline")

	var dealCount int64
	require.NoError(t, db.Raw(`SELECT COUNT(*) FROM "Deals" WHERE "stageId" = ?`, stageAID).Scan(&dealCount).Error)
	assert.Equal(t, int64(0), dealCount, "deals on the deleted pipeline's stages must not be left orphaned")
}

func TestPipelineController_Delete_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	ctrl := NewPipelineController()
	c, w := setupPipelineContextWithParam(t, db, tenantID, "DELETE", "/pipelines/9999", nil, "pipelineId", "9999")

	ctrl.Delete(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPipelineController_Delete_CrossTenant_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()

	db.Exec(`INSERT INTO "Pipelines" (name, "tenantId") VALUES (?,?)`, "De Outro Tenant", tenantB)
	var id int
	db.Raw(`SELECT id FROM "Pipelines" WHERE name = ?`, "De Outro Tenant").Scan(&id)

	ctrl := NewPipelineController()
	c, w := setupPipelineContextWithParam(t, db, tenantA, "DELETE", fmt.Sprintf("/pipelines/%d", id), nil, "pipelineId", strconv.Itoa(id))

	ctrl.Delete(c)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var count int64
	require.NoError(t, db.Raw(`SELECT COUNT(*) FROM "Pipelines" WHERE id = ?`, id).Scan(&count).Error)
	assert.Equal(t, int64(1), count, "pipeline from another tenant must survive")
}

func TestPipelineController_Export_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	db.Exec(`INSERT INTO "Pipelines" (name, "tenantId") VALUES (?,?)`, "ParaExportar", tenantID)
	var id int
	db.Raw(`SELECT id FROM "Pipelines" WHERE name = ?`, "ParaExportar").Scan(&id)

	ctrl := NewPipelineController()
	c, w := setupPipelineContext(t, db, tenantID, "GET", fmt.Sprintf("/pipelines/export/%d", id), nil)
	c.Params = gin.Params{{Key: "pipelineId", Value: fmt.Sprintf("%d", id)}}

	ctrl.Export(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "ParaExportar", resp["name"])
}

func TestPipelineController_Export_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	ctrl := NewPipelineController()
	c, w := setupPipelineContext(t, db, tenantID, "GET", "/pipelines/export/9999", nil)
	c.Params = gin.Params{{Key: "pipelineId", Value: "9999"}}

	ctrl.Export(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPipelineController_Import_DelegatesToCreate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	payload, _ := json.Marshal(map[string]interface{}{
		"name":   "Importado",
		"stages": []map[string]string{{"name": "S1"}},
	})
	ctrl := NewPipelineController()
	c, w := setupPipelineContext(t, db, tenantID, "POST", "/pipelines/import", payload)

	ctrl.Import(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "Importado", resp["name"])
}

func TestPipelineController_AISuggest_AIDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	// No settings seeded → aiEnabled defaults to ""  → ERR_AI_DISABLED
	payload, _ := json.Marshal(map[string]interface{}{
		"messages": []map[string]string{
			{"role": "user", "content": "quero montar um funil de vendas"},
		},
	})

	c, w := setupPipelineContext(t, db, tenantID, "POST", "/pipelines/ai-suggest", payload)
	ctrl := NewPipelineController()
	ctrl.AISuggest(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "ERR_AI_DISABLED", resp["error"])
}

func TestPipelineController_AISuggest_NoAPIKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	// Seed aiEnabled + aiPipelineEnabled but no apiKey
	require.NoError(t, db.Exec(`INSERT INTO "Settings" (key, value, "tenantId") VALUES (?,?,?)`, "aiEnabled", "true", tenantID).Error)
	require.NoError(t, db.Exec(`INSERT INTO "Settings" (key, value, "tenantId") VALUES (?,?,?)`, "aiPipelineEnabled", "true", tenantID).Error)

	payload, _ := json.Marshal(map[string]interface{}{
		"messages": []map[string]string{
			{"role": "user", "content": "funil de vendas"},
		},
	})

	c, w := setupPipelineContext(t, db, tenantID, "POST", "/pipelines/ai-suggest", payload)
	ctrl := NewPipelineController()
	ctrl.AISuggest(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "ERR_NO_AI_API_KEY", resp["error"])
}

func TestPipelineController_Update_StageUpsert(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	// Create pipeline with 2 stages
	createPayload, _ := json.Marshal(map[string]interface{}{
		"name": "Funil Teste",
		"type": "kanban",
		"stages": []map[string]string{
			{"name": "Novo"}, {"name": "Em Andamento"}, {"name": "Fechado"},
		},
	})
	c, w := setupPipelineContext(t, db, tenantID, "POST", "/pipelines", createPayload)
	NewPipelineController().Create(c)
	require.Equal(t, http.StatusOK, w.Code)

	var created map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	pipelineID := int(created["id"].(float64))

	stages := created["stages"].([]interface{})
	var stageNovoID float64
	for _, s := range stages {
		sm := s.(map[string]interface{})
		if sm["name"].(string) == "Novo" {
			stageNovoID = sm["id"].(float64)
		}
	}
	require.NotZero(t, stageNovoID, "stage 'Novo' must have an ID")

	// Update: keep "Novo" (should preserve ID), rename nothing, remove "Fechado", add "Concluído"
	updatePayload, _ := json.Marshal(map[string]interface{}{
		"name": "Funil Teste",
		"stages": []map[string]string{
			{"name": "Novo"}, {"name": "Em Andamento"}, {"name": "Concluído"},
		},
	})
	c2, w2 := setupPipelineContextWithParam(t, db, tenantID, "PUT", fmt.Sprintf("/pipelines/%d", pipelineID), updatePayload, "pipelineId", strconv.Itoa(pipelineID))
	NewPipelineController().Update(c2)
	require.Equal(t, http.StatusOK, w2.Code)

	var updated map[string]interface{}
	require.NoError(t, json.Unmarshal(w2.Body.Bytes(), &updated))

	updatedStages := updated["stages"].([]interface{})
	var updatedNovoID float64
	for _, s := range updatedStages {
		sm := s.(map[string]interface{})
		if sm["name"].(string) == "Novo" {
			updatedNovoID = sm["id"].(float64)
		}
	}
	assert.Equal(t, stageNovoID, updatedNovoID, "stage 'Novo' must preserve its ID after update")
}

func TestPipelineController_Update_ZeroStagesBlocked(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	createPayload, _ := json.Marshal(map[string]interface{}{
		"name":   "Pipeline Zero",
		"stages": []map[string]string{{"name": "Único"}},
	})
	c, w := setupPipelineContext(t, db, tenantID, "POST", "/pipelines", createPayload)
	NewPipelineController().Create(c)
	require.Equal(t, http.StatusOK, w.Code)
	var created map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	pipelineID := int(created["id"].(float64))

	updatePayload, _ := json.Marshal(map[string]interface{}{
		"stages": []map[string]string{{"name": "   "}},
	})
	c2, w2 := setupPipelineContextWithParam(t, db, tenantID, "PUT", fmt.Sprintf("/pipelines/%d", pipelineID), updatePayload, "pipelineId", strconv.Itoa(pipelineID))
	NewPipelineController().Update(c2)
	assert.Equal(t, http.StatusUnprocessableEntity, w2.Code)
}

// TestPipelineController_Update_AllStagesReplaced_MigratesDeals locks in the
// ADR 0009 invariant: when EVERY stage is renamed/replaced (the common
// PipelineCreator redesign case, where no incoming name matches an existing
// one), deals on the removed stages must be migrated to stages[0] — never
// orphaned by deleting their stage. Previously the all-new branch was a no-op
// (`_ = firstIncoming`) and silently dropped the deals off the board.
func TestPipelineController_Update_AllStagesReplaced_MigratesDeals(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	createPayload, _ := json.Marshal(map[string]interface{}{
		"name":   "Funil Original",
		"stages": []map[string]string{{"name": "A"}, {"name": "B"}},
	})
	c, w := setupPipelineContext(t, db, tenantID, "POST", "/pipelines", createPayload)
	NewPipelineController().Create(c)
	require.Equal(t, http.StatusOK, w.Code)

	var created map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	pipelineID := int(created["id"].(float64))

	var stageAID int
	for _, s := range created["stages"].([]interface{}) {
		sm := s.(map[string]interface{})
		if sm["name"].(string) == "A" {
			stageAID = int(sm["id"].(float64))
		}
	}
	require.NotZero(t, stageAID, "stage 'A' must have an ID")

	// Seed a deal sitting on stage A
	require.NoError(t, db.Exec(
		`INSERT INTO "Deals" (name, "stageId", "contactId", "tenantId", status) VALUES (?,?,?,?,?)`,
		"Negócio 1", stageAID, 1, tenantID, "open",
	).Error)

	// Replace ALL stages with brand-new names (no surviving name)
	updatePayload, _ := json.Marshal(map[string]interface{}{
		"name":   "Funil Original",
		"stages": []map[string]string{{"name": "X"}, {"name": "Y"}, {"name": "Z"}},
	})
	c2, w2 := setupPipelineContextWithParam(t, db, tenantID, "PUT", fmt.Sprintf("/pipelines/%d", pipelineID), updatePayload, "pipelineId", strconv.Itoa(pipelineID))
	NewPipelineController().Update(c2)
	require.Equal(t, http.StatusOK, w2.Code, "update body: %s", w2.Body.String())

	var updated map[string]interface{}
	require.NoError(t, json.Unmarshal(w2.Body.Bytes(), &updated))

	var stageXID int
	for _, s := range updated["stages"].([]interface{}) {
		sm := s.(map[string]interface{})
		if sm["name"].(string) == "X" {
			stageXID = int(sm["id"].(float64))
		}
	}
	require.NotZero(t, stageXID, "new stage 'X' (stages[0]) must exist")

	// The deal must survive and now point to stages[0] (X), not a deleted stage.
	var count int64
	require.NoError(t, db.Raw(`SELECT COUNT(*) FROM "Deals" WHERE "tenantId" = ?`, tenantID).Scan(&count).Error)
	assert.Equal(t, int64(1), count, "deal must NOT be deleted when its stage is replaced")

	var dealStageID int
	require.NoError(t, db.Raw(`SELECT "stageId" FROM "Deals" WHERE "tenantId" = ?`, tenantID).Scan(&dealStageID).Error)
	assert.Equal(t, stageXID, dealStageID, "deal must be migrated to stages[0] (X), not orphaned on a deleted stage")
}
