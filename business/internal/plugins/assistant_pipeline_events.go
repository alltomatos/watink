package plugins

import (
	"context"
	"encoding/json"
	"log"
	"slices"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// pipelineEventTypes are the domain events DealController publishes
// (business/internal/controllers/deal.go) plus "idle", published by the
// scheduler sweep (assistant_scheduler.go). Short names here (without the
// "pipeline.deal." prefix) MUST match models.AssistantPipelineConfig.Events.
var pipelineEventTypes = []string{
	"pipeline.deal.deal_created",
	"pipeline.deal.stage_changed",
	"pipeline.deal.closed",
	"pipeline.deal.idle",
}

// registerAssistantPipelineEvents subscribes the plugin to every Pipeline
// domain event via sdk.WatinkCoreScheduler (ADR 0027 — the optional
// extension from Issue #431). Silently disabled (logged once) if the core
// implementation doesn't support it — never panics OnActivate.
func registerAssistantPipelineEvents(core sdk.WatinkCore, db *gorm.DB) {
	scheduler, ok := core.(sdk.WatinkCoreScheduler)
	if !ok {
		log.Printf("[assistant] WatinkCoreScheduler não disponível — eventos de Pipeline desabilitados")
		return
	}
	for _, evt := range pipelineEventTypes {
		evt := evt
		if err := scheduler.Subscribe(evt, func(ctx context.Context, payload map[string]any) {
			handlePipelineEvent(ctx, core, db, evt, payload)
		}); err != nil {
			log.Printf("[assistant] subscribe %q falhou: %v", evt, err)
		}
	}
}

// handlePipelineEvent fans a domain event out to every active pipeline-mode
// Assistant configured for that PipelineID+event, sending one proactive
// message per match. Requires a ticket (SendTicketMessage's only send path)
// — a Deal with no linked ticket is silently skipped, not an error.
func handlePipelineEvent(ctx context.Context, core sdk.WatinkCore, db *gorm.DB, eventType string, payload map[string]any) {
	tenantIDStr, _ := payload["tenantId"].(string)
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return
	}
	pipelineID, _ := payload["pipelineId"].(int)
	ticketID, _ := payload["ticketId"].(*int)
	if pipelineID == 0 || ticketID == nil {
		return
	}
	shortEvent := strings.TrimPrefix(eventType, "pipeline.deal.")

	var assistants []models.Assistant
	if err := db.Where(`"tenantId" = ? AND mode = ? AND active = true`, tenantID, models.AssistantModePipeline).
		Find(&assistants).Error; err != nil {
		log.Printf("[assistant] pipeline event %q: query de assistants falhou: %v", eventType, err)
		return
	}

	for _, a := range assistants {
		var cfg models.AssistantPipelineConfig
		if len(a.Config) > 0 {
			_ = json.Unmarshal(a.Config, &cfg)
		}
		if cfg.PipelineID != pipelineID || !slices.Contains(cfg.Events, shortEvent) {
			continue
		}
		if err := core.SendTicketMessage(tenantID, *ticketID, pipelineEventMessage(shortEvent)); err != nil {
			log.Printf("[assistant] envio proativo falhou (assistant %d ticket %d evento %q): %v", a.ID, *ticketID, shortEvent, err)
		}
	}
}

// pipelineEventMessage is the default proactive text per event — a fixed
// template for this issue; per-Assistant customizable templates are a
// follow-up (not requested in docs/agents/assistants.md).
func pipelineEventMessage(shortEvent string) string {
	switch shortEvent {
	case "deal_created":
		return "Seu atendimento foi registrado com sucesso e já está em andamento."
	case "stage_changed":
		return "Seu atendimento avançou para uma nova etapa."
	case "idle":
		return "Seu atendimento está parado há alguns dias — estamos verificando e retornamos em breve."
	case "closed":
		return "Seu atendimento foi finalizado. Obrigado pelo contato!"
	default:
		return "Atualização sobre o seu atendimento."
	}
}
