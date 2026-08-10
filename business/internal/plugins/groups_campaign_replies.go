package plugins

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// groupCampaignReplyGateTTL bounds how long the "does this tenant have any
// campaign activity at all?" answer is cached -- the overwhelming majority
// of group messages belong to tenants with zero campaigns, and without this
// gate every single one would cost a query. 60s (not longer) keeps a
// freshly-started campaign's replies flowing quickly.
const groupCampaignReplyGateTTL = 60 * time.Second

// groupCampaignReplyGate is a tiny in-memory, per-process TTL cache -- same
// spirit as groupsThrottle (groups_throttle.go): a per-node approximation
// is fine here because the cost of a false positive (one extra query) is
// far lower than a false negative (a missed reply), and correctness never
// depends on the cache (it only ever short-circuits, never decides).
type groupCampaignReplyGate struct {
	mu    sync.Mutex
	cache map[uuid.UUID]groupCampaignReplyGateEntry
}

type groupCampaignReplyGateEntry struct {
	active    bool
	expiresAt time.Time
}

func newGroupCampaignReplyGate() *groupCampaignReplyGate {
	return &groupCampaignReplyGate{cache: make(map[uuid.UUID]groupCampaignReplyGateEntry)}
}

func (g *groupCampaignReplyGate) active(db *gorm.DB, tenantID uuid.UUID) bool {
	g.mu.Lock()
	entry, ok := g.cache[tenantID]
	g.mu.Unlock()
	if ok && time.Now().Before(entry.expiresAt) {
		return entry.active
	}

	var exists bool
	db.Session(&gorm.Session{NewDB: true}).Raw(
		`SELECT EXISTS(SELECT 1 FROM "group_campaign_sends" WHERE "tenantId" = ? AND status = ? LIMIT 1)`,
		tenantID, models.GroupCampaignSendStatusSent,
	).Scan(&exists)

	g.mu.Lock()
	g.cache[tenantID] = groupCampaignReplyGateEntry{active: exists, expiresAt: time.Now().Add(groupCampaignReplyGateTTL)}
	g.mu.Unlock()
	return exists
}

// registerGroupCampaignReplyEvents wires the reply-capture feature: a
// SECOND "message.received" subscriber alongside registerGroupWatchEvents
// (groups_watch.go) -- the event bus appends handlers, both run
// independently on every inbound message, same precedent as the
// phrase-monitoring feature.
func registerGroupCampaignReplyEvents(core sdk.WatinkCore) {
	scheduler, ok := core.(sdk.WatinkCoreScheduler)
	if !ok {
		log.Printf("[groups] WatinkCoreScheduler não disponível — captura de resposta de campanha desabilitada")
		return
	}
	db := core.GetDB()
	gate := newGroupCampaignReplyGate()
	if err := scheduler.Subscribe("message.received", func(ctx context.Context, payload map[string]any) {
		handleGroupCampaignReplyMessage(ctx, db, gate, payload)
	}); err != nil {
		log.Printf("[groups] subscribe message.received (campaign replies) falhou: %v", err)
	}
}

// handleGroupCampaignReplyMessage is the "message.received" subscriber.
// Mirrors handleGroupWatchMessage's fast-exit shape: skip non-group and
// FromMe/empty-body messages without ever touching the campaign tables,
// then the TTL gate skips tenants with zero campaign activity.
func handleGroupCampaignReplyMessage(ctx context.Context, db *gorm.DB, gate *groupCampaignReplyGate, payload map[string]any) {
	isGroup, _ := payload["isGroup"].(bool)
	if !isGroup {
		return
	}
	tenantIDStr, _ := payload["tenantId"].(string)
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return
	}
	messageID, _ := payload["messageId"].(string)
	if messageID == "" {
		return
	}

	if !gate.active(db, tenantID) {
		return
	}

	var msg models.Message
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`id = ? AND "tenantId" = ?`, messageID, tenantID).First(&msg).Error; err != nil {
		return
	}
	if msg.FromMe || strings.TrimSpace(msg.Body) == "" {
		return
	}

	// Correlação forte: a mensagem cita uma campanha (send.MessageID ==
	// send.EnvID by construction, ver models.GroupCampaignSend) -- exata,
	// então se achar aqui a mensagem NUNCA cai pra correlação fraca (evita
	// registrar a mesma resposta duas vezes, uma quoted outra window).
	if msg.QuotedMsgID != nil && *msg.QuotedMsgID != "" {
		var send models.GroupCampaignSend
		err := db.Session(&gorm.Session{NewDB: true}).
			Where(`"tenantId" = ? AND "messageId" = ? AND status = ?`, tenantID, *msg.QuotedMsgID, models.GroupCampaignSendStatusSent).
			First(&send).Error
		if err == nil {
			recordCampaignReply(db, tenantID, msg, send, models.GroupCampaignReplyMatchQuoted)
			return
		}
	}

	recordWindowReplyIfEligible(db, tenantID, msg)
}

// weakMatchCandidate joins the campaign's captureWindowMinutes onto its
// send row -- the window is per-campaign, not global, so it has to travel
// with each candidate rather than being applied as a single WHERE bound.
type weakMatchCandidate struct {
	models.GroupCampaignSend
	CaptureWindowMinutes int `gorm:"column:captureWindowMinutes"`
}

// recordWindowReplyIfEligible implements the WEAK correlation
// (matchType=window): the most recent "sent" send into the same group,
// only for campaigns with captureMode=quoted_and_window, only if it's
// still within THAT campaign's own captureWindowMinutes. Candidates are
// walked newest-first so a short-window campaign's stale send never blocks
// a longer-window campaign's still-eligible one.
func recordWindowReplyIfEligible(db *gorm.DB, tenantID uuid.UUID, msg models.Message) {
	if msg.ContactID == nil {
		return
	}
	var contact models.Contact
	if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ?`, *msg.ContactID).First(&contact).Error; err != nil || !contact.IsGroup {
		return
	}
	jid := contact.Number + "@g.us"

	var candidates []weakMatchCandidate
	if err := db.Session(&gorm.Session{NewDB: true}).Raw(`
		SELECT s.*, c."captureWindowMinutes" AS "captureWindowMinutes"
		  FROM "group_campaign_sends" s
		  JOIN "group_campaigns" c ON c.id = s."campaignId"
		 WHERE s."tenantId" = ? AND s.jid = ? AND s.status = ? AND c."captureMode" = ?
		 ORDER BY s."sentAt" DESC
		 LIMIT 5
	`, tenantID, jid, models.GroupCampaignSendStatusSent, models.GroupCampaignCaptureQuotedAndWindow).
		Scan(&candidates).Error; err != nil || len(candidates) == 0 {
		return
	}

	for _, cand := range candidates {
		if cand.SentAt == nil {
			continue
		}
		if time.Since(*cand.SentAt) <= time.Duration(cand.CaptureWindowMinutes)*time.Minute {
			recordCampaignReply(db, tenantID, msg, cand.GroupCampaignSend, models.GroupCampaignReplyMatchWindow)
			return
		}
	}
}

// groupCampaignReplyBodyCap mirrors the doc comment on
// models.GroupCampaignReply.Body ("capped at 1000 chars by the handler").
const groupCampaignReplyBodyCap = 1000

// recordCampaignReply inserts the reply and bumps replyCount on both the
// send and the run -- always via gorm.Expr (never read-modify-write, per
// the module's own invariant). UNIQUE(tenantId, messageId) makes a
// "message.received" redelivery a silent no-op via isUniqueViolation:
// counters must NEVER double-increment for the same inbound message.
func recordCampaignReply(db *gorm.DB, tenantID uuid.UUID, msg models.Message, send models.GroupCampaignSend, matchType string) {
	body := msg.Body
	if len(body) > groupCampaignReplyBodyCap {
		body = body[:groupCampaignReplyBodyCap]
	}

	reply := models.GroupCampaignReply{
		TenantID:    tenantID,
		CampaignID:  send.CampaignID,
		RunID:       send.RunID,
		SendID:      send.ID,
		JID:         send.JID,
		TicketID:    msg.TicketID,
		MessageID:   msg.ID,
		Participant: msg.Participant,
		ContactName: messagePushName(msg.DataJson),
		Body:        body,
		MatchType:   matchType,
		IsOptOut:    isOptOutMessage(body),
		RepliedAt:   msg.CreatedAt,
		CreatedAt:   time.Now(),
	}
	if err := db.Session(&gorm.Session{NewDB: true}).Create(&reply).Error; err != nil {
		if isUniqueViolation(err) {
			return // redelivery do mesmo "message.received" -- no-op, contadores já foram incrementados
		}
		log.Printf("[groups] campaign reply: falha ao gravar resposta (send %d, msg %s): %v", send.ID, msg.ID, err)
		return
	}

	db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignSend{}).
		Where(`id = ?`, send.ID).Update("replyCount", gorm.Expr(`"replyCount" + 1`))
	db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignRun{}).
		Where(`id = ?`, send.RunID).Update("replyCount", gorm.Expr(`"replyCount" + 1`))
}

// isOptOutMessage is a case-insensitive SUBSTRING match (not exact) --
// "pode parar de mandar isso" opts out just as much as a bare "PARAR". No
// automatic group-wide suppression: one member's opt-out can't unsubscribe
// everyone else in the group (the operator removes the target manually,
// see the report UI, issue #601).
func isOptOutMessage(body string) bool {
	upper := strings.ToUpper(body)
	for _, kw := range []string{"PARAR", "STOP", "SAIR", "DESCADASTRAR"} {
		if strings.Contains(upper, kw) {
			return true
		}
	}
	return false
}
