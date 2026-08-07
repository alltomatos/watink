package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// --- local mocks (no globals; per ADR 0006 test policy) ---

type sendFakePublisher struct {
	calls []struct {
		routingKey string
		payload    interface{}
	}
	err error
}

func (p *sendFakePublisher) PublishCommand(routingKey string, payload interface{}) error {
	if p.err != nil {
		return p.err
	}
	p.calls = append(p.calls, struct {
		routingKey string
		payload    interface{}
	}{routingKey, payload})
	return nil
}

type sendFakeRedis struct {
	locked map[string]bool
}

func newSendFakeRedis() *sendFakeRedis { return &sendFakeRedis{locked: map[string]bool{}} }

func (r *sendFakeRedis) SetLock(key, _ string, _ time.Duration) (bool, error) {
	if r.locked[key] {
		return false, nil
	}
	r.locked[key] = true
	return true, nil
}
func (r *sendFakeRedis) DelLock(key string) error {
	delete(r.locked, key)
	return nil
}
func (r *sendFakeRedis) Subscribe(context.Context, string) *redis.PubSub    { return nil }
func (r *sendFakeRedis) Publish(context.Context, string, interface{}) error { return nil }
func (r *sendFakeRedis) Ping(context.Context) error                         { return nil }
func (r *sendFakeRedis) Get(context.Context, string) (string, error)        { return "", nil }

// runWithSnapshot cria uma run com o snapshot já congelado — sendOne lê o
// snapshot da run, nunca as GroupCampaignVariant direto (a run executa a
// versão que existia quando materializou, ver materializeRun).
func runWithSnapshot(t *testing.T, db *gorm.DB, c models.GroupCampaign, variants []variantSnapshotEntry) models.GroupCampaignRun {
	t.Helper()
	snap, err := json.Marshal(variants)
	require.NoError(t, err)
	r := models.GroupCampaignRun{
		TenantID: c.TenantID, CampaignID: c.ID, OccurrenceKey: "manual-" + c.Name,
		Status: models.GroupCampaignRunStatusRunning, ScheduledFor: time.Now(),
		VariantsSnapshot: snap,
	}
	require.NoError(t, db.Create(&r).Error)
	return r
}

func sendFixtureWithVariant(t *testing.T, db *gorm.DB, w models.Whatsapp, c models.GroupCampaign, run models.GroupCampaignRun, jid string, variantIndex int) models.GroupCampaignSend {
	t.Helper()
	s := models.GroupCampaignSend{
		TenantID: c.TenantID, CampaignID: c.ID, RunID: run.ID, WhatsappID: w.ID,
		JID: jid, Subject: "Grupo Teste", Status: models.GroupCampaignSendStatusPending,
		ScheduledAt: time.Now(), VariantIndex: variantIndex, EnvID: "env-" + jid,
	}
	require.NoError(t, db.Create(&s).Error)
	return s
}

// ── sendOne ──────────────────────────────────────────────────────────────

func TestSendOne_PublishesRichCommandForInteractiveVariant(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runWithSnapshot(t, db, c, []variantSnapshotEntry{
		{ID: 1, Type: "interactive_buttons", Message: "olá {{group_name}}", Content: `{"body":"olá","buttons":[{"id":"1","text":"Sim"}]}`},
	})
	send := sendFixtureWithVariant(t, db, w, c, run, "120363000000000009@g.us", 0)

	pub := &sendFakePublisher{}
	adapter := flow.NewWhatsAppAdapter(pub, newSendFakeRedis())

	err := sendOne(context.Background(), db, nil, adapter, send)
	require.NoError(t, err)

	require.Len(t, pub.calls, 1)
	expectedKey := fmt.Sprintf("wbot.%s.%d.message.send.interactive", c.TenantID.String(), w.ID)
	assert.Equal(t, expectedKey, pub.calls[0].routingKey)

	command, ok := pub.calls[0].payload.(map[string]interface{})
	require.True(t, ok)
	payload, ok := command["payload"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "120363000000000009@g.us", payload["to"])
	assert.Equal(t, send.EnvID, payload["messageId"])
}

func TestSendOne_PersistsMessageWithEnvIDAsPrimaryKey(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runWithSnapshot(t, db, c, []variantSnapshotEntry{
		{ID: 1, Type: "text", Message: "olá pessoal do {{group_name}}"},
	})
	send := sendFixtureWithVariant(t, db, w, c, run, "120363000000000010@g.us", 0)

	pub := &sendFakePublisher{}
	adapter := flow.NewWhatsAppAdapter(pub, newSendFakeRedis())

	err := sendOne(context.Background(), db, nil, adapter, send)
	require.NoError(t, err)

	var msg models.Message
	require.NoError(t, db.Where(`id = ?`, send.EnvID).First(&msg).Error)
	assert.True(t, msg.FromMe)
	assert.Equal(t, "olá pessoal do Grupo Teste", msg.Body)
	assert.False(t, msg.IsDeleted)

	var updated models.GroupCampaignSend
	require.NoError(t, db.First(&updated, send.ID).Error)
	assert.NotZero(t, updated.TicketID)
}

func TestEnsureGroupTicket_ReusesOpenTicketAndContact(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runWithSnapshot(t, db, c, []variantSnapshotEntry{{ID: 1, Type: "text", Message: "oi"}})
	jid := "120363000000000011@g.us"
	sendA := sendFixtureWithVariant(t, db, w, c, run, jid, 0)

	pub := &sendFakePublisher{}
	adapter := flow.NewWhatsAppAdapter(pub, newSendFakeRedis())
	require.NoError(t, sendOne(context.Background(), db, nil, adapter, sendA))

	var afterFirst models.GroupCampaignSend
	require.NoError(t, db.First(&afterFirst, sendA.ID).Error)

	sendB := sendFixtureWithVariant(t, db, w, c, run, jid, 0)
	sendB.EnvID = "env-" + jid + "-2"
	require.NoError(t, db.Model(&models.GroupCampaignSend{}).Where("id = ?", sendB.ID).Update("envId", sendB.EnvID).Error)
	require.NoError(t, sendOne(context.Background(), db, nil, adapter, sendB))

	var afterSecond models.GroupCampaignSend
	require.NoError(t, db.First(&afterSecond, sendB.ID).Error)
	assert.Equal(t, afterFirst.TicketID, afterSecond.TicketID, "mesmo grupo deve reusar o ticket aberto")

	var contactCount int64
	db.Model(&models.Contact{}).Where(`"tenantId" = ? AND "isGroup" = ?`, c.TenantID, true).Count(&contactCount)
	assert.Equal(t, int64(1), contactCount, "mesmo JID deve reusar o contato, não duplicar")
}

func TestSendOne_PublishFailureMarksMessageUndelivered(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runWithSnapshot(t, db, c, []variantSnapshotEntry{{ID: 1, Type: "text", Message: "oi"}})
	send := sendFixtureWithVariant(t, db, w, c, run, "120363000000000012@g.us", 0)

	pub := &sendFakePublisher{err: errors.New("amqp indisponível")}
	adapter := flow.NewWhatsAppAdapter(pub, newSendFakeRedis())

	err := sendOne(context.Background(), db, nil, adapter, send)
	require.Error(t, err)

	var msg models.Message
	require.NoError(t, db.Where(`id = ?`, send.EnvID).First(&msg).Error)
	assert.True(t, msg.IsDeleted, "mensagem não confirmada no publish deve ficar soft-deleted")
}

func TestSendOne_NilAdapterFailsClosed(t *testing.T) {
	db := setupPluginTestDB(t)
	w, c := campaignFixture(t, db, "CONNECTED")
	run := runWithSnapshot(t, db, c, []variantSnapshotEntry{{ID: 1, Type: "text", Message: "oi"}})
	send := sendFixtureWithVariant(t, db, w, c, run, "120363000000000013@g.us", 0)

	err := sendOne(context.Background(), db, nil, nil, send)
	assert.ErrorIs(t, err, errAdapterNotConfigured)
}
