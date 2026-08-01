package plugins

import (
	"context"
	"encoding/json"
	"log"
	"slices"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// idleSweepInterval bounds how often the cron re-scans for idle Deals —
// bounded, not per-minute, since idleThresholdDays is measured in days.
const idleSweepInterval = 30 * time.Minute

// registerAssistantIdleSweep wires the "parado há X dias" cron via
// sdk.WatinkCoreScheduler (Issue #431). No-op (logged) when the core doesn't
// support it.
func registerAssistantIdleSweep(core sdk.WatinkCore, db *gorm.DB) {
	scheduler, ok := core.(sdk.WatinkCoreScheduler)
	if !ok {
		log.Printf("[assistant] WatinkCoreScheduler não disponível — sweep de idle desabilitado")
		return
	}
	if err := scheduler.RegisterCron("assistant-idle-sweep", idleSweepInterval, func(ctx context.Context) error {
		return sweepIdleDeals(ctx, core, db)
	}); err != nil {
		log.Printf("[assistant] RegisterCron(assistant-idle-sweep) falhou: %v", err)
	}
}

// sweepIdleDeals scans every active pipeline-mode Assistant with "idle" in
// its configured events and, for each Deal parked past idleThresholdDays in
// that Pipeline, sends ONE proactive nudge (idempotent via
// AssistantProactiveLog's unique index — never a duplicate per Assistant+Deal).
func sweepIdleDeals(ctx context.Context, core sdk.WatinkCore, db *gorm.DB) error {
	var assistants []models.Assistant
	if err := db.WithContext(ctx).Where(`mode = ? AND active = true`, models.AssistantModePipeline).
		Find(&assistants).Error; err != nil {
		return err
	}

	for _, a := range assistants {
		var cfg models.AssistantPipelineConfig
		if len(a.Config) > 0 {
			_ = json.Unmarshal(a.Config, &cfg)
		}
		if cfg.PipelineID == 0 || cfg.IdleThresholdDays <= 0 || !slices.Contains(cfg.Events, "idle") {
			continue
		}
		sweepIdleDealsForAssistant(ctx, core, db, a, cfg)
	}
	return nil
}

func sweepIdleDealsForAssistant(ctx context.Context, core sdk.WatinkCore, db *gorm.DB, a models.Assistant, cfg models.AssistantPipelineConfig) {
	cutoff := time.Now().AddDate(0, 0, -cfg.IdleThresholdDays)

	var deals []models.Deal
	err := db.WithContext(ctx).
		Where(`"tenantId" = ? AND "ticketId" IS NOT NULL AND "updatedAt" < ? AND status = ? AND "stageId" IN (
			SELECT id FROM "PipelineStages" WHERE "pipelineId" = ?
		)`, a.TenantID, cutoff, "open", cfg.PipelineID).
		Find(&deals).Error
	if err != nil {
		log.Printf("[assistant] idle sweep: query de deals falhou (assistant %d): %v", a.ID, err)
		return
	}

	for _, deal := range deals {
		if deal.TicketID == nil {
			continue
		}
		sent, err := markProactiveSent(db, a.TenantID, a.ID, deal.ID, "idle")
		if err != nil {
			log.Printf("[assistant] idle sweep: log de idempotência falhou (assistant %d deal %d): %v", a.ID, deal.ID, err)
			continue
		}
		if !sent {
			continue // already notified this Assistant+Deal — never resend
		}
		if err := core.SendTicketMessage(a.TenantID, *deal.TicketID, pipelineEventMessage("idle")); err != nil {
			log.Printf("[assistant] idle sweep: envio falhou (assistant %d ticket %d): %v", a.ID, *deal.TicketID, err)
		}
	}
}

// markProactiveSent atomically claims the (assistant,deal,eventType) triple
// via the unique index on AssistantProactiveLogs — returns sent=true ONLY
// when this call performed the insert. A duplicate-key error means another
// sweep (or a previous cycle) already sent it: reported as sent=false, not
// an error, so the caller just skips silently.
func markProactiveSent(db *gorm.DB, tenantID uuid.UUID, assistantID, dealID int, eventType string) (bool, error) {
	row := models.AssistantProactiveLog{
		TenantID: tenantID, AssistantID: assistantID, DealID: dealID,
		EventType: eventType, SentAt: time.Now(),
	}
	err := db.Session(&gorm.Session{NewDB: true}).Create(&row).Error
	if err == nil {
		return true, nil
	}
	if isUniqueViolation(err) {
		return false, nil
	}
	return false, err
}

func isUniqueViolation(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "duplicate key") || strings.Contains(msg, "23505")
}
