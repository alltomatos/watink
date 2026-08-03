package flow

import (
	"context"

	"github.com/google/uuid"
)

// AgentTurn is one entry of the conversation history sent to the agent brain.
type AgentTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// AgentReply is the decoded answer from the agent brain: the text to send back,
// the control action (continue/resolved/handoff), the model's confidence and the
// source citations that grounded the reply.
type AgentReply struct {
	Reply      string  `json:"reply"`
	Action     string  `json:"action"`
	Confidence float64 `json:"confidence"`
	Citations  []int   `json:"citations"`
}

// AgentResponder is the port the agent node/Assistants persona mode depends
// on. internal/knowledge.GoAgentResponder is the native in-process
// implementation; tests inject a fake.
type AgentResponder interface {
	Respond(ctx context.Context, tenantID uuid.UUID, kbID int, persona string, history []AgentTurn, query string) (AgentReply, error)
}
