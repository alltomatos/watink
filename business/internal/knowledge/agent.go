package knowledge

import (
	"context"
	"regexp"
	"strconv"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/pkg/aiclient"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var actionRe = regexp.MustCompile(`(?i)\[\[ACTION:\s*(continue|resolved|handoff)\s*\]\]`)

// GoAgentResponder implements flow.AgentResponder directly in Go, replacing
// the HTTP call to watink-knowledge's /agent/respond (app/agent.py) — same
// prompt shape, same [[ACTION:...]] control-tag protocol, same guardrails
// (answer only from context, mandatory citation, no-context → handoff), so
// this is a drop-in swap for HTTPAgentClient with zero change to
// agent_executor.go or assistant_persona.go. It uses pkg/aiclient for the chat
// call, replacing the Python service's separate llm.go (which had different
// provider defaults) — one implementation of "chat LLM for this tenant"
// instead of two.
type GoAgentResponder struct {
	db        *gorm.DB
	retriever flow.Retriever
}

func NewGoAgentResponder(db *gorm.DB, retriever flow.Retriever) *GoAgentResponder {
	return &GoAgentResponder{db: db, retriever: retriever}
}

func (a *GoAgentResponder) Respond(ctx context.Context, tenantID uuid.UUID, kbID int, persona string, history []flow.AgentTurn, query string) (flow.AgentReply, error) {
	chunks, err := a.retriever.Retrieve(ctx, tenantID, kbID, 6, agentMinScore(a.db, tenantID), query)
	if err != nil {
		// Retrieval unavailable → safe handoff, never block or hallucinate,
		// mirroring the Python service's LLMError fallback.
		return flow.AgentReply{
			Reply:      "Vou transferir você para um atendente.",
			Action:     "handoff",
			Confidence: 0,
			Citations:  nil,
		}, nil
	}

	cfg, ok := agentAIConfig(a.db, tenantID)
	if !ok {
		return flow.AgentReply{
			Reply:      "Vou transferir você para um atendente.",
			Action:     "handoff",
			Confidence: 0,
			Citations:  nil,
		}, nil
	}

	system := buildAgentSystem(persona, chunks)
	msgs := agentMessages(cfg, system, history, query)

	resp, err := aiclient.Complete(cfg, msgs)
	if err != nil || resp == nil {
		return flow.AgentReply{
			Reply:      "Vou transferir você para um atendente.",
			Action:     "handoff",
			Confidence: 0,
			Citations:  nil,
		}, nil
	}

	action, reply := parseAgentAction(resp.Content)

	if len(chunks) == 0 {
		action = "handoff"
	}
	if strings.TrimSpace(reply) == "" {
		reply = "Desculpe, não consegui responder. Vou transferir para um atendente."
		action = "handoff"
	}
	if len(chunks) > 0 && action != "handoff" && !strings.Contains(strings.ToLower(reply), "[fonte:") {
		reply += "\n[Fonte: " + chunks[0].Citation + "]"
	}

	citations := make([]int, len(chunks))
	confidence := 0.0
	if len(chunks) > 0 {
		confidence = 1.0
	}
	for i, c := range chunks {
		citations[i] = c.SourceID
	}

	return flow.AgentReply{Reply: reply, Action: action, Confidence: confidence, Citations: citations}, nil
}

// buildAgentSystem mirrors agent.py's _build_system: persona (or a default)
// plus the fixed guardrail rules plus the retrieved context.
func buildAgentSystem(persona string, chunks []flow.RetrievedChunk) string {
	base := strings.TrimSpace(persona)
	if base == "" {
		base = "Você é um assistente de atendimento prestativo e objetivo."
	}

	var contextBuilder strings.Builder
	for i, c := range chunks {
		if i > 0 {
			contextBuilder.WriteString("\n\n---\n\n")
		}
		contextBuilder.WriteString(c.Text)
		contextBuilder.WriteString("\n[Fonte: ")
		contextBuilder.WriteString(c.Citation)
		contextBuilder.WriteString("]")
	}
	context := contextBuilder.String()
	if context == "" {
		context = "(vazio — sem informação na base)"
	}

	return base + "\n\nRegras:\n" +
		"- Responda SOMENTE com base no CONTEXTO abaixo e cite a fonte ([Fonte: ...]).\n" +
		"- Se o contexto não cobre a pergunta, NÃO invente — diga que vai transferir para um atendente.\n" +
		"- Ao FINAL da resposta, emita UMA tag de controle em linha separada (ela NÃO é vista pelo usuário):\n" +
		"  [[ACTION:continue]] se o diálogo continua (você perguntou algo ou aguarda resposta);\n" +
		"  [[ACTION:resolved]] se a dúvida foi resolvida e o atendimento pode encerrar;\n" +
		"  [[ACTION:handoff]] se precisa de atendente humano (fora do contexto, pedido explícito, frustração).\n\n" +
		"CONTEXTO:\n" + context
}

// agentMessages assembles the message list: system + history + the current
// query (skipped if it's already the last history turn, same dedup agent.py
// applied). Anthropic keeps system out of the messages list, like aiclient's
// other callers.
func agentMessages(cfg aiclient.Config, system string, history []flow.AgentTurn, query string) []aiclient.Message {
	cfg.System = system
	var msgs []aiclient.Message
	if cfg.Provider != "anthropic" {
		msgs = append(msgs, aiclient.Message{Role: "system", Content: system})
	}
	for _, turn := range history {
		role := turn.Role
		if role != "user" && role != "assistant" {
			role = "user"
		}
		msgs = append(msgs, aiclient.Message{Role: role, Content: turn.Content})
	}
	if len(history) == 0 || history[len(history)-1].Content != query {
		msgs = append(msgs, aiclient.Message{Role: "user", Content: query})
	}
	return msgs
}

func parseAgentAction(raw string) (action, reply string) {
	match := actionRe.FindStringSubmatch(raw)
	action = "continue"
	if match != nil {
		action = strings.ToLower(match[1])
	}
	reply = strings.TrimSpace(actionRe.ReplaceAllString(raw, ""))
	return action, reply
}

const defaultAgentMinScore = 0.2

// agentMinScore mirrors knowledgeMinScore in flow/knowledge_executor.go — kept
// as a separate read here because internal/knowledge cannot import
// internal/flow's unexported helper (and shouldn't: the agent and the
// single-turn knowledge node are reasonably independent tuning knobs even
// though they default to the same value today).
func agentMinScore(db *gorm.DB, tenantID uuid.UUID) float64 {
	if db == nil {
		return defaultAgentMinScore
	}
	var setting struct{ Value string }
	if err := db.Table("Settings").Select("value").
		Where(`"tenantId" = ? AND key = ?`, tenantID, "aiKnowledgeMinScore").
		Scan(&setting).Error; err == nil && setting.Value != "" {
		if v, err := strconv.ParseFloat(strings.TrimSpace(setting.Value), 64); err == nil && v >= 0 && v <= 1 {
			return v
		}
	}
	return defaultAgentMinScore
}

// agentAIConfig loads the tenant's chat LLM config the same way
// knowledgeAIConfig does in flow/knowledge_executor.go.
func agentAIConfig(db *gorm.DB, tenantID uuid.UUID) (aiclient.Config, bool) {
	if db == nil {
		return aiclient.Config{}, false
	}

	type kv struct {
		Key   string
		Value string
	}
	var rows []kv
	db.Table("Settings").Select("key, value").
		Where(`"tenantId" = ? AND key IN ?`, tenantID, []string{"aiProvider", "aiModel", "aiApiKey", "aiCustomBaseURL"}).
		Scan(&rows)

	m := make(map[string]string, len(rows))
	for _, r := range rows {
		m[r.Key] = r.Value
	}

	apiKey := strings.TrimSpace(m["aiApiKey"])
	if apiKey == "" {
		return aiclient.Config{}, false
	}
	provider := m["aiProvider"]
	if provider == "" {
		provider = "openai"
	}
	if provider == "custom" && strings.TrimSpace(m["aiCustomBaseURL"]) == "" {
		return aiclient.Config{}, false
	}

	return aiclient.Config{
		Provider: provider,
		Model:    m["aiModel"],
		APIKey:   apiKey,
		BaseURL:  m["aiCustomBaseURL"],
	}, true
}
