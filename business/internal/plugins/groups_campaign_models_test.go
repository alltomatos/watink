package plugins

import (
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// TestGroupCampaignModels_MigrateAndCreate is a smoke test confirming the 6
// GroupCampaign* models are correctly registered in both
// database.AutoMigrate and testutil.allModels() (issue #591) -- every later
// issue's DB tests depend on this being right. One row per model, minimal
// fields, just enough to prove the table exists with the expected columns.
func TestGroupCampaignModels_MigrateAndCreate(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	whatsapp := models.Whatsapp{TenantID: tenantID, Name: "conn-campaign-models", Number: "5511999990000"}
	require.NoError(t, db.Create(&whatsapp).Error)

	campaign := models.GroupCampaign{
		TenantID:     tenantID,
		Name:         "Campanha de teste",
		WhatsappID:   whatsapp.ID,
		Status:       models.GroupCampaignStatusDraft,
		ScheduleMode: models.GroupCampaignScheduleImmediate,
	}
	require.NoError(t, db.Create(&campaign).Error)
	require.NotZero(t, campaign.ID)

	variant := models.GroupCampaignVariant{
		TenantID:   tenantID,
		CampaignID: campaign.ID,
		Type:       "text",
		Message:    "Olá {{group_name}}",
		Active:     true,
	}
	require.NoError(t, db.Create(&variant).Error)
	require.NotZero(t, variant.ID)

	target := models.GroupCampaignTarget{
		TenantID:   tenantID,
		CampaignID: campaign.ID,
		WhatsappID: whatsapp.ID,
		JID:        "120363000000000001@g.us",
		Subject:    "Grupo de teste",
	}
	require.NoError(t, db.Create(&target).Error)
	require.NotZero(t, target.ID)

	run := models.GroupCampaignRun{
		TenantID:      tenantID,
		CampaignID:    campaign.ID,
		OccurrenceKey: "manual-1",
		Status:        models.GroupCampaignRunStatusPending,
		ScheduledFor:  time.Now(),
	}
	require.NoError(t, db.Create(&run).Error)
	require.NotZero(t, run.ID)

	send := models.GroupCampaignSend{
		TenantID:    tenantID,
		CampaignID:  campaign.ID,
		RunID:       run.ID,
		WhatsappID:  whatsapp.ID,
		JID:         target.JID,
		VariantID:   &variant.ID,
		Status:      models.GroupCampaignSendStatusPending,
		ScheduledAt: time.Now(),
		EnvID:       "env-test-1",
	}
	require.NoError(t, db.Create(&send).Error)
	require.NotZero(t, send.ID)

	reply := models.GroupCampaignReply{
		TenantID:   tenantID,
		CampaignID: campaign.ID,
		RunID:      run.ID,
		SendID:     send.ID,
		JID:        target.JID,
		TicketID:   1,
		MessageID:  "msg-reply-1",
		MatchType:  models.GroupCampaignReplyMatchQuoted,
		RepliedAt:  time.Now(),
	}
	require.NoError(t, db.Create(&reply).Error)
	require.NotZero(t, reply.ID)
}

// TestGroupCampaignTarget_UniqueCampaignJID confirms the UNIQUE(campaignId,
// jid) index added in database.go addCustomIndexes actually rejects a
// duplicate target.
func TestGroupCampaignTarget_UniqueCampaignJID(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	whatsapp := models.Whatsapp{TenantID: tenantID, Name: "conn-unique-target", Number: "5511999990001"}
	require.NoError(t, db.Create(&whatsapp).Error)
	campaign := models.GroupCampaign{TenantID: tenantID, Name: "C", WhatsappID: whatsapp.ID}
	require.NoError(t, db.Create(&campaign).Error)

	t1 := models.GroupCampaignTarget{TenantID: tenantID, CampaignID: campaign.ID, WhatsappID: whatsapp.ID, JID: "120363x@g.us"}
	require.NoError(t, db.Create(&t1).Error)

	t2 := models.GroupCampaignTarget{TenantID: tenantID, CampaignID: campaign.ID, WhatsappID: whatsapp.ID, JID: "120363x@g.us"}
	err := db.Create(&t2).Error
	require.Error(t, err, "segundo target com o mesmo (campaignId, jid) deve violar o índice único")
}

// TestGroupCampaignRun_UniqueOccurrenceKey confirms the idempotency anchor
// the materializer (issue #594) depends on.
func TestGroupCampaignRun_UniqueOccurrenceKey(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	whatsapp := models.Whatsapp{TenantID: tenantID, Name: "conn-unique-run", Number: "5511999990002"}
	require.NoError(t, db.Create(&whatsapp).Error)
	campaign := models.GroupCampaign{TenantID: tenantID, Name: "C", WhatsappID: whatsapp.ID}
	require.NoError(t, db.Create(&campaign).Error)

	r1 := models.GroupCampaignRun{TenantID: tenantID, CampaignID: campaign.ID, OccurrenceKey: "2026-01-01T09:00:00Z", ScheduledFor: time.Now()}
	require.NoError(t, db.Create(&r1).Error)

	r2 := models.GroupCampaignRun{TenantID: tenantID, CampaignID: campaign.ID, OccurrenceKey: "2026-01-01T09:00:00Z", ScheduledFor: time.Now()}
	err := db.Create(&r2).Error
	require.Error(t, err, "segunda run com a mesma (campaignId, occurrenceKey) deve violar o índice único")
}
