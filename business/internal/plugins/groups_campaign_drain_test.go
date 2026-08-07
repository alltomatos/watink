package plugins

import (
	"strconv"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func pendingSendFixture(t *testing.T, db *gorm.DB, w models.Whatsapp, c models.GroupCampaign, run models.GroupCampaignRun, jid string, scheduledAt time.Time) models.GroupCampaignSend {
	t.Helper()
	s := models.GroupCampaignSend{
		TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID,
		JID: jid, Status: models.GroupCampaignSendStatusPending, ScheduledAt: scheduledAt, EnvID: "env-" + jid,
	}
	require.NoError(t, db.Create(&s).Error)
	return s
}

func runFixture(t *testing.T, db *gorm.DB, c models.GroupCampaign) models.GroupCampaignRun {
	t.Helper()
	r := models.GroupCampaignRun{TenantID: c.TenantID, CampaignID: c.ID, OccurrenceKey: "manual-" + c.Name, Status: models.GroupCampaignRunStatusRunning, ScheduledFor: time.Now()}
	require.NoError(t, db.Create(&r).Error)
	return r
}

// ── claimSend ────────────────────────────────────────────────────────────

func TestClaimSend_SecondClaimGetsZeroRows(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runFixture(t, db, c)
	send := pendingSendFixture(t, db, w, c, run, "120363x@g.us", time.Now())

	first, err := claimSend(db, send.ID)
	require.NoError(t, err)
	assert.True(t, first, "primeiro claim deve ter sucesso")

	second, err := claimSend(db, send.ID)
	require.NoError(t, err)
	assert.False(t, second, "segundo claim do mesmo envio deve falhar (RowsAffected==0)")

	var reloaded models.GroupCampaignSend
	require.NoError(t, db.First(&reloaded, send.ID).Error)
	assert.Equal(t, 1, reloaded.Attempts, "attempts só deve incrementar uma vez")
}

// ── reapStuckClaims ──────────────────────────────────────────────────────

func TestReapStuckClaims_ResetsUnderMaxAttemptsFailsOver(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runFixture(t, db, c)

	stuck := models.GroupCampaignSend{
		TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID,
		JID: "a@g.us", Status: models.GroupCampaignSendStatusSending,
		ClaimedAt: timePtr(time.Now().Add(-10 * time.Minute)), Attempts: 1, EnvID: "env-a",
	}
	require.NoError(t, db.Create(&stuck).Error)

	exhausted := models.GroupCampaignSend{
		TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID,
		JID: "b@g.us", Status: models.GroupCampaignSendStatusSending,
		ClaimedAt: timePtr(time.Now().Add(-10 * time.Minute)), Attempts: groupCampaignClaimMaxAttempts, EnvID: "env-b",
	}
	require.NoError(t, db.Create(&exhausted).Error)

	reapStuckClaims(t.Context(), db)

	var reloadedStuck, reloadedExhausted models.GroupCampaignSend
	require.NoError(t, db.First(&reloadedStuck, stuck.ID).Error)
	require.NoError(t, db.First(&reloadedExhausted, exhausted.ID).Error)

	assert.Equal(t, models.GroupCampaignSendStatusPending, reloadedStuck.Status, "abaixo do teto de tentativas deve voltar pra pending")
	assert.Equal(t, models.GroupCampaignSendStatusFailed, reloadedExhausted.Status, "no teto de tentativas deve falhar permanentemente")
}

// ── pickDueSends / drain end-to-end ──────────────────────────────────────

func TestDrain_SkipsDisconnectedConnections(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "DISCONNECTED")
	run := runFixture(t, db, c)
	pendingSendFixture(t, db, w, c, run, "a@g.us", time.Now().Add(-time.Minute))

	due, err := pickDueSends(t.Context(), db)
	require.NoError(t, err)
	assert.Empty(t, due, "conexão desconectada não deve aparecer na seleção de envios vencidos")
}

func TestPickDueSends_OneAtMostPerConnection(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runFixture(t, db, c)
	pendingSendFixture(t, db, w, c, run, "a@g.us", time.Now().Add(-2*time.Minute))
	pendingSendFixture(t, db, w, c, run, "b@g.us", time.Now().Add(-time.Minute))

	due, err := pickDueSends(t.Context(), db)
	require.NoError(t, err)
	require.Len(t, due, 1, "no máximo um envio por conexão por tick")
	assert.Equal(t, "a@g.us", due[0].JID, "deve escolher o mais antigo (scheduledAt) primeiro")
}

func TestPickDueSends_IgnoresFutureScheduledAt(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runFixture(t, db, c)
	pendingSendFixture(t, db, w, c, run, "a@g.us", time.Now().Add(time.Hour))

	due, err := pickDueSends(t.Context(), db)
	require.NoError(t, err)
	assert.Empty(t, due)
}

// ── drainOneSend / settleSendFailure (sendOne é stub nesta issue) ────────

func TestDrainOneSend_StubSendOneRetriesThenFails(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runFixture(t, db, c)
	send := pendingSendFixture(t, db, w, c, run, "a@g.us", time.Now())

	// sendOne (stub) sempre falha nesta issue -- drainOneSend deve
	// reagendar com backoff (não falhar de primeira, já que attempts
	// começa em 0 após o claim incrementar pra 1).
	drainOneSend(db, send)

	var reloaded models.GroupCampaignSend
	require.NoError(t, db.First(&reloaded, send.ID).Error)
	assert.Equal(t, models.GroupCampaignSendStatusPending, reloaded.Status, "abaixo do teto de tentativas, deve reagendar")
	assert.Equal(t, 1, reloaded.Attempts)
	assert.NotEmpty(t, reloaded.LastError)
	assert.True(t, reloaded.ScheduledAt.After(time.Now()), "reagendamento deve empurrar scheduledAt pro futuro")
}

func TestDrainOneSend_ExhaustedAttemptsFailsPermanently(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runFixture(t, db, c)
	send := models.GroupCampaignSend{
		TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID,
		JID: "a@g.us", Status: models.GroupCampaignSendStatusPending, ScheduledAt: time.Now(),
		Attempts: groupCampaignClaimMaxAttempts - 1, EnvID: "env-a",
	}
	require.NoError(t, db.Create(&send).Error)

	drainOneSend(db, send)

	var reloaded models.GroupCampaignSend
	require.NoError(t, db.First(&reloaded, send.ID).Error)
	assert.Equal(t, models.GroupCampaignSendStatusFailed, reloaded.Status)

	var reloadedRun models.GroupCampaignRun
	require.NoError(t, db.First(&reloadedRun, run.ID).Error)
	assert.Equal(t, 1, reloadedRun.FailedCount)
}

// ── circuit breaker ──────────────────────────────────────────────────────

func TestEvaluateCircuitBreaker_PausesAfterAllFailedInWindow(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Update("status", models.GroupCampaignStatusRunning).Error)
	run := runFixture(t, db, c)

	for i := 0; i < groupCampaignBreakerWindow; i++ {
		jid := "g" + strconv.Itoa(i) + "@g.us"
		s := models.GroupCampaignSend{
			TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID,
			JID: jid, Status: models.GroupCampaignSendStatusFailed, ScheduledAt: time.Now(),
			EnvID: "env-" + jid, UpdatedAt: time.Now(),
		}
		require.NoError(t, db.Create(&s).Error)
	}

	evaluateCircuitBreaker(db, c.TenantID, w.ID)

	var reloaded models.GroupCampaign
	require.NoError(t, db.First(&reloaded, c.ID).Error)
	assert.Equal(t, models.GroupCampaignStatusPaused, reloaded.Status)
	assert.NotEmpty(t, reloaded.PauseReason)
}

func TestEvaluateCircuitBreaker_DoesNotPauseWithARecentSuccess(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Update("status", models.GroupCampaignStatusRunning).Error)
	run := runFixture(t, db, c)

	for i := 0; i < groupCampaignBreakerWindow-1; i++ {
		jid := "g" + strconv.Itoa(i) + "@g.us"
		s := models.GroupCampaignSend{
			TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID,
			JID: jid, Status: models.GroupCampaignSendStatusFailed, ScheduledAt: time.Now(), EnvID: "env-" + jid,
		}
		require.NoError(t, db.Create(&s).Error)
	}
	success := models.GroupCampaignSend{
		TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID,
		JID: "g-success@g.us", Status: models.GroupCampaignSendStatusSent, ScheduledAt: time.Now(), EnvID: "env-ok",
	}
	require.NoError(t, db.Create(&success).Error)

	evaluateCircuitBreaker(db, c.TenantID, w.ID)

	var reloaded models.GroupCampaign
	require.NoError(t, db.First(&reloaded, c.ID).Error)
	assert.Equal(t, models.GroupCampaignStatusRunning, reloaded.Status, "com um sucesso recente na janela, não deve pausar")
}

// ── closeFinishedRuns / closeFinishedCampaigns ──────────────────────────

func TestCloseFinishedRuns_MarksCompletedAndRecountsCounters(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runFixture(t, db, c)

	sent := models.GroupCampaignSend{TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID, JID: "a@g.us", Status: models.GroupCampaignSendStatusSent, ScheduledAt: time.Now(), EnvID: "e1"}
	failed := models.GroupCampaignSend{TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID, JID: "b@g.us", Status: models.GroupCampaignSendStatusFailed, ScheduledAt: time.Now(), EnvID: "e2"}
	require.NoError(t, db.Create(&sent).Error)
	require.NoError(t, db.Create(&failed).Error)

	closeFinishedRuns(db)

	var reloaded models.GroupCampaignRun
	require.NoError(t, db.First(&reloaded, run.ID).Error)
	assert.Equal(t, models.GroupCampaignRunStatusCompleted, reloaded.Status)
	assert.Equal(t, 1, reloaded.SentCount)
	assert.Equal(t, 1, reloaded.FailedCount)
	assert.NotNil(t, reloaded.FinishedAt)
}

func TestCloseFinishedRuns_LeavesRunOpenWithPendingSends(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runFixture(t, db, c)
	pendingSendFixture(t, db, w, c, run, "a@g.us", time.Now())

	closeFinishedRuns(db)

	var reloaded models.GroupCampaignRun
	require.NoError(t, db.First(&reloaded, run.ID).Error)
	assert.Equal(t, models.GroupCampaignRunStatusRunning, reloaded.Status, "run com send pendente não deve fechar")
}

func TestCloseFinishedCampaigns_ClosesOnlyWithoutOpenRunsOrNextOccurrence(t *testing.T) {
	db := setupPluginTestDB(t)
	_, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Updates(map[string]interface{}{"status": models.GroupCampaignStatusRunning, "nextOccurrenceAt": nil}).Error)
	run := runFixture(t, db, c)
	require.NoError(t, db.Model(&run).Update("status", models.GroupCampaignRunStatusCompleted).Error)

	_, cStillOpen := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&cStillOpen).Updates(map[string]interface{}{"status": models.GroupCampaignStatusRunning, "nextOccurrenceAt": nil}).Error)
	runFixture(t, db, cStillOpen) // fica "running"

	closeFinishedCampaigns(db)

	var reloadedC, reloadedOpen models.GroupCampaign
	require.NoError(t, db.First(&reloadedC, c.ID).Error)
	require.NoError(t, db.First(&reloadedOpen, cStillOpen.ID).Error)

	assert.Equal(t, models.GroupCampaignStatusCompleted, reloadedC.Status)
	assert.Equal(t, models.GroupCampaignStatusRunning, reloadedOpen.Status, "campanha com run ainda aberta não deve fechar")
}

// ── cron registration (core sem WatinkCoreScheduler não deve panicar) ───

func TestRegisterGroupCampaignCrons_NoSchedulerSupport_DoesNotPanic(t *testing.T) {
	db := setupPluginTestDB(t)
	mockCore := new(MockWatinkCore)
	mockCore.On("GetDB").Return(db)

	assert.NotPanics(t, func() {
		registerGroupCampaignCrons(mockCore, db)
	})
}
