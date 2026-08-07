package plugins

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

// campaignHandlerRouter wires a bare gin engine with the tenant/db context
// middleware.IsAuth would normally set, mirroring the pattern already used
// by groups_test.go (TestGroupsPlugin_ListGroups_HappyPath) -- exercises
// the raw handlers, not the withPermission-wrapped routes (RBAC has its own
// suite).
func campaignHandlerRouter(db *gorm.DB, tenantID uuid.UUID) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	setCtx := func(c *gin.Context) {
		c.Set("tenantId", tenantID.String())
		c.Set("alcance", "tenant")
		c.Set("db", db)
	}
	r.GET("/group-campaigns", func(c *gin.Context) { setCtx(c); handleListGroupCampaigns()(c) })
	r.GET("/group-campaigns/:campaignId", func(c *gin.Context) { setCtx(c); handleGetGroupCampaign()(c) })
	r.POST("/group-campaigns", func(c *gin.Context) { setCtx(c); handleCreateGroupCampaign()(c) })
	r.PUT("/group-campaigns/:campaignId", func(c *gin.Context) { setCtx(c); handleUpdateGroupCampaign()(c) })
	r.DELETE("/group-campaigns/:campaignId", func(c *gin.Context) { setCtx(c); handleDeleteGroupCampaign()(c) })
	return r
}

func campaignConnFixture(t *testing.T, db *gorm.DB, tenantID uuid.UUID) models.Whatsapp {
	t.Helper()
	w := models.Whatsapp{TenantID: tenantID, Name: "conn-" + uuid.New().String()[:8], Number: "5511999990000", Status: "CONNECTED"}
	require.NoError(t, db.Create(&w).Error)
	return w
}

func doJSON(t *testing.T, r *gin.Engine, method, path string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		require.NoError(t, json.NewEncoder(&buf).Encode(body))
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func validCreateCampaignBody(whatsappID int) map[string]interface{} {
	now := time.Now()
	return map[string]interface{}{
		"name":       "Campanha de lançamento",
		"whatsappId": whatsappID,
		"riskAckAt":  now,
		"variants": []map[string]interface{}{
			{"type": "text", "message": "olá {{group_name}}", "active": true},
		},
		"targets": []map[string]interface{}{
			{"whatsappId": whatsappID, "jid": "120363000000000021@g.us", "subject": "Grupo 1"},
			{"whatsappId": whatsappID, "jid": "120363000000000022@g.us", "subject": "Grupo 2"},
		},
	}
}

// ── TestCreateGroupCampaign ─────────────────────────────────────────────

func TestCreateGroupCampaign(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignHandlerRouter(db, tenantID)

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns", validCreateCampaignBody(w.ID))
	require.Equal(t, http.StatusCreated, resp.Code, resp.Body.String())

	var out groupCampaignResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &out))
	assert.Equal(t, models.GroupCampaignStatusDraft, out.Status, "POST sempre cria em draft")
	assert.Len(t, out.Variants, 1)
	assert.Len(t, out.Targets, 2)
	assert.NotNil(t, out.RiskAckAt)
}

func TestCreateGroupCampaign_ImmediateScheduleStillCreatesDraft(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignHandlerRouter(db, tenantID)

	body := validCreateCampaignBody(w.ID)
	body["scheduleMode"] = "immediate"

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns", body)
	require.Equal(t, http.StatusCreated, resp.Code, resp.Body.String())

	var out groupCampaignResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &out))
	assert.Equal(t, models.GroupCampaignStatusDraft, out.Status, "/start é a única ignição, nunca o POST")
}

func TestCreateGroupCampaign_ClampsPacingAndEchoesAdjusted(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignHandlerRouter(db, tenantID)

	body := validCreateCampaignBody(w.ID)
	body["intervalSeconds"] = 5 // abaixo do piso (60s)

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns", body)
	require.Equal(t, http.StatusCreated, resp.Code, resp.Body.String())

	var out groupCampaignResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &out))
	assert.True(t, out.PacingAdjusted)
	assert.Equal(t, campaignMinIntervalSeconds, out.IntervalSeconds)
}

func TestCreateGroupCampaign_RejectsWithoutRiskAck(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignHandlerRouter(db, tenantID)

	body := validCreateCampaignBody(w.ID)
	delete(body, "riskAckAt")

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns", body)
	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestCreateGroupCampaign_TargetsRespectUniqueConstraint(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignHandlerRouter(db, tenantID)

	body := validCreateCampaignBody(w.ID)
	body["targets"] = []map[string]interface{}{
		{"whatsappId": w.ID, "jid": "120363000000000099@g.us", "subject": "Duplicado"},
		{"whatsappId": w.ID, "jid": "120363000000000099@g.us", "subject": "Duplicado"},
	}

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns", body)
	assert.Equal(t, http.StatusInternalServerError, resp.Code, "violação de UNIQUE(campaignId,jid) deve falhar, não silenciar duplicata")
}

// ── TestUpdateGroupCampaign ──────────────────────────────────────────────

func TestUpdateGroupCampaign(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignHandlerRouter(db, tenantID)

	created := doJSON(t, r, http.MethodPost, "/group-campaigns", validCreateCampaignBody(w.ID))
	require.Equal(t, http.StatusCreated, created.Code)
	var createdOut groupCampaignResponse
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &createdOut))

	updateBody := validCreateCampaignBody(w.ID)
	updateBody["name"] = "Campanha renomeada"
	updateBody["variants"] = []map[string]interface{}{
		{"type": "text", "message": "novo texto", "active": true},
		{"type": "media", "message": "com mídia", "active": true, "content": `{"url":"https://x/y.jpg","mediaType":"image"}`},
	}

	resp := doJSON(t, r, http.MethodPut, "/group-campaigns/"+itoaTest(createdOut.ID), updateBody)
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())

	var out groupCampaignResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &out))
	assert.Equal(t, "Campanha renomeada", out.Name)
	assert.Len(t, out.Variants, 2, "update deve substituir a lista de variants (delete-then-insert)")
}

func TestUpdateGroupCampaign_NotFoundForMissingID(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignHandlerRouter(db, tenantID)

	resp := doJSON(t, r, http.MethodPut, "/group-campaigns/999999", validCreateCampaignBody(w.ID))
	assert.Equal(t, http.StatusNotFound, resp.Code)
}

// ── TestGroupCampaign_TenantIsolation ────────────────────────────────────

func TestGroupCampaign_TenantIsolation(t *testing.T) {
	db := setupPluginTestDB(t)
	ownerTenant := uuid.New()
	otherTenant := uuid.New()
	w := campaignConnFixture(t, db, ownerTenant)

	ownerRouter := campaignHandlerRouter(db, ownerTenant)
	created := doJSON(t, ownerRouter, http.MethodPost, "/group-campaigns", validCreateCampaignBody(w.ID))
	require.Equal(t, http.StatusCreated, created.Code)
	var createdOut groupCampaignResponse
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &createdOut))

	otherRouter := campaignHandlerRouter(db, otherTenant)

	getResp := doJSON(t, otherRouter, http.MethodGet, "/group-campaigns/"+itoaTest(createdOut.ID), nil)
	assert.Equal(t, http.StatusNotFound, getResp.Code, "outro tenant nunca deve ver 403 (vazaria existência) -- sempre 404")

	putResp := doJSON(t, otherRouter, http.MethodPut, "/group-campaigns/"+itoaTest(createdOut.ID), validCreateCampaignBody(w.ID))
	assert.Equal(t, http.StatusNotFound, putResp.Code)

	deleteResp := doJSON(t, otherRouter, http.MethodDelete, "/group-campaigns/"+itoaTest(createdOut.ID), nil)
	assert.Equal(t, http.StatusNotFound, deleteResp.Code)

	listResp := doJSON(t, otherRouter, http.MethodGet, "/group-campaigns", nil)
	require.Equal(t, http.StatusOK, listResp.Code)
	var list []models.GroupCampaign
	require.NoError(t, json.Unmarshal(listResp.Body.Bytes(), &list))
	assert.Empty(t, list, "listagem de outro tenant não deve incluir a campanha")

	stillThere := doJSON(t, ownerRouter, http.MethodGet, "/group-campaigns/"+itoaTest(createdOut.ID), nil)
	assert.Equal(t, http.StatusOK, stillThere.Code, "delete do outro tenant não deve ter apagado a campanha do dono")
}

func TestDeleteGroupCampaign(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignHandlerRouter(db, tenantID)

	created := doJSON(t, r, http.MethodPost, "/group-campaigns", validCreateCampaignBody(w.ID))
	require.Equal(t, http.StatusCreated, created.Code)
	var createdOut groupCampaignResponse
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &createdOut))

	del := doJSON(t, r, http.MethodDelete, "/group-campaigns/"+itoaTest(createdOut.ID), nil)
	assert.Equal(t, http.StatusNoContent, del.Code)

	get := doJSON(t, r, http.MethodGet, "/group-campaigns/"+itoaTest(createdOut.ID), nil)
	assert.Equal(t, http.StatusNotFound, get.Code)
}
