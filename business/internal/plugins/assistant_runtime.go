package plugins

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"gorm.io/gorm"
)

// AssistantRuntime implements flow.AssistantRuntime — the dispatch-by-Mode
// brain behind every synthetic Assistant Flow's "assistant" node (ADR 0027).
// Injected into flow.Skeleton via SetAssistantRuntime, never imports
// controllers/routes — DI pura.
type AssistantRuntime struct {
	db *gorm.DB
}

func NewAssistantRuntime(db *gorm.DB) *AssistantRuntime {
	return &AssistantRuntime{db: db}
}

// Execute loads the Assistant and dispatches per Mode. A missing/inactive
// Assistant or an unimplemented Mode degrades gracefully (advance) — mirrors
// agentExecutor/knowledgeExecutor's posture: never abort the run.
func (r *AssistantRuntime) Execute(ctx context.Context, st *flow.ExecState, assistantID int) (flow.Outcome, error) {
	var a models.Assistant
	if err := r.db.Where(`id = ? AND "tenantId" = ?`, assistantID, st.TenantID).First(&a).Error; err != nil {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant: não encontrado"}, nil
	}
	if !a.Active {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant: inativo"}, nil
	}
	// IgnoreGroups was persisted (Create/Update) and shown in the UI toggle
	// but never enforced anywhere in the dispatch path — found live in
	// homolog: an Assistant with ignoreGroups=true kept answering real
	// WhatsApp group messages. Checked once here, at the single entry point
	// every Mode (persona/pipeline/flow/router) funnels through, so no mode
	// can bypass it individually.
	if a.IgnoreGroups && st.Contact != nil && st.Contact.IsGroup {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant: ignora grupos"}, nil
	}

	switch a.Mode {
	case models.AssistantModeFlow:
		return r.executeFlow(ctx, st, a)
	case models.AssistantModeRouter:
		return r.executeRouter(ctx, st, a)
	case models.AssistantModePersona:
		var cfg models.AssistantPersonaConfig
		if len(a.Config) > 0 {
			_ = json.Unmarshal(a.Config, &cfg)
		}
		return r.executePersona(ctx, st, a, cfg)
	case models.AssistantModePipeline:
		var cfg models.AssistantPipelineConfig
		if len(a.Config) > 0 {
			_ = json.Unmarshal(a.Config, &cfg)
		}
		return r.executePipeline(ctx, st, a, cfg)
	default:
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant: modo desconhecido"}, nil
	}
}

// executePipeline handles an INBOUND message on a pipeline-mode Assistant's
// connection (proactive pushes go through handlePipelineEvent/
// sweepIdleDeals instead — those never touch the FlowBuilder runtime). When
// RespondsAfterProactive is off, the Assistant is notification-only: any
// reply from the contact falls through to the human queue (advance, no
// conversational handling here). When on, it reuses the SAME persona
// pipeline (executePersona) with the config's embedded persona fields.
func (r *AssistantRuntime) executePipeline(ctx context.Context, st *flow.ExecState, a models.Assistant, cfg models.AssistantPipelineConfig) (flow.Outcome, error) {
	if !cfg.RespondsAfterProactive {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(pipeline): notificação apenas, sem resposta ativa"}, nil
	}
	personaCfg := models.AssistantPersonaConfig{
		Persona: cfg.Persona, KnowledgeBaseID: cfg.KnowledgeBaseID, MaxTurns: cfg.MaxTurns,
		AiGatewayID: cfg.AiGatewayID, RagFallbackBehavior: cfg.RagFallbackBehavior,
		RagFallbackMessage: cfg.RagFallbackMessage,
	}
	return r.executePersona(ctx, st, a, personaCfg)
}

// executeFlow delegates the conversation 100% to the configured Flow —
// starts its FlowRun for the same ticket and ends this synthetic run (the
// target Flow now owns subsequent turns, "sessão manda").
func (r *AssistantRuntime) executeFlow(ctx context.Context, st *flow.ExecState, a models.Assistant) (flow.Outcome, error) {
	var cfg models.AssistantFlowConfig
	if len(a.Config) > 0 {
		_ = json.Unmarshal(a.Config, &cfg)
	}
	if cfg.FlowID == 0 || st.Starter == nil {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(flow): config inválida"}, nil
	}
	var target models.Flow
	if err := r.db.Where(`id = ? AND "tenantId" = ?`, cfg.FlowID, a.TenantID).First(&target).Error; err != nil {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(flow): flow não encontrado"}, nil
	}
	if err := r.delegateTo(ctx, st, target); err != nil {
		return flow.Outcome{}, err
	}
	return flow.Outcome{Kind: flow.OutcomeEnd, Detail: "assistant(flow): delegado ao flow " + strconv.Itoa(target.ID)}, nil
}

// executeRouter presents a numbered menu on first entry, then matches the
// reply against AssistantRouterOptions (numeric position or case-insensitive
// label substring) and, on match, delegates to the TARGET's own synthetic
// Flow — this works uniformly regardless of the target's Mode, since every
// Assistant (whatever its mode) is reachable through its synthetic Flow.
func (r *AssistantRuntime) executeRouter(ctx context.Context, st *flow.ExecState, a models.Assistant) (flow.Outcome, error) {
	var options []models.AssistantRouterOption
	if err := r.db.Where(`"routerAssistantId" = ? AND "tenantId" = ?`, a.ID, a.TenantID).
		Order(`"order" ASC`).Find(&options).Error; err != nil {
		return flow.Outcome{}, err
	}
	if len(options) == 0 {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(router): sem opções cadastradas"}, nil
	}

	// Fresh trigger (not a resume of THIS node) → present the menu and wait.
	if st.ResumeNodeID == "" {
		if err := flow.SendAssistantText(ctx, st, "menu", buildRouterMenu(options)); err != nil {
			return flow.Outcome{}, err
		}
		return flow.Outcome{Kind: flow.OutcomeSuspend, Detail: "assistant(router): aguardando escolha"}, nil
	}

	chosen := matchRouterOption(options, st.Inbound)
	if chosen == nil {
		turn := bumpRouterTurn(st)
		msg := "Não entendi sua escolha. " + buildRouterMenu(options)
		if err := flow.SendAssistantText(ctx, st, "retry-t"+strconv.Itoa(turn), msg); err != nil {
			return flow.Outcome{}, err
		}
		return flow.Outcome{Kind: flow.OutcomeSuspend, Detail: "assistant(router): escolha inválida"}, nil
	}

	var target models.Flow
	if err := r.db.Where(`"tenantId" = ? AND name = ? AND internal = true`, a.TenantID, syntheticFlowName(chosen.TargetAssistantID)).
		First(&target).Error; err != nil {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(router): assistant de destino sem flow sintético"}, nil
	}
	if err := r.delegateTo(ctx, st, target); err != nil {
		return flow.Outcome{}, err
	}
	return flow.Outcome{Kind: flow.OutcomeEnd, Detail: "assistant(router): roteado para assistant " + strconv.Itoa(chosen.TargetAssistantID)}, nil
}

// delegateTo starts the target Flow's FlowRun for the same ticket/contact
// that drove the current pass — the hand-off primitive shared by "flow" mode
// and router delegation.
func (r *AssistantRuntime) delegateTo(ctx context.Context, st *flow.ExecState, target models.Flow) error {
	in := flow.InboundContext{
		TenantID: st.TenantID,
		Body:     st.Inbound,
		Ticket:   st.Ticket,
		Contact:  st.Contact,
	}
	return st.Starter.StartFlow(ctx, in, target)
}

func buildRouterMenu(options []models.AssistantRouterOption) string {
	var b strings.Builder
	b.WriteString("Escolha uma opção:\n")
	for i, o := range options {
		b.WriteString(strconv.Itoa(i+1) + ". " + o.Label + "\n")
	}
	return strings.TrimRight(b.String(), "\n")
}

// matchRouterOption resolves the user's reply to an option by 1-based numeric
// position first, then by case-insensitive label substring — nil when
// neither matches.
func matchRouterOption(options []models.AssistantRouterOption, reply string) *models.AssistantRouterOption {
	trimmed := strings.TrimSpace(reply)
	if n, err := strconv.Atoi(trimmed); err == nil {
		if n >= 1 && n <= len(options) {
			return &options[n-1]
		}
	}
	lower := strings.ToLower(trimmed)
	if lower == "" {
		return nil
	}
	for i := range options {
		if strings.Contains(strings.ToLower(options[i].Label), lower) {
			return &options[i]
		}
	}
	return nil
}

func bumpRouterTurn(st *flow.ExecState) int {
	if st.Vars == nil {
		st.Vars = map[string]string{}
	}
	const key = "assistant_router_turns"
	n, _ := strconv.Atoi(st.Vars[key])
	n++
	st.Vars[key] = strconv.Itoa(n)
	return n
}
