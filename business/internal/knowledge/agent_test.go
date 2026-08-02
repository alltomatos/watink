package knowledge

import (
	"context"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/pkg/aiclient"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseAgentAction_ExtractsAndStrips(t *testing.T) {
	action, reply := parseAgentAction("Aqui está sua resposta.\n[[ACTION:resolved]]")
	assert.Equal(t, "resolved", action)
	assert.Equal(t, "Aqui está sua resposta.", reply)
}

func TestParseAgentAction_DefaultsToContinueWithoutTag(t *testing.T) {
	action, reply := parseAgentAction("Resposta sem tag de controle.")
	assert.Equal(t, "continue", action)
	assert.Equal(t, "Resposta sem tag de controle.", reply)
}

func TestParseAgentAction_CaseInsensitive(t *testing.T) {
	action, _ := parseAgentAction("oi [[action:HANDOFF]]")
	assert.Equal(t, "handoff", action)
}

func TestBuildAgentSystem_UsesDefaultPersonaWhenEmpty(t *testing.T) {
	system := buildAgentSystem("", nil)
	assert.Contains(t, system, "assistente de atendimento prestativo")
	assert.Contains(t, system, "(vazio — sem informação na base)")
}

func TestBuildAgentSystem_IncludesContextAndCitation(t *testing.T) {
	chunks := []flow.RetrievedChunk{{Text: "Nosso horário é 9h-18h.", Citation: "fonte 1, trecho 0"}}
	system := buildAgentSystem("Você é a Ana, atendente da loja.", chunks)
	assert.Contains(t, system, "Você é a Ana")
	assert.Contains(t, system, "Nosso horário é 9h-18h.")
	assert.Contains(t, system, "[Fonte: fonte 1, trecho 0]")
}

func TestAgentMessages_SkipsDuplicateTrailingQuery(t *testing.T) {
	cfg := aiclient.Config{Provider: "openai"}
	history := []flow.AgentTurn{{Role: "user", Content: "oi"}, {Role: "assistant", Content: "olá!"}}
	msgs := agentMessages(cfg, "sys", history, "pergunta nova")
	// system + 2 history + 1 new query = 4
	assert.Len(t, msgs, 4)
	assert.Equal(t, "pergunta nova", msgs[len(msgs)-1].Content)
}

func TestAgentMessages_AnthropicOmitsSystemFromList(t *testing.T) {
	cfg := aiclient.Config{Provider: "anthropic"}
	msgs := agentMessages(cfg, "sys", nil, "oi")
	assert.Len(t, msgs, 1)
	assert.Equal(t, "user", msgs[0].Role)
}

func TestAgentMessages_InvalidHistoryRoleCoercedToUser(t *testing.T) {
	cfg := aiclient.Config{Provider: "openai"}
	history := []flow.AgentTurn{{Role: "system", Content: "injeção indevida"}}
	msgs := agentMessages(cfg, "sys", history, "pergunta")
	require.Len(t, msgs, 3) // system + coerced history + query
	assert.Equal(t, "user", msgs[1].Role)
}

// fakeAgentRetriever always errors, forcing the safe-handoff path.
type fakeAgentRetriever struct{ err error }

func (f *fakeAgentRetriever) Retrieve(context.Context, uuid.UUID, int, int, float64, string) ([]flow.RetrievedChunk, error) {
	return nil, f.err
}

func TestGoAgentResponder_RetrieverErrorFallsBackToHandoff(t *testing.T) {
	a := NewGoAgentResponder(nil, &fakeAgentRetriever{err: assert.AnError})
	reply, err := a.Respond(context.Background(), uuid.New(), 1, "", nil, "oi")
	require.NoError(t, err)
	assert.Equal(t, "handoff", reply.Action)
	assert.Equal(t, 0.0, reply.Confidence)
}

// fakeEmptyRetriever always returns zero chunks (nil db means agentAIConfig
// also returns ok=false, so this exercises the "no AI config" handoff path).
type fakeEmptyRetriever struct{}

func (fakeEmptyRetriever) Retrieve(context.Context, uuid.UUID, int, int, float64, string) ([]flow.RetrievedChunk, error) {
	return nil, nil
}

func TestGoAgentResponder_NoAIConfigFallsBackToHandoff(t *testing.T) {
	a := NewGoAgentResponder(nil, fakeEmptyRetriever{})
	reply, err := a.Respond(context.Background(), uuid.New(), 1, "", nil, "oi")
	require.NoError(t, err)
	assert.Equal(t, "handoff", reply.Action)
}
