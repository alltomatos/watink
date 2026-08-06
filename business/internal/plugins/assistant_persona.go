package plugins

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
)

const personaHandoffMessage = "Vou transferir você para um atendente."

// executePersona runs one turn of a multi-turn RAG conversation, reusing the
// SAME Agent Runtime (flow.AgentResponder / st.Responder) the FlowBuilder's
// "agent" node already uses (business/internal/flow/agent_executor.go) —
// never a second, duplicated LLM/RAG implementation, per docs/agents/
// assistants.md and ADR 0020's "um Agent Runtime, dois pontos de entrada".
//
// KNOWN LIMITATION (tracked, not silently ignored): cfg.AiGatewayID selects
// which tenant-registered AI provider SHOULD generate the completion, but
// st.Responder (HTTPAgentClient → watink-knowledge) has no per-request
// gateway-selection parameter today — routing a specific AiGateway's
// provider/model into the watink-knowledge call requires extending that
// service's contract (a cross-service change, out of scope for this issue).
// This method still validates the configured AiGateway belongs to the tenant
// (fail-closed to handoff if not) so a dangling/foreign AiGatewayID is never
// silently accepted, but generation goes through the existing Agent Runtime
// pipeline. Follow-up: thread AiGatewayID through flow.AgentResponder.Respond
// once watink-knowledge accepts a gateway parameter.
func (r *AssistantRuntime) executePersona(ctx context.Context, st *flow.ExecState, a models.Assistant, cfg models.AssistantPersonaConfig) (flow.Outcome, error) {
	if cfg.AiGatewayID == 0 {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(persona): sem AiGateway configurado"}, nil
	}
	var gw models.AiGateway
	if err := r.db.Where(`id = ? AND "tenantId" = ?`, cfg.AiGatewayID, a.TenantID).First(&gw).Error; err != nil {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(persona): AiGateway não encontrado"}, nil
	}

	if cfg.KnowledgeBaseID == nil || *cfg.KnowledgeBaseID == 0 || st.Responder == nil {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(persona): sem base de conhecimento/responder"}, nil
	}

	query := strings.TrimSpace(st.Inbound)
	if query == "" && st.MediaType == "audio" {
		// AcceptsAudio já foi checado em Execute (recusa com mensagem fixa
		// antes de chegar aqui) — se chegamos até executePersona com uma
		// mensagem de áudio, é porque a.AcceptsAudio é true.
		transcript, err := r.transcribeInboundAudio(ctx, st, a, cfg.AiGatewayID)
		if err != nil {
			// O detail do Outcome não sobrevive no FlowRunLogs quando o nó não
			// tem edge de saída (interpreter.go sobrescreve com "no outgoing
			// edge") — logar aqui é a única forma de ver a causa real (modelo
			// ausente, chave inválida, timeout etc.) sem acesso à API key.
			log.Printf("[Assistant %d] transcricao de audio falhou (messageId=%s): %v", a.ID, st.MessageID, err)
			turn := bumpPersonaTurn(st)
			_ = flow.SendAssistantText(ctx, st, "t"+strconv.Itoa(turn), personaHandoffMessage)
			return flow.Outcome{Kind: flow.OutcomeAdvance, Handle: "handoff", Detail: "assistant(persona): falha ao transcrever áudio: " + err.Error()}, nil
		}
		query = strings.TrimSpace(transcript)
	}
	if query == "" {
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(persona): sem pergunta"}, nil
	}

	maxTurns := cfg.MaxTurns
	if maxTurns <= 0 {
		maxTurns = 10
	}

	history := loadPersonaHistory(st)
	userTurns := 0
	for _, h := range history {
		if h.Role == "user" {
			userTurns++
		}
	}
	if userTurns >= maxTurns {
		turn := bumpPersonaTurn(st)
		_ = flow.SendAssistantText(ctx, st, "t"+strconv.Itoa(turn), personaHandoffMessage)
		return flow.Outcome{Kind: flow.OutcomeAdvance, Handle: "handoff", Detail: "assistant(persona): max turns"}, nil
	}

	history = append(history, flow.AgentTurn{Role: "user", Content: query})

	reply, err := st.Responder.Respond(ctx, st.TenantID, *cfg.KnowledgeBaseID, cfg.Persona, history, query)
	if err != nil {
		turn := bumpPersonaTurn(st)
		_ = flow.SendAssistantText(ctx, st, "t"+strconv.Itoa(turn), personaHandoffMessage)
		return flow.Outcome{Kind: flow.OutcomeAdvance, Handle: "handoff", Detail: "assistant(persona): erro no responder"}, nil
	}

	// RAG fallback: the brain flagged "handoff" (no confident context) — apply
	// the Assistant's configured strategy instead of always taking the raw
	// signal at face value (default `handoff` DOES take it at face value).
	if reply.Action == "handoff" {
		switch cfg.RagFallbackBehavior {
		case models.RagFallbackGenericAnswer:
			if strings.TrimSpace(reply.Reply) != "" {
				reply.Action = "continue"
			}
			// empty reply even on generic_answer → fall through to handoff below.
		case models.RagFallbackFixedMessage:
			turn := bumpPersonaTurn(st)
			msg := reply.Reply
			if cfg.RagFallbackMessage != nil && strings.TrimSpace(*cfg.RagFallbackMessage) != "" {
				msg = *cfg.RagFallbackMessage
			}
			if err := flow.SendAssistantText(ctx, st, "t"+strconv.Itoa(turn), msg); err != nil {
				return flow.Outcome{}, err
			}
			return flow.Outcome{Kind: flow.OutcomeAdvance, Handle: "handoff", Detail: "assistant(persona): rag fallback fixed_message"}, nil
		}
		// models.RagFallbackHandoff (default) and generic_answer-with-empty-reply
		// both fall through to the standard handoff send below.
	}

	if reply.Action == "handoff" {
		turn := bumpPersonaTurn(st)
		_ = flow.SendAssistantText(ctx, st, "t"+strconv.Itoa(turn), personaHandoffMessage)
		return flow.Outcome{Kind: flow.OutcomeAdvance, Handle: "handoff", Detail: "assistant(persona): rag sem contexto"}, nil
	}

	turn := bumpPersonaTurn(st)
	if err := r.sendPersonaReply(ctx, st, a, cfg.AiGatewayID, turn, reply.Reply); err != nil {
		return flow.Outcome{}, err
	}

	history = append(history, flow.AgentTurn{Role: "assistant", Content: reply.Reply})
	savePersonaHistory(st, history)

	switch reply.Action {
	case "resolved":
		return flow.Outcome{Kind: flow.OutcomeAdvance, Detail: "assistant(persona): resolvido"}, nil
	default: // "continue"
		return flow.Outcome{Kind: flow.OutcomeSuspend, Detail: "assistant(persona): aguardando"}, nil
	}
}

const personaHistoryKey = "assistant_persona_history"
const personaTurnsKey = "assistant_persona_turns"

func loadPersonaHistory(st *flow.ExecState) []flow.AgentTurn {
	if st.Vars == nil {
		return nil
	}
	raw := st.Vars[personaHistoryKey]
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var history []flow.AgentTurn
	if err := json.Unmarshal([]byte(raw), &history); err != nil {
		return nil
	}
	return history
}

func savePersonaHistory(st *flow.ExecState, history []flow.AgentTurn) {
	if st.Vars == nil {
		st.Vars = map[string]string{}
	}
	b, err := json.Marshal(history)
	if err != nil {
		return
	}
	st.Vars[personaHistoryKey] = string(b)
}

func bumpPersonaTurn(st *flow.ExecState) int {
	if st.Vars == nil {
		st.Vars = map[string]string{}
	}
	n, _ := strconv.Atoi(st.Vars[personaTurnsKey])
	n++
	st.Vars[personaTurnsKey] = strconv.Itoa(n)
	return n
}
