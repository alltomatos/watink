package plugins

import (
	"context"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// sentCampaignSendFixture creates a campaign (status=running by default, so
// the reply gate finds it), a run, and ONE already-"sent" send -- MessageID
// == EnvID by construction (models.GroupCampaignSend doc), same as the real
// send path (sendOne, issue #595).
func sentCampaignSendFixture(t *testing.T, db *gorm.DB, w models.Whatsapp, c models.GroupCampaign, jid string, sentAt time.Time) models.GroupCampaignSend {
	t.Helper()
	run := models.GroupCampaignRun{TenantID: c.TenantID, CampaignID: c.ID, OccurrenceKey: "manual-" + jid, Status: models.GroupCampaignRunStatusRunning, ScheduledFor: time.Now()}
	require.NoError(t, db.Create(&run).Error)
	send := models.GroupCampaignSend{
		TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID,
		JID: jid, Status: models.GroupCampaignSendStatusSent, ScheduledAt: sentAt, SentAt: &sentAt,
		EnvID: "env-" + jid, MessageID: "env-" + jid,
	}
	require.NoError(t, db.Create(&send).Error)
	return send
}

// groupContactAndInboundMessage creates the group Contact/Ticket the
// "message.received" payload refers to, plus the inbound Message itself
// (FromMe=false, optionally quoting quotedMsgID).
func groupContactAndInboundMessage(t *testing.T, db *gorm.DB, tenantID uuid.UUID, jid, body string, quotedMsgID *string) models.Message {
	t.Helper()
	number := jid[:len(jid)-len("@g.us")]
	contact := models.Contact{TenantID: tenantID, Name: "Grupo", Number: number, IsGroup: true}
	require.NoError(t, db.Create(&contact).Error)
	ticket := models.Ticket{TenantID: tenantID, ContactID: contact.ID, WhatsappID: 1, Status: "open", IsGroup: true}
	require.NoError(t, db.Create(&ticket).Error)
	msg := models.Message{
		ID: "in-" + uuid.New().String(), Body: body, TicketID: ticket.ID, FromMe: false,
		ContactID: &contact.ID, TenantID: tenantID, Reactions: "[]", DataJson: "{}",
		QuotedMsgID: quotedMsgID, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	require.NoError(t, db.Create(&msg).Error)
	return msg
}

func replyPayload(tenantID uuid.UUID, ticketID int, messageID string) map[string]any {
	return map[string]any{
		"tenantId":  tenantID.String(),
		"ticketId":  ticketID,
		"messageId": messageID,
		"isGroup":   true,
	}
}

// ── TestHandleCampaignReply ──────────────────────────────────────────────

func TestHandleCampaignReply_QuotedCreatesReplyAndIncrementsCounters(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Update("status", models.GroupCampaignStatusRunning).Error)
	jid := "120363000000000041@g.us"
	send := sentCampaignSendFixture(t, db, w, c, jid, time.Now().Add(-time.Minute))

	quoted := send.MessageID
	msg := groupContactAndInboundMessage(t, db, c.TenantID, jid, "vou sim!", &quoted)

	gate := newGroupCampaignReplyGate()
	handleGroupCampaignReplyMessage(context.Background(), db, gate, replyPayload(c.TenantID, msg.TicketID, msg.ID))

	var reply models.GroupCampaignReply
	require.NoError(t, db.Where(`"messageId" = ?`, msg.ID).First(&reply).Error)
	assert.Equal(t, models.GroupCampaignReplyMatchQuoted, reply.MatchType)
	assert.Equal(t, send.ID, reply.SendID)
	assert.False(t, reply.IsOptOut)

	var reloadedSend models.GroupCampaignSend
	require.NoError(t, db.First(&reloadedSend, send.ID).Error)
	assert.Equal(t, 1, reloadedSend.ReplyCount)

	var reloadedRun models.GroupCampaignRun
	require.NoError(t, db.First(&reloadedRun, send.RunID).Error)
	assert.Equal(t, 1, reloadedRun.ReplyCount)
}

func TestHandleCampaignReply_RedeliveryIsIdempotent(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Update("status", models.GroupCampaignStatusRunning).Error)
	jid := "120363000000000042@g.us"
	send := sentCampaignSendFixture(t, db, w, c, jid, time.Now().Add(-time.Minute))

	quoted := send.MessageID
	msg := groupContactAndInboundMessage(t, db, c.TenantID, jid, "vou sim!", &quoted)

	gate := newGroupCampaignReplyGate()
	payload := replyPayload(c.TenantID, msg.TicketID, msg.ID)
	handleGroupCampaignReplyMessage(context.Background(), db, gate, payload)
	handleGroupCampaignReplyMessage(context.Background(), db, gate, payload) // redelivery

	var count int64
	db.Model(&models.GroupCampaignReply{}).Where(`"messageId" = ?`, msg.ID).Count(&count)
	assert.EqualValues(t, 1, count, "redelivery não deve duplicar a reply")

	var reloadedSend models.GroupCampaignSend
	require.NoError(t, db.First(&reloadedSend, send.ID).Error)
	assert.Equal(t, 1, reloadedSend.ReplyCount, "redelivery não deve incrementar o contador de novo")
}

func TestHandleCampaignReply_WindowOnlyWhenCaptureModeAllows(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Updates(map[string]interface{}{"status": models.GroupCampaignStatusRunning, "captureMode": models.GroupCampaignCaptureQuoted}).Error)
	jid := "120363000000000043@g.us"
	sentCampaignSendFixture(t, db, w, c, jid, time.Now().Add(-time.Minute))

	msg := groupContactAndInboundMessage(t, db, c.TenantID, jid, "boa noite pessoal", nil) // sem quotedMsgId

	gate := newGroupCampaignReplyGate()
	handleGroupCampaignReplyMessage(context.Background(), db, gate, replyPayload(c.TenantID, msg.TicketID, msg.ID))

	var count int64
	db.Model(&models.GroupCampaignReply{}).Where(`"messageId" = ?`, msg.ID).Count(&count)
	assert.EqualValues(t, 0, count, "captureMode=quoted nunca deve capturar via janela")
}

func TestHandleCampaignReply_WindowMatchesWhenModeIsQuotedAndWindow(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Updates(map[string]interface{}{
		"status": models.GroupCampaignStatusRunning, "captureMode": models.GroupCampaignCaptureQuotedAndWindow, "captureWindowMinutes": 60,
	}).Error)
	jid := "120363000000000044@g.us"
	send := sentCampaignSendFixture(t, db, w, c, jid, time.Now().Add(-10*time.Minute))

	msg := groupContactAndInboundMessage(t, db, c.TenantID, jid, "boa noite pessoal", nil)

	gate := newGroupCampaignReplyGate()
	handleGroupCampaignReplyMessage(context.Background(), db, gate, replyPayload(c.TenantID, msg.TicketID, msg.ID))

	var reply models.GroupCampaignReply
	require.NoError(t, db.Where(`"messageId" = ?`, msg.ID).First(&reply).Error)
	assert.Equal(t, models.GroupCampaignReplyMatchWindow, reply.MatchType)
	assert.Equal(t, send.ID, reply.SendID)
}

func TestHandleCampaignReply_OutsideWindowNeverMatches(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Updates(map[string]interface{}{
		"status": models.GroupCampaignStatusRunning, "captureMode": models.GroupCampaignCaptureQuotedAndWindow, "captureWindowMinutes": 5,
	}).Error)
	jid := "120363000000000045@g.us"
	sentCampaignSendFixture(t, db, w, c, jid, time.Now().Add(-time.Hour))

	msg := groupContactAndInboundMessage(t, db, c.TenantID, jid, "boa noite pessoal", nil)

	gate := newGroupCampaignReplyGate()
	handleGroupCampaignReplyMessage(context.Background(), db, gate, replyPayload(c.TenantID, msg.TicketID, msg.ID))

	var count int64
	db.Model(&models.GroupCampaignReply{}).Where(`"messageId" = ?`, msg.ID).Count(&count)
	assert.EqualValues(t, 0, count)
}

func TestHandleCampaignReply_IgnoresFromMeAndNonGroup(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Update("status", models.GroupCampaignStatusRunning).Error)
	jid := "120363000000000046@g.us"
	send := sentCampaignSendFixture(t, db, w, c, jid, time.Now().Add(-time.Minute))
	gate := newGroupCampaignReplyGate()

	quoted := send.MessageID
	number := jid[:len(jid)-len("@g.us")]
	contact := models.Contact{TenantID: c.TenantID, Name: "Grupo", Number: number, IsGroup: true}
	require.NoError(t, db.Create(&contact).Error)
	ticket := models.Ticket{TenantID: c.TenantID, ContactID: contact.ID, WhatsappID: 1, Status: "open", IsGroup: true}
	require.NoError(t, db.Create(&ticket).Error)
	fromMeMsg := models.Message{
		ID: "in-fromme", Body: "eco da própria conexão", TicketID: ticket.ID, FromMe: true,
		ContactID: &contact.ID, TenantID: c.TenantID, Reactions: "[]", DataJson: "{}",
		QuotedMsgID: &quoted, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	require.NoError(t, db.Create(&fromMeMsg).Error)

	handleGroupCampaignReplyMessage(context.Background(), db, gate, replyPayload(c.TenantID, ticket.ID, fromMeMsg.ID))
	handleGroupCampaignReplyMessage(context.Background(), db, gate, map[string]any{
		"tenantId": c.TenantID.String(), "ticketId": ticket.ID, "messageId": fromMeMsg.ID, "isGroup": false,
	})

	var count int64
	db.Model(&models.GroupCampaignReply{}).Count(&count)
	assert.EqualValues(t, 0, count, "FromMe e não-grupo nunca devem gerar reply")
}

func TestHandleCampaignReply_OptOutKeywordMarksIsOptOut(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	require.NoError(t, db.Model(&c).Update("status", models.GroupCampaignStatusRunning).Error)
	jid := "120363000000000047@g.us"
	send := sentCampaignSendFixture(t, db, w, c, jid, time.Now().Add(-time.Minute))

	quoted := send.MessageID
	msg := groupContactAndInboundMessage(t, db, c.TenantID, jid, "por favor PARAR de mandar isso", &quoted)

	gate := newGroupCampaignReplyGate()
	handleGroupCampaignReplyMessage(context.Background(), db, gate, replyPayload(c.TenantID, msg.TicketID, msg.ID))

	var reply models.GroupCampaignReply
	require.NoError(t, db.Where(`"messageId" = ?`, msg.ID).First(&reply).Error)
	assert.True(t, reply.IsOptOut)
}

func TestGroupCampaignReplyGate_SkipsTenantsWithNoCampaignActivity(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	gate := newGroupCampaignReplyGate()
	assert.False(t, gate.active(db, tenantID))
}
