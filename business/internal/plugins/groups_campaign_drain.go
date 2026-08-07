package plugins

import (
	"context"
	"log"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	// groupCampaignClaimStuckAfter/groupCampaignClaimMaxAttempts govern the
	// reaper: a send stuck in "sending" (crash between claim and publish)
	// gets one retry window, then permanently fails rather than blocking
	// its run forever.
	groupCampaignClaimStuckAfter  = 5 * time.Minute
	groupCampaignClaimMaxAttempts = 3
	groupCampaignDrainBatchLimit  = 200
	groupCampaignRetryBackoff     = 2 * time.Minute
	// groupCampaignBreakerWindow: a connection is paused when its last N
	// settled sends are ALL failed.
	groupCampaignBreakerWindow = 5
)

// drainDueSends is the "group-campaigns-drain" cron body. Never sends more
// than one item per connection per tick (see pickDueSends) -- that's the
// backlog protection: if a node was down and many sends came due at once,
// draining them one-per-connection-per-tick re-spreads the backlog instead
// of bursting every group at once.
func drainDueSends(ctx context.Context, core sdk.WatinkCore, db *gorm.DB, adapter *flow.WhatsAppAdapter) {
	reapStuckClaims(ctx, db)

	due, err := pickDueSends(ctx, db)
	if err != nil {
		log.Printf("[groups] campaign drain: falha ao selecionar envios vencidos: %v", err)
		return
	}

	for _, send := range due {
		if ctx.Err() != nil {
			log.Printf("[groups] campaign drain: contexto expirado, encerrando tick cedo")
			return
		}
		drainOneSend(ctx, db, core, adapter, send)
	}

	closeFinishedRuns(db)
	closeFinishedCampaigns(db)
}

// reapStuckClaims resets a send stuck in "sending" for too long (crash
// between claim and publish, or a node that died mid-send) back to
// "pending" so another node's next tick can retry it -- or, once attempts
// are exhausted, fails it permanently instead of retrying forever.
func reapStuckClaims(ctx context.Context, db *gorm.DB) {
	cutoff := time.Now().Add(-groupCampaignClaimStuckAfter)

	if err := db.WithContext(ctx).Model(&models.GroupCampaignSend{}).
		Where(`status = ? AND "claimedAt" < ? AND attempts < ?`,
			models.GroupCampaignSendStatusSending, cutoff, groupCampaignClaimMaxAttempts).
		Updates(map[string]interface{}{"status": models.GroupCampaignSendStatusPending, "updatedAt": time.Now()}).Error; err != nil {
		log.Printf("[groups] campaign drain: reap (retry) falhou: %v", err)
	}

	if err := db.WithContext(ctx).Model(&models.GroupCampaignSend{}).
		Where(`status = ? AND "claimedAt" < ? AND attempts >= ?`,
			models.GroupCampaignSendStatusSending, cutoff, groupCampaignClaimMaxAttempts).
		Updates(map[string]interface{}{"status": models.GroupCampaignSendStatusFailed, "lastError": "claim expirado", "updatedAt": time.Now()}).Error; err != nil {
		log.Printf("[groups] campaign drain: reap (fail) falhou: %v", err)
	}
}

// pickDueSends selects AT MOST ONE pending send per WhatsApp connection --
// DISTINCT ON ("whatsappId") ordered by scheduledAt -- restricted to
// connections that are actually CONNECTED right now, AND to campaigns
// still "running". This is the anti-ban backlog guard from
// groups_campaign_schedule.go's design doc: never a thundering herd
// against a single chip, and a dead connection never silently accumulates
// an unbounded queue of claims. The campaign-status join is what makes
// /pause (issue #597) actually stop the drain -- without it, a paused
// campaign's already-materialized pending sends would keep going out.
func pickDueSends(ctx context.Context, db *gorm.DB) ([]models.GroupCampaignSend, error) {
	var due []models.GroupCampaignSend
	err := db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (s."whatsappId") s.*
		  FROM "group_campaign_sends" s
		  JOIN "Whatsapps" w ON w.id = s."whatsappId"
		  JOIN "group_campaigns" c ON c.id = s."campaignId"
		 WHERE s.status = ? AND s."scheduledAt" <= ? AND w.status = ? AND c.status = ?
		 ORDER BY s."whatsappId", s."scheduledAt" ASC
		 LIMIT ?
	`, models.GroupCampaignSendStatusPending, time.Now(), "CONNECTED", models.GroupCampaignStatusRunning, groupCampaignDrainBatchLimit).
		Scan(&due).Error
	return due, err
}

// drainOneSend claims (see claimSend), dispatches, and settles exactly one
// send. A lost claim race (RowsAffected==0) is a silent no-op -- another
// node already owns this send.
func drainOneSend(ctx context.Context, db *gorm.DB, core sdk.WatinkCore, adapter *flow.WhatsAppAdapter, send models.GroupCampaignSend) {
	claimed, err := claimSend(db, send.ID)
	if err != nil {
		log.Printf("[groups] campaign drain: claim falhou (send %d): %v", send.ID, err)
		return
	}
	if !claimed {
		return // outro nó ganhou a corrida -- nunca envia
	}

	sendErr := sendOne(ctx, db, core, adapter, send)
	if sendErr == nil {
		settleSendSuccess(db, send)
		return
	}
	settleSendFailure(db, send, sendErr)
}

// claimSend is THE guard against a double-send: a conditional UPDATE that
// only transitions pending->sending, checked via RowsAffected. If two
// nodes (or two ticks) race the same send, exactly one gets RowsAffected==1
// -- the other gets 0 and must never publish. This is the guarantee; the
// cron's leader-lock (scheduler.go) is defence in depth, not the mechanism
// that actually prevents duplicates (it's nil-safe without Redis, and a
// slow tick can outlive its own TTL).
func claimSend(db *gorm.DB, sendID int64) (bool, error) {
	res := db.Session(&gorm.Session{NewDB: true}).
		Model(&models.GroupCampaignSend{}).
		Where(`id = ? AND status = ?`, sendID, models.GroupCampaignSendStatusPending).
		Updates(map[string]interface{}{
			"status":    models.GroupCampaignSendStatusSending,
			"claimedAt": time.Now(),
			"attempts":  gorm.Expr(`attempts + 1`),
			"updatedAt": time.Now(),
		})
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

func settleSendSuccess(db *gorm.DB, send models.GroupCampaignSend) {
	now := time.Now()
	writeDB := db.Session(&gorm.Session{NewDB: true})
	if err := writeDB.Model(&models.GroupCampaignSend{}).
		Where(`id = ?`, send.ID).
		Updates(map[string]interface{}{"status": models.GroupCampaignSendStatusSent, "sentAt": now, "updatedAt": now}).Error; err != nil {
		log.Printf("[groups] campaign drain: falha ao marcar envio %d como sent: %v", send.ID, err)
		return
	}
	writeDB.Model(&models.GroupCampaignRun{}).
		Where(`id = ?`, send.RunID).
		Update("sentCount", gorm.Expr(`"sentCount" + 1`))
}

// settleSendFailure retries with backoff (attempts already incremented by
// claimSend) or, once attempts are exhausted, fails permanently and
// evaluates the circuit breaker for that connection.
func settleSendFailure(db *gorm.DB, send models.GroupCampaignSend, sendErr error) {
	writeDB := db.Session(&gorm.Session{NewDB: true})

	var current models.GroupCampaignSend
	if err := writeDB.Select("attempts").Where(`id = ?`, send.ID).First(&current).Error; err != nil {
		log.Printf("[groups] campaign drain: falha ao reler envio %d após erro de envio: %v", send.ID, err)
		return
	}

	if current.Attempts >= groupCampaignClaimMaxAttempts {
		now := time.Now()
		if err := writeDB.Model(&models.GroupCampaignSend{}).Where(`id = ?`, send.ID).
			Updates(map[string]interface{}{"status": models.GroupCampaignSendStatusFailed, "lastError": sendErr.Error(), "updatedAt": now}).Error; err != nil {
			log.Printf("[groups] campaign drain: falha ao marcar envio %d como failed: %v", send.ID, err)
			return
		}
		writeDB.Model(&models.GroupCampaignRun{}).Where(`id = ?`, send.RunID).
			Update("failedCount", gorm.Expr(`"failedCount" + 1`))
		evaluateCircuitBreaker(writeDB, send.TenantID, send.WhatsappID)
		return
	}

	if err := writeDB.Model(&models.GroupCampaignSend{}).Where(`id = ?`, send.ID).
		Updates(map[string]interface{}{
			"status":      models.GroupCampaignSendStatusPending,
			"lastError":   sendErr.Error(),
			"scheduledAt": time.Now().Add(groupCampaignRetryBackoff),
			"updatedAt":   time.Now(),
		}).Error; err != nil {
		log.Printf("[groups] campaign drain: falha ao reagendar retry do envio %d: %v", send.ID, err)
	}
}

// evaluateCircuitBreaker pauses every running campaign on a connection
// once its last groupCampaignBreakerWindow sends are ALL permanently
// failed -- a degraded chip stops receiving new sends automatically
// instead of burning through the rest of the run.
func evaluateCircuitBreaker(db *gorm.DB, tenantID uuid.UUID, whatsappID int) {
	var recent []models.GroupCampaignSend
	if err := db.
		Where(`"tenantId" = ? AND "whatsappId" = ? AND status IN ?`, tenantID, whatsappID,
			[]string{models.GroupCampaignSendStatusSent, models.GroupCampaignSendStatusFailed}).
		Order(`"updatedAt" DESC`).
		Limit(groupCampaignBreakerWindow).
		Find(&recent).Error; err != nil {
		log.Printf("[groups] campaign drain: circuit breaker: falha ao ler histórico (whatsapp %d): %v", whatsappID, err)
		return
	}
	if len(recent) < groupCampaignBreakerWindow {
		return // ainda não há histórico suficiente pra decidir
	}
	for _, s := range recent {
		if s.Status != models.GroupCampaignSendStatusFailed {
			return // pelo menos um sucesso recente -- conexão ainda saudável
		}
	}

	if err := db.Model(&models.GroupCampaign{}).
		Where(`"tenantId" = ? AND "whatsappId" = ? AND status = ?`, tenantID, whatsappID, models.GroupCampaignStatusRunning).
		Updates(map[string]interface{}{
			"status":      models.GroupCampaignStatusPaused,
			"pauseReason": "conexão instável — campanha pausada automaticamente",
			"updatedAt":   time.Now(),
		}).Error; err != nil {
		log.Printf("[groups] campaign drain: circuit breaker: falha ao pausar campanhas (whatsapp %d): %v", whatsappID, err)
	}
}

// closeFinishedRuns marks a run "completed" once it has zero sends left in
// pending/sending -- recounting the authoritative status/reply tallies
// from the sends themselves in one aggregate pass rather than trusting the
// incremental counters, which can drift under retries.
func closeFinishedRuns(db *gorm.DB) {
	var openRunIDs []int
	if err := db.Model(&models.GroupCampaignRun{}).
		Where(`status = ?`, models.GroupCampaignRunStatusRunning).
		Pluck("id", &openRunIDs).Error; err != nil {
		log.Printf("[groups] campaign drain: falha ao listar runs abertas: %v", err)
		return
	}

	for _, runID := range openRunIDs {
		var openCount int64
		if err := db.Model(&models.GroupCampaignSend{}).
			Where(`"runId" = ? AND status IN ?`, runID, []string{models.GroupCampaignSendStatusPending, models.GroupCampaignSendStatusSending}).
			Count(&openCount).Error; err != nil || openCount > 0 {
			continue
		}

		var sentCount, failedCount, skippedCount int64
		db.Model(&models.GroupCampaignSend{}).Where(`"runId" = ? AND status = ?`, runID, models.GroupCampaignSendStatusSent).Count(&sentCount)
		db.Model(&models.GroupCampaignSend{}).Where(`"runId" = ? AND status = ?`, runID, models.GroupCampaignSendStatusFailed).Count(&failedCount)
		db.Model(&models.GroupCampaignSend{}).Where(`"runId" = ? AND status = ?`, runID, models.GroupCampaignSendStatusSkipped).Count(&skippedCount)

		db.Model(&models.GroupCampaignRun{}).Where(`id = ?`, runID).Updates(map[string]interface{}{
			"status":       models.GroupCampaignRunStatusCompleted,
			"finishedAt":   time.Now(),
			"sentCount":    sentCount,
			"failedCount":  failedCount,
			"skippedCount": skippedCount,
			"updatedAt":    time.Now(),
		})
	}
}

// closeFinishedCampaigns marks a campaign "completed" once it's running,
// has no more occurrences scheduled (NextOccurrenceAt IS NULL), and has no
// run left open -- covers immediate/once (a single occurrence) and a
// recurring campaign that reached RecurrenceEndAt.
func closeFinishedCampaigns(db *gorm.DB) {
	db.Exec(`
		UPDATE "group_campaigns" c SET status = ?, "updatedAt" = ?
		WHERE c.status = ? AND c."nextOccurrenceAt" IS NULL
		  AND NOT EXISTS (
		    SELECT 1 FROM "group_campaign_runs" r
		    WHERE r."campaignId" = c.id AND r.status = ?
		  )
	`, models.GroupCampaignStatusCompleted, time.Now(), models.GroupCampaignStatusRunning, models.GroupCampaignRunStatusRunning)
}
