package plugins

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// newHandlerTestContext mirrors controllers.newTestPluginContext (same
// project convention, local per-file helper — CLAUDE.md "sem variável
// global de mock") for the two fields auth.GetScoped needs: "tenantId" and
// "db". Neither AssistantController nor AiGatewayController reads "alcance"
// (GetScopedDB's default branch already scopes by tenantId alone for
// tables outside the Tickets/Contacts special cases).
func newHandlerTestContext(t *testing.T, method, path string, body interface{}, db *gorm.DB, tenantID uuid.UUID) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	var req *http.Request
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		req = httptest.NewRequest(method, path, bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	c.Request = req
	c.Set("tenantId", tenantID)
	c.Set("db", db)
	return c, w
}

func itoa(n int) string { return strconv.Itoa(n) }

// ---- AiGatewayController.Test ----

func TestAiGatewayController_Test_NotFound_Returns404(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	ac := NewAiGatewayController()

	c, w := newHandlerTestContext(t, http.MethodPost, "/ai-gateways/999/test", nil, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: "999"}}

	ac.Test(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAiGatewayController_Test_NoApiKey_Returns422(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	gw := models.AiGateway{TenantID: tenantID, Name: "Sem chave", Provider: "openai", Model: "gpt-4o"}
	require.NoError(t, db.Create(&gw).Error)
	ac := NewAiGatewayController()

	c, w := newHandlerTestContext(t, http.MethodPost, "/ai-gateways/x/test", nil, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: itoa(gw.ID)}}

	ac.Test(c)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

// ---- AssistantController.Test ----

func TestAssistantController_Test_NotFound_Returns404(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	ac := NewAssistantController()

	c, w := newHandlerTestContext(t, http.MethodPost, "/assistants/999/test", nil, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: "999"}}

	ac.Test(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAssistantController_Test_RouterMode_NoOptions_Returns422(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	a := models.Assistant{TenantID: tenantID, Name: "Router vazio", Mode: models.AssistantModeRouter, TriggerType: "any"}
	require.NoError(t, db.Create(&a).Error)
	ac := NewAssistantController()

	c, w := newHandlerTestContext(t, http.MethodPost, "/assistants/x/test", nil, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: itoa(a.ID)}}

	ac.Test(c)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

// TestAssistantController_Test_RouterMode_ReturnsRealMenu proves the router
// test path is a REAL artifact (the exact menu text the Assistant sends on
// first contact — buildRouterMenu, same function production uses), not a
// canned/fake string.
func TestAssistantController_Test_RouterMode_ReturnsRealMenu(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	target := models.Assistant{TenantID: tenantID, Name: "Alvo", Mode: models.AssistantModePersona, TriggerType: "any"}
	require.NoError(t, db.Create(&target).Error)
	router := models.Assistant{TenantID: tenantID, Name: "Roteador", Mode: models.AssistantModeRouter, TriggerType: "any"}
	require.NoError(t, db.Create(&router).Error)
	opt := models.AssistantRouterOption{TenantID: tenantID, RouterAssistantID: router.ID, Label: "Financeiro", Order: 0, TargetAssistantID: target.ID}
	require.NoError(t, db.Create(&opt).Error)
	ac := NewAssistantController()

	c, w := newHandlerTestContext(t, http.MethodPost, "/assistants/x/test", nil, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: itoa(router.ID)}}

	ac.Test(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, models.AssistantModeRouter, resp["mode"])
	assert.Contains(t, resp["reply"], "Financeiro")
	assert.Contains(t, resp["reply"], "1.")
}

func TestAssistantController_Test_FlowMode_ReportsNotTestable(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	cfg, _ := json.Marshal(models.AssistantFlowConfig{FlowID: 1})
	a := models.Assistant{TenantID: tenantID, Name: "Delega", Mode: models.AssistantModeFlow, TriggerType: "any", Config: datatypes.JSON(cfg)}
	require.NoError(t, db.Create(&a).Error)
	ac := NewAssistantController()

	c, w := newHandlerTestContext(t, http.MethodPost, "/assistants/x/test", nil, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: itoa(a.ID)}}

	ac.Test(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, false, resp["testable"])
}

func TestAssistantController_Test_PersonaMode_NoKnowledgeBase_Returns422(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	cfg, _ := json.Marshal(models.AssistantPersonaConfig{Persona: "Vendedor", AiGatewayID: 1, RagFallbackBehavior: models.RagFallbackHandoff})
	a := models.Assistant{TenantID: tenantID, Name: "Persona sem KB", Mode: models.AssistantModePersona, TriggerType: "any", Config: datatypes.JSON(cfg)}
	require.NoError(t, db.Create(&a).Error)
	ac := NewAssistantController()

	c, w := newHandlerTestContext(t, http.MethodPost, "/assistants/x/test", nil, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: itoa(a.ID)}}

	ac.Test(c)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

// TestAssistantController_Update_WhatsappBoundActive_DoesNotDuplicateTable
// is a regression test for a bug reproduced live in homolog: PUT
// /assistants/:id on an Assistant bound to a connection returned 500
// ("table name \"Assistants\" specified more than once", SQLSTATE 42712).
// Root cause: Update() reused the GetScoped-chained `db` (already carrying
// a Where/First from the "load existing" step) as the base of
// db.Transaction(...) without Session(NewDB:true) — the stale Statement
// leaked into the transaction. Toggling active on/off from the Assistants
// list (the new quick-toggle) is exactly the flow that hit this.
func TestAssistantController_Update_WhatsappBoundActive_DoesNotDuplicateTable(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	whatsappID := 1
	cfg, _ := json.Marshal(models.AssistantPersonaConfig{Persona: "Vendedor", AiGatewayID: 1, RagFallbackBehavior: models.RagFallbackHandoff})
	a := models.Assistant{
		TenantID: tenantID, Name: "Bound", Mode: models.AssistantModePersona, TriggerType: "any",
		TriggerOperator: "contains", WhatsAppID: &whatsappID, AllowMultipleOnConnection: false,
		Active: true, Config: datatypes.JSON(cfg),
	}
	require.NoError(t, db.Create(&a).Error)
	ac := NewAssistantController()

	body := map[string]interface{}{
		"name": "Bound", "whatsappId": whatsappID, "allowMultipleOnConnection": false,
		"mode": models.AssistantModePersona, "config": json.RawMessage(cfg),
		"triggerType": "any", "triggerOperator": "contains", "active": false,
	}
	c, w := newHandlerTestContext(t, http.MethodPut, "/assistants/x", body, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: itoa(a.ID)}}

	ac.Update(c)

	assert.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var updated models.Assistant
	require.NoError(t, db.Where("id = ?", a.ID).First(&updated).Error)
	assert.False(t, updated.Active)
}

func TestAssistantController_Test_PipelineMode_NotifyOnly_ReportsNotTestable(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	cfg, _ := json.Marshal(models.AssistantPipelineConfig{PipelineID: 1, RespondsAfterProactive: false})
	a := models.Assistant{TenantID: tenantID, Name: "Notifica só", Mode: models.AssistantModePipeline, TriggerType: "any", Config: datatypes.JSON(cfg)}
	require.NoError(t, db.Create(&a).Error)
	ac := NewAssistantController()

	c, w := newHandlerTestContext(t, http.MethodPost, "/assistants/x/test", nil, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: itoa(a.ID)}}

	ac.Test(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, false, resp["testable"])
}
