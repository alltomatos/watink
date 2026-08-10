package plugins

import (
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func campaignFixture(t *testing.T, db *gorm.DB, connectedStatus string) (models.Whatsapp, models.GroupCampaign) {
	t.Helper()
	tenantID := uuid.New()
	w := models.Whatsapp{TenantID: tenantID, Name: "conn-" + uuid.New().String()[:8], Number: "5511999990000", Status: connectedStatus}
	require.NoError(t, db.Create(&w).Error)

	c := models.GroupCampaign{
		TenantID:          tenantID,
		Name:              "Campanha de teste",
		WhatsappID:        w.ID,
		Status:            models.GroupCampaignStatusScheduled,
		ScheduleMode:      models.GroupCampaignScheduleOnce,
		IntervalSeconds:   60,
		BatchSize:         10,
		BatchPauseSeconds: 300,
	}
	require.NoError(t, db.Create(&c).Error)
	return w, c
}

func addVariant(t *testing.T, db *gorm.DB, c models.GroupCampaign, active bool) models.GroupCampaignVariant {
	t.Helper()
	v := models.GroupCampaignVariant{TenantID: c.TenantID, CampaignID: c.ID, Type: "text", Message: "olá", Active: active}
	require.NoError(t, db.Create(&v).Error)
	return v
}

func addTarget(t *testing.T, db *gorm.DB, c models.GroupCampaign, jid string) models.GroupCampaignTarget {
	t.Helper()
	tgt := models.GroupCampaignTarget{TenantID: c.TenantID, CampaignID: c.ID, WhatsappID: c.WhatsappID, JID: jid, Subject: "Grupo"}
	require.NoError(t, db.Create(&tgt).Error)
	return tgt
}

func TestMaterializeRun_CreatesOneSendPerTarget(t *testing.T) {
	db := setupPluginTestDB(t)
	_, c := campaignFixture(t, db, "CONNECTED")
	addVariant(t, db, c, true)
	addTarget(t, db, c, "120363000000000001@g.us")
	addTarget(t, db, c, "120363000000000002@g.us")
	addTarget(t, db, c, "120363000000000003@g.us")

	run, err := materializeRun(db, c, time.Now(), "2026-01-01T09:00:00Z", 0)
	require.NoError(t, err)
	require.NotNil(t, run)
	assert.Equal(t, models.GroupCampaignRunStatusRunning, run.Status)
	assert.Equal(t, 3, run.TotalSends)

	var sends []models.GroupCampaignSend
	require.NoError(t, db.Where(`"runId" = ?`, run.ID).Find(&sends).Error)
	assert.Len(t, sends, 3)
	for _, s := range sends {
		assert.Equal(t, models.GroupCampaignSendStatusPending, s.Status)
		assert.NotEmpty(t, s.EnvID)
	}
}

func TestMaterializeRun_NoTargetsOrVariants_ClosesRunImmediately(t *testing.T) {
	db := setupPluginTestDB(t)
	_, c := campaignFixture(t, db, "CONNECTED")
	// sem variante ativa nem alvo

	run, err := materializeRun(db, c, time.Now(), "2026-01-02T09:00:00Z", 0)
	require.NoError(t, err)
	require.NotNil(t, run)
	assert.Equal(t, models.GroupCampaignRunStatusCompleted, run.Status)
	assert.Equal(t, 0, run.TotalSends)
}

func TestMaterializeRun_IsIdempotentPerOccurrenceKey(t *testing.T) {
	db := setupPluginTestDB(t)
	_, c := campaignFixture(t, db, "CONNECTED")
	addVariant(t, db, c, true)
	addTarget(t, db, c, "120363000000000001@g.us")

	occurrenceKey := "2026-01-01T09:00:00Z"
	_, err1 := materializeRun(db, c, time.Now(), occurrenceKey, 0)
	require.NoError(t, err1)

	_, err2 := materializeRun(db, c, time.Now(), occurrenceKey, 0)
	require.Error(t, err2)
	assert.True(t, isUniqueViolation(err2), "segunda materialização da mesma occurrenceKey deve violar o índice único")

	var runCount int64
	db.Model(&models.GroupCampaignRun{}).Where(`"campaignId" = ? AND "occurrenceKey" = ?`, c.ID, occurrenceKey).Count(&runCount)
	assert.EqualValues(t, 1, runCount, "só deve existir uma run para a occurrenceKey")
}

func TestMaterializeOneCampaign_SkipsWhenPreviousOccurrenceStillRunning(t *testing.T) {
	db := setupPluginTestDB(t)
	_, c := campaignFixture(t, db, "CONNECTED")
	addVariant(t, db, c, true)
	addTarget(t, db, c, "120363000000000001@g.us")

	// Run anterior ainda "running" (nenhum send resolvido).
	priorRun := models.GroupCampaignRun{
		TenantID: c.TenantID, CampaignID: c.ID, OccurrenceKey: "manual-prior",
		Status: models.GroupCampaignRunStatusRunning, ScheduledFor: time.Now().Add(-time.Hour),
	}
	require.NoError(t, db.Create(&priorRun).Error)

	next := time.Now().Add(time.Hour)
	c.NextOccurrenceAt = &next
	materializeOneCampaign(db, c)

	var runs []models.GroupCampaignRun
	require.NoError(t, db.Where(`"campaignId" = ?`, c.ID).Find(&runs).Error)
	require.Len(t, runs, 2, "deve ter a run anterior + a nova run pulada")

	var skipped models.GroupCampaignRun
	for _, r := range runs {
		if r.ID != priorRun.ID {
			skipped = r
		}
	}
	assert.Equal(t, models.GroupCampaignRunStatusCanceled, skipped.Status)
	assert.NotEmpty(t, skipped.SkipReason)

	var reloaded models.GroupCampaign
	require.NoError(t, db.First(&reloaded, c.ID).Error)
	assert.Equal(t, models.GroupCampaignStatusRunning, reloaded.Status, "status da campanha avança mesmo quando a ocorrência é pulada")
}

func TestMaterializeDueCampaigns_OnlyTouchesScheduledAndDue(t *testing.T) {
	db := setupPluginTestDB(t)
	_, c := campaignFixture(t, db, "CONNECTED")
	addVariant(t, db, c, true)
	addTarget(t, db, c, "120363000000000001@g.us")

	past := time.Now().Add(-time.Minute)
	c.NextOccurrenceAt = &past
	require.NoError(t, db.Model(&c).Update("nextOccurrenceAt", past).Error)

	// Segunda campanha, ainda não vencida -- não deve ser tocada.
	_, cFuture := campaignFixture(t, db, "CONNECTED")
	future := time.Now().Add(time.Hour)
	require.NoError(t, db.Model(&cFuture).Update("nextOccurrenceAt", future).Error)

	materializeDueCampaigns(t.Context(), db)

	var runCountDue, runCountFuture int64
	db.Model(&models.GroupCampaignRun{}).Where(`"campaignId" = ?`, c.ID).Count(&runCountDue)
	db.Model(&models.GroupCampaignRun{}).Where(`"campaignId" = ?`, cFuture.ID).Count(&runCountFuture)

	assert.EqualValues(t, 1, runCountDue, "campanha vencida deve materializar")
	assert.EqualValues(t, 0, runCountFuture, "campanha não vencida não deve materializar")
}
