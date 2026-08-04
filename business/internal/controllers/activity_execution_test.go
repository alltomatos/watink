package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupActivityContextAsUser é como setupPipelineContext (pipeline_test.go),
// mas injeta um userId específico no contexto — MyActivities/execução
// dependem de currentUserID(c), não só de tenantId/alcance.
func setupActivityContextAsUser(t *testing.T, db *gorm.DB, tenantID uuid.UUID, userID int, method, path string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
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
	c.Set("userId", float64(userID))
	scoped := db.Where(`"tenantId" = ?`, tenantID)
	c.Set("db", scoped)

	return c, w
}

func mustCreateUser(t *testing.T, db *gorm.DB, tenantID uuid.UUID, email string) int {
	t.Helper()
	require.NoError(t, db.Exec(`INSERT INTO "Users" (name, email, "passwordHash", "tenantId") VALUES (?,?,?,?)`,
		email, email, "hash", tenantID).Error)
	var id int
	require.NoError(t, db.Raw(`SELECT id FROM "Users" WHERE email = ?`, email).Scan(&id).Error)
	return id
}

func mustAssignActivity(t *testing.T, db *gorm.DB, tenantID uuid.UUID, activityID, userID int) {
	t.Helper()
	require.NoError(t, db.Create(&models.ActivityAssignee{ActivityID: activityID, UserID: userID, TenantID: tenantID}).Error)
}

// TestActivityController_MyActivities_FiltersByAssigneeEvenForTenantAlcance
// é o critério central de #530: GetScopedDB retorna cedo pra
// alcance=tenant/plataforma (antes do switch por tabela) — sem o filtro
// incondicional por assignee, um Administrador veria o tenant inteiro em
// /my-activities.
func TestActivityController_MyActivities_FiltersByAssigneeEvenForTenantAlcance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	adminID := mustCreateUser(t, db, tenantID, "admin@example.com")
	technicianID := mustCreateUser(t, db, tenantID, "tecnico@example.com")

	assignedID := mustCreateActivity(t, db, tenantID, "Atribuída ao técnico", "pending", "medium")
	_ = mustCreateActivity(t, db, tenantID, "Não atribuída", "pending", "medium")
	mustAssignActivity(t, db, tenantID, assignedID, technicianID)

	// Contexto marca alcance="tenant" (mesmo padrão de setupPipelineContext)
	// — logado como o ADMIN (não atribuído a nenhuma), a lista deve vir vazia.
	c, w := setupActivityContextAsUser(t, db, tenantID, adminID, "GET", "/my-activities", nil)
	ctrl.MyActivities(c)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string][]models.Activity
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Empty(t, resp["activities"], "Administrador sem atribuição não deve ver nenhuma atividade em /my-activities")

	// Logado como o técnico atribuído, vê só a sua.
	c2, w2 := setupActivityContextAsUser(t, db, tenantID, technicianID, "GET", "/my-activities", nil)
	ctrl.MyActivities(c2)

	require.Equal(t, http.StatusOK, w2.Code)
	var resp2 map[string][]models.Activity
	require.NoError(t, json.Unmarshal(w2.Body.Bytes(), &resp2))
	require.Len(t, resp2["activities"], 1)
	assert.Equal(t, "Atribuída ao técnico", resp2["activities"][0].Title)
}

// TestActivityController_Show_FlattensProtocolClient confirma o contrato que
// DetailsTab.tsx já consome: activity.protocol.client.name, resolvido por
// transitividade Protocol→Contact→Client — nunca desnormalizado em Activity.
func TestActivityController_Show_FlattensProtocolClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	require.NoError(t, db.Exec(`INSERT INTO "Clients" (name, type, "tenantId") VALUES (?,?,?)`, "Cliente Final", "pf", tenantID).Error)
	var clientID int
	require.NoError(t, db.Raw(`SELECT id FROM "Clients" WHERE "tenantId" = ?`, tenantID).Scan(&clientID).Error)

	require.NoError(t, db.Exec(`INSERT INTO "Contacts" (name, "tenantId", "clientId") VALUES (?,?,?)`, "Contato", tenantID, clientID).Error)
	var contactID int
	require.NoError(t, db.Raw(`SELECT id FROM "Contacts" WHERE "tenantId" = ?`, tenantID).Scan(&contactID).Error)

	require.NoError(t, db.Exec(
		`INSERT INTO "Protocols" ("protocolNumber", subject, status, priority, token, "contactId", "tenantId") VALUES (?,?,?,?,?,?,?)`,
		"20260101000000AAAA", "Instalação", "open", "medium", "tok123", contactID, tenantID,
	).Error)
	var protocolID int
	require.NoError(t, db.Raw(`SELECT id FROM "Protocols" WHERE "tenantId" = ?`, tenantID).Scan(&protocolID).Error)

	activity := models.Activity{
		TenantID: tenantID, Title: "Instalar modem", Status: "pending", Priority: "medium",
		ProtocolID: &protocolID, LastActivityAt: time.Now(),
	}
	require.NoError(t, db.Create(&activity).Error)

	c, w := setupPipelineContextWithParam(t, db, tenantID, "GET", "/activities/"+itoa(activity.ID), nil, "id", itoa(activity.ID))
	ctrl.Show(c)

	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	var resp struct {
		Protocol struct {
			Client struct {
				Name string `json:"name"`
			} `json:"client"`
		} `json:"protocol"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "Cliente Final", resp.Protocol.Client.Name)
}

// TestActivityController_Start_IsIdempotent confirma que startedAt só é
// marcado na primeira chamada.
func TestActivityController_Start_IsIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	id := mustCreateActivity(t, db, tenantID, "Atividade", "pending", "medium")

	c1, w1 := setupPipelineContextWithParam(t, db, tenantID, "PUT", "/activities/"+itoa(id)+"/start", nil, "id", itoa(id))
	ctrl.Start(c1)
	require.Equal(t, http.StatusOK, w1.Code)

	var afterFirst models.Activity
	require.NoError(t, db.Where("id = ?", id).First(&afterFirst).Error)
	require.Equal(t, "in_progress", afterFirst.Status)
	require.NotNil(t, afterFirst.StartedAt)
	firstStartedAt := *afterFirst.StartedAt

	c2, w2 := setupPipelineContextWithParam(t, db, tenantID, "PUT", "/activities/"+itoa(id)+"/start", nil, "id", itoa(id))
	ctrl.Start(c2)
	require.Equal(t, http.StatusOK, w2.Code)

	var afterSecond models.Activity
	require.NoError(t, db.Where("id = ?", id).First(&afterSecond).Error)
	assert.Equal(t, firstStartedAt.Unix(), afterSecond.StartedAt.Unix(), "segunda chamada não deveria re-marcar startedAt")
}

// TestActivityController_UpdateItem_TouchesLastActivityAt confirma que
// mutações de execução atualizam lastActivityAt — base do alerta de
// "atividade parada".
func TestActivityController_UpdateItem_TouchesLastActivityAt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	activityID := mustCreateActivity(t, db, tenantID, "Atividade", "in_progress", "medium")
	item := models.ActivityChecklistItem{ActivityID: activityID, TenantID: tenantID, Label: "Conferir voltagem", InputType: "text"}
	require.NoError(t, db.Create(&item).Error)

	var before models.Activity
	require.NoError(t, db.Where("id = ?", activityID).First(&before).Error)

	payload, _ := json.Marshal(map[string]interface{}{"isDone": true})
	c, w := setupPipelineContextWith2Params(t, db, tenantID, "PUT",
		"/activities/"+itoa(activityID)+"/items/"+itoa(item.ID), payload,
		"id", itoa(activityID), "itemId", itoa(item.ID))
	ctrl.UpdateItem(c)

	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var updatedItem models.ActivityChecklistItem
	require.NoError(t, db.Where("id = ?", item.ID).First(&updatedItem).Error)
	assert.True(t, updatedItem.IsDone)

	var after models.Activity
	require.NoError(t, db.Where("id = ?", activityID).First(&after).Error)
	assert.True(t, after.LastActivityAt.After(before.LastActivityAt) || after.LastActivityAt.Equal(before.LastActivityAt),
		"lastActivityAt não deveria retroceder")
	assert.NotEqual(t, before.LastActivityAt.UnixNano(), after.LastActivityAt.UnixNano(), "lastActivityAt deveria avançar após mutação")
}

// TestActivityController_DeleteMaterial_UsesMaterialIdNotId é a regressão
// direta do bug de contrato documentado: activities.md originalmente
// especificava :id duas vezes no path (materials/:id), tornando o id do
// material inalcançável via c.Param("id"). Aqui confirmamos que
// :materialId funciona e remove exatamente o material certo.
func TestActivityController_DeleteMaterial_UsesMaterialIdNotId(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	activityID := mustCreateActivity(t, db, tenantID, "Atividade", "in_progress", "medium")
	m1 := models.ActivityMaterial{ActivityID: activityID, TenantID: tenantID, MaterialName: "Cabo", Quantity: 1, Unit: "un"}
	m2 := models.ActivityMaterial{ActivityID: activityID, TenantID: tenantID, MaterialName: "Conector", Quantity: 2, Unit: "un"}
	require.NoError(t, db.Create(&m1).Error)
	require.NoError(t, db.Create(&m2).Error)

	c, w := setupPipelineContextWith2Params(t, db, tenantID, "DELETE",
		"/activities/"+itoa(activityID)+"/materials/"+itoa(m1.ID), nil,
		"id", itoa(activityID), "materialId", itoa(m1.ID))
	ctrl.DeleteMaterial(c)

	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var remaining []models.ActivityMaterial
	db.Where(`"activityId" = ?`, activityID).Find(&remaining)
	require.Len(t, remaining, 1)
	assert.Equal(t, "Conector", remaining[0].MaterialName)
}

// TestActivityController_AddOccurrence_DefaultsInvalidType garante que um
// type fora do enum documentado (info|impediment|delay) cai em "info", não
// vira erro nem persiste lixo.
func TestActivityController_AddOccurrence_DefaultsInvalidType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	activityID := mustCreateActivity(t, db, tenantID, "Atividade", "in_progress", "medium")

	payload, _ := json.Marshal(map[string]interface{}{"description": "Cliente ausente", "type": "invalid-type"})
	c, w := setupPipelineContextWithParam(t, db, tenantID, "POST", "/activities/"+itoa(activityID)+"/occurrences", payload, "id", itoa(activityID))
	ctrl.AddOccurrence(c)

	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	var created models.ActivityOccurrence
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	assert.Equal(t, "info", created.Type)
}

// TestActivityController_SubResources_TenantIsolation confirma 404 (nunca
// vazamento) ao tentar mutar item/material/ocorrência de Activity de outro
// tenant.
func TestActivityController_SubResources_TenantIsolation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	ctrl := NewActivityController(nil)

	activityID := mustCreateActivity(t, db, tenantA, "Atividade de A", "in_progress", "medium")
	item := models.ActivityChecklistItem{ActivityID: activityID, TenantID: tenantA, Label: "Item", InputType: "text"}
	require.NoError(t, db.Create(&item).Error)

	payload, _ := json.Marshal(map[string]interface{}{"isDone": true})
	c, w := setupPipelineContextWith2Params(t, db, tenantB, "PUT",
		"/activities/"+itoa(activityID)+"/items/"+itoa(item.ID), payload,
		"id", itoa(activityID), "itemId", itoa(item.ID))
	ctrl.UpdateItem(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
