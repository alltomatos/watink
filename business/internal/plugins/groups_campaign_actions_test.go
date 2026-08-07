package plugins

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// campaignActionRouter extends campaignHandlerRouter (groups_campaign_handler_test.go)
// with the action/report routes -- same tenant/db context injection, raw
// handlers (RBAC has its own suite).
func campaignActionRouter(db *gorm.DB, tenantID uuid.UUID, adapter *flow.WhatsAppAdapter) *gin.Engine {
	r := campaignHandlerRouter(db, tenantID)
	setCtx := func(c *gin.Context) {
		c.Set("tenantId", tenantID.String())
		c.Set("alcance", "tenant")
		c.Set("db", db)
	}
	r.POST("/group-campaigns/:campaignId/start", func(c *gin.Context) { setCtx(c); handleStartGroupCampaign()(c) })
	r.POST("/group-campaigns/:campaignId/test", func(c *gin.Context) { setCtx(c); handleTestGroupCampaign(nil, adapter)(c) })
	r.POST("/group-campaigns/:campaignId/pause", func(c *gin.Context) { setCtx(c); handlePauseGroupCampaign()(c) })
	r.POST("/group-campaigns/:campaignId/resume", func(c *gin.Context) { setCtx(c); handleResumeGroupCampaign()(c) })
	r.POST("/group-campaigns/:campaignId/cancel", func(c *gin.Context) { setCtx(c); handleCancelGroupCampaign()(c) })
	r.GET("/group-campaigns/:campaignId/runs", func(c *gin.Context) { setCtx(c); handleListGroupCampaignRuns()(c) })
	r.GET("/group-campaigns/:campaignId/runs/:runId/sends", func(c *gin.Context) { setCtx(c); handleListGroupCampaignSends()(c) })
	r.GET("/group-campaigns/:campaignId/replies", func(c *gin.Context) { setCtx(c); handleListGroupCampaignReplies()(c) })
	return r
}

func createTestCampaign(t *testing.T, r *gin.Engine, whatsappID int) groupCampaignResponse {
	t.Helper()
	resp := doJSON(t, r, http.MethodPost, "/group-campaigns", validCreateCampaignBody(whatsappID))
	require.Equal(t, http.StatusCreated, resp.Code, resp.Body.String())
	var out groupCampaignResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &out))
	return out
}

// ── TestStartGroupCampaign ───────────────────────────────────────────────

func TestStartGroupCampaign_ImmediateMaterializesInlineAsPending(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	campaign := createTestCampaign(t, r, w.ID)

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil)
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())

	var out groupCampaignResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &out))
	assert.Equal(t, models.GroupCampaignStatusRunning, out.Status)

	var run models.GroupCampaignRun
	require.NoError(t, db.Where(`"campaignId" = ?`, campaign.ID).First(&run).Error)
	assert.Equal(t, models.GroupCampaignRunStatusRunning, run.Status)

	var sends []models.GroupCampaignSend
	require.NoError(t, db.Where(`"runId" = ?`, run.ID).Find(&sends).Error)
	require.Len(t, sends, 2, "um send por target")
	for _, s := range sends {
		assert.Equal(t, models.GroupCampaignSendStatusPending, s.Status, "start não envia -- só materializa; quem envia é o drain")
		assert.False(t, s.ScheduledAt.IsZero())
	}
}

func TestStartGroupCampaign_RejectsWithoutRiskAck(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	campaign := createTestCampaign(t, r, w.ID)
	require.NoError(t, db.Model(&models.GroupCampaign{}).Where("id = ?", campaign.ID).Update(`"riskAckAt"`, nil).Error)

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil)
	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestStartGroupCampaign_RejectsWithoutTargets(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	body := validCreateCampaignBody(w.ID)
	body["targets"] = []map[string]interface{}{}
	created := doJSON(t, r, http.MethodPost, "/group-campaigns", body)
	require.Equal(t, http.StatusCreated, created.Code)
	var campaign groupCampaignResponse
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &campaign))

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil)
	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestStartGroupCampaign_RejectsWithoutActiveVariant(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	body := validCreateCampaignBody(w.ID)
	body["variants"] = []map[string]interface{}{
		{"type": "text", "message": "oi", "active": false},
	}
	created := doJSON(t, r, http.MethodPost, "/group-campaigns", body)
	require.Equal(t, http.StatusCreated, created.Code)
	var campaign groupCampaignResponse
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &campaign))

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil)
	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestStartGroupCampaign_RejectsDisconnectedConnection(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := models.Whatsapp{TenantID: tenantID, Name: "conn-off", Number: "5511999990000", Status: "DISCONNECTED"}
	require.NoError(t, db.Create(&w).Error)
	r := campaignActionRouter(db, tenantID, nil)
	campaign := createTestCampaign(t, r, w.ID)

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil)
	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestTestGroupCampaign_SendsWithoutCreatingTargetOrRun(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	pub := &sendFakePublisher{}
	adapter := flow.NewWhatsAppAdapter(pub, newSendFakeRedis())
	r := campaignActionRouter(db, tenantID, adapter)
	campaign := createTestCampaign(t, r, w.ID)

	var runsBefore, targetsBefore int64
	db.Model(&models.GroupCampaignRun{}).Where(`"campaignId" = ?`, campaign.ID).Count(&runsBefore)
	db.Model(&models.GroupCampaignTarget{}).Where(`"campaignId" = ?`, campaign.ID).Count(&targetsBefore)

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/test", map[string]interface{}{
		"jid": "120363000000000031@g.us", "subject": "Grupo teste",
	})
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())
	require.Len(t, pub.calls, 1)

	var runsAfter, targetsAfter int64
	db.Model(&models.GroupCampaignRun{}).Where(`"campaignId" = ?`, campaign.ID).Count(&runsAfter)
	db.Model(&models.GroupCampaignTarget{}).Where(`"campaignId" = ?`, campaign.ID).Count(&targetsAfter)
	assert.Equal(t, runsBefore, runsAfter, "/test não deve criar GroupCampaignRun")
	assert.Equal(t, targetsBefore, targetsAfter, "/test não deve criar GroupCampaignTarget")
}

// ── TestPauseGroupCampaign ───────────────────────────────────────────────

func TestPauseGroupCampaign_StopsDrainFromPickingUpItsSends(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	campaign := createTestCampaign(t, r, w.ID)

	startResp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil)
	require.Equal(t, http.StatusOK, startResp.Code)

	pauseResp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/pause", map[string]interface{}{"pauseReason": "teste manual"})
	require.Equal(t, http.StatusOK, pauseResp.Code, pauseResp.Body.String())
	var paused groupCampaignResponse
	require.NoError(t, json.Unmarshal(pauseResp.Body.Bytes(), &paused))
	assert.Equal(t, models.GroupCampaignStatusPaused, paused.Status)

	// Força os sends a estarem vencidos (buildSendSchedule normalmente
	// agenda alguns segundos/minutos à frente) e confirma que o drain (a
	// mesma query usada pelo cron) não pega nada de uma campanha pausada.
	db.Model(&models.GroupCampaignSend{}).Where(`"campaignId" = ?`, campaign.ID).Update("scheduledAt", time.Now().Add(-time.Hour))
	due, err := pickDueSends(t.Context(), db)
	require.NoError(t, err)
	assert.Empty(t, due, "drain não deve recolher envios de campanha pausada")
}

func TestPauseGroupCampaign_RejectsWhenNotRunning(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	campaign := createTestCampaign(t, r, w.ID) // ainda em draft

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/pause", nil)
	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestResumeGroupCampaign_BackToRunningWithOpenRun(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	campaign := createTestCampaign(t, r, w.ID)
	require.Equal(t, http.StatusOK, doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil).Code)
	require.Equal(t, http.StatusOK, doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/pause", nil).Code)

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/resume", nil)
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())
	var out groupCampaignResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &out))
	assert.Equal(t, models.GroupCampaignStatusRunning, out.Status, "run ainda aberta -- volta a running")
}

// ── TestCancelGroupCampaign ──────────────────────────────────────────────

func TestCancelGroupCampaign_CancelsPendingNeverSentOrFailed(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	campaign := createTestCampaign(t, r, w.ID)
	require.Equal(t, http.StatusOK, doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil).Code)

	var run models.GroupCampaignRun
	require.NoError(t, db.Where(`"campaignId" = ?`, campaign.ID).First(&run).Error)
	var sends []models.GroupCampaignSend
	require.NoError(t, db.Where(`"runId" = ?`, run.ID).Find(&sends).Error)
	require.Len(t, sends, 2)
	// Marca um dos dois como já enviado -- cancel nunca deve tocá-lo.
	require.NoError(t, db.Model(&models.GroupCampaignSend{}).Where("id = ?", sends[0].ID).
		Update("status", models.GroupCampaignSendStatusSent).Error)

	resp := doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/cancel", nil)
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())
	var out groupCampaignResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &out))
	assert.Equal(t, models.GroupCampaignStatusCanceled, out.Status)

	var reloadedSent, reloadedPending models.GroupCampaignSend
	require.NoError(t, db.First(&reloadedSent, sends[0].ID).Error)
	require.NoError(t, db.First(&reloadedPending, sends[1].ID).Error)
	assert.Equal(t, models.GroupCampaignSendStatusSent, reloadedSent.Status, "cancel nunca deve tocar um send já sent")
	assert.Equal(t, models.GroupCampaignSendStatusCanceled, reloadedPending.Status, "pendente deve virar canceled")

	var reloadedRun models.GroupCampaignRun
	require.NoError(t, db.First(&reloadedRun, run.ID).Error)
	assert.Equal(t, models.GroupCampaignRunStatusCanceled, reloadedRun.Status)
}

// ── TestGroupCampaignReport ──────────────────────────────────────────────

func TestGroupCampaignReport_RunsAndSendsArePaginated(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	campaign := createTestCampaign(t, r, w.ID)
	require.Equal(t, http.StatusOK, doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil).Code)

	runsResp := doJSON(t, r, http.MethodGet, "/group-campaigns/"+itoaTest(campaign.ID)+"/runs", nil)
	require.Equal(t, http.StatusOK, runsResp.Code)
	var runsOut struct {
		Runs  []models.GroupCampaignRun `json:"runs"`
		Count int64                     `json:"count"`
	}
	require.NoError(t, json.Unmarshal(runsResp.Body.Bytes(), &runsOut))
	require.Len(t, runsOut.Runs, 1)
	assert.EqualValues(t, 1, runsOut.Count)

	runID := runsOut.Runs[0].ID
	sendsResp := doJSON(t, r, http.MethodGet, "/group-campaigns/"+itoaTest(campaign.ID)+"/runs/"+itoaTest(runID)+"/sends", nil)
	require.Equal(t, http.StatusOK, sendsResp.Code)
	var sendsOut struct {
		Sends []models.GroupCampaignSend `json:"sends"`
		Count int64                      `json:"count"`
	}
	require.NoError(t, json.Unmarshal(sendsResp.Body.Bytes(), &sendsOut))
	assert.Len(t, sendsOut.Sends, 2)
	assert.EqualValues(t, 2, sendsOut.Count)
}

func TestGroupCampaignReport_RunsScopedToOwnCampaign(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	campaignA := createTestCampaign(t, r, w.ID)
	campaignB := createTestCampaign(t, r, w.ID)
	require.Equal(t, http.StatusOK, doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaignA.ID)+"/start", nil).Code)

	var runA models.GroupCampaignRun
	require.NoError(t, db.Where(`"campaignId" = ?`, campaignA.ID).First(&runA).Error)

	resp := doJSON(t, r, http.MethodGet, "/group-campaigns/"+itoaTest(campaignB.ID)+"/runs/"+itoaTest(runA.ID)+"/sends", nil)
	assert.Equal(t, http.StatusNotFound, resp.Code, "run de outra campanha nunca deve resolver")
}

func TestGroupCampaignReport_RepliesSeparatesQuotedAndWindowCounts(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := campaignConnFixture(t, db, tenantID)
	r := campaignActionRouter(db, tenantID, nil)
	campaign := createTestCampaign(t, r, w.ID)
	require.Equal(t, http.StatusOK, doJSON(t, r, http.MethodPost, "/group-campaigns/"+itoaTest(campaign.ID)+"/start", nil).Code)

	var run models.GroupCampaignRun
	require.NoError(t, db.Where(`"campaignId" = ?`, campaign.ID).First(&run).Error)
	var send models.GroupCampaignSend
	require.NoError(t, db.Where(`"runId" = ?`, run.ID).First(&send).Error)

	replies := []models.GroupCampaignReply{
		{TenantID: tenantID, CampaignID: campaign.ID, RunID: run.ID, SendID: send.ID, JID: send.JID, TicketID: 1, MessageID: "m1", MatchType: models.GroupCampaignReplyMatchQuoted, RepliedAt: time.Now()},
		{TenantID: tenantID, CampaignID: campaign.ID, RunID: run.ID, SendID: send.ID, JID: send.JID, TicketID: 1, MessageID: "m2", MatchType: models.GroupCampaignReplyMatchWindow, RepliedAt: time.Now()},
		{TenantID: tenantID, CampaignID: campaign.ID, RunID: run.ID, SendID: send.ID, JID: send.JID, TicketID: 1, MessageID: "m3", MatchType: models.GroupCampaignReplyMatchWindow, RepliedAt: time.Now()},
	}
	for _, rep := range replies {
		require.NoError(t, db.Create(&rep).Error)
	}

	resp := doJSON(t, r, http.MethodGet, "/group-campaigns/"+itoaTest(campaign.ID)+"/replies", nil)
	require.Equal(t, http.StatusOK, resp.Code)
	var out struct {
		Replies     []models.GroupCampaignReply `json:"replies"`
		QuotedCount int64                        `json:"quotedCount"`
		WindowCount int64                        `json:"windowCount"`
	}
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &out))
	assert.Len(t, out.Replies, 3)
	assert.EqualValues(t, 1, out.QuotedCount)
	assert.EqualValues(t, 2, out.WindowCount)
}
