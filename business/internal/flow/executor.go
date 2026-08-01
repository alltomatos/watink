package flow

import (
	"context"
	"fmt"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// OutcomeKind tells the interpreter what to do after a node executes.
type OutcomeKind int

const (
	// OutcomeAdvance: follow the outgoing edge (optionally via Handle) to the
	// next node and keep executing in the same pass.
	OutcomeAdvance OutcomeKind = iota
	// OutcomeSuspend: stop the pass and persist the run as WaitStatus (e.g.
	// waiting_message) at this node, to be resumed by a later inbound/event.
	OutcomeSuspend
	// OutcomeEnd: terminate the run (completed).
	OutcomeEnd
)

// Outcome is the result of executing a single node.
type Outcome struct {
	Kind OutcomeKind

	// Handle is the sourceHandle to follow when advancing/branching. Empty means
	// "the (single) default outgoing edge". For menu/switch it selects a branch.
	Handle string

	// WaitStatus is the FlowRunStatus* to persist when Kind==OutcomeSuspend
	// (defaults to waiting_message when empty).
	WaitStatus string

	// Detail is a human-readable note for the FlowRunLog (matched option, etc.).
	Detail string
}

// ExecState is the mutable context threaded through one interpreter pass. It is
// NOT shared across runs — the interpreter builds a fresh state per resume.
type ExecState struct {
	TenantID uuid.UUID
	Run      *models.FlowRun
	Graph    FlowGraph

	// Vars is the interpolable variable map (contact_name, ticket_id, ...). It is
	// seeded from the run + ticket/contact and persisted back into Run.Vars.
	Vars map[string]string

	// Inbound is the body of the message that triggered/resumed this pass. Empty
	// on a fresh trigger-start with no carried body. Stays available for the
	// whole pass so a switch can evaluate lastInput; the menu uses ResumeNodeID
	// (not Inbound presence) to tell a reply from a first presentation.
	Inbound string

	// ResumeNodeID is the node a resumed run was suspended at — the ONLY node
	// that should interpret Inbound as its reply (e.g. a menu selection). Empty
	// on a fresh trigger-start. Prevents a downstream menu reached in the same
	// pass from wrongly consuming the inbound as its own answer.
	ResumeNodeID string

	// Ticket / Contact bind the run to the conversation (read-only here).
	Ticket  *domain.Ticket
	Contact *domain.Contact

	Registry *ChannelRegistry

	// DB is used for the ticket-handoff executor (manual WHERE "tenantId",
	// writes in Session(NewDB)). Read-only for everything else.
	DB *gorm.DB

	// Retriever resolves knowledge-base context for the knowledge node. Nil when
	// no knowledge service is wired (the knowledge executor then advances).
	Retriever Retriever

	// Responder drives the agent node: a multi-turn RAG agent that answers from a
	// knowledge base and decides continue/resolved/handoff. Nil when no agent
	// service is wired (the agent executor then advances).
	Responder AgentResponder

	// AssistantRuntime drives the synthetic "assistant" node — implemented by
	// the "Assistentes de IA" plugin, injected to avoid a flow↔plugins import
	// cycle (ADR 0027). Nil when the plugin isn't wired (the assistant
	// executor then advances).
	AssistantRuntime AssistantRuntime

	// Starter lets AssistantRuntime hand off from this run to another Flow's
	// FlowRun for the same ticket (router delegation, "flow" mode). Always the
	// owning Skeleton in production.
	Starter FlowStarter
}

// NodeExecutor runs a single node type. Implementations are stateless and
// resolved from the registry by Type(); per-run state lives in ExecState.
type NodeExecutor interface {
	Type() string
	Execute(ctx context.Context, st *ExecState, node Node) (Outcome, error)
}

// ExecutorRegistry dispatches a Node to its NodeExecutor by node.type. Built via
// DI (no global) — tests register fakes without touching package state.
type ExecutorRegistry struct {
	executors map[string]NodeExecutor
}

// NewExecutorRegistry returns an empty executor registry.
func NewExecutorRegistry() *ExecutorRegistry {
	return &ExecutorRegistry{executors: make(map[string]NodeExecutor)}
}

// Register adds an executor under its Type() key (later wins — test override).
func (r *ExecutorRegistry) Register(e NodeExecutor) {
	if e == nil {
		return
	}
	r.executors[e.Type()] = e
}

// Get returns the executor for a node type, or (nil,false).
func (r *ExecutorRegistry) Get(nodeType string) (NodeExecutor, bool) {
	e, ok := r.executors[nodeType]
	return e, ok
}

// MustGet returns the executor for a node type or an error when none is
// registered. A missing executor is a run error, never a silent skip.
func (r *ExecutorRegistry) MustGet(nodeType string) (NodeExecutor, error) {
	e, ok := r.Get(nodeType)
	if !ok {
		return nil, fmt.Errorf("no executor registered for node type %q", nodeType)
	}
	return e, nil
}

// registerAs registers e under each of the given node-type aliases (the canvas
// seeds start/input and end/output as alias pairs — see contract.go).
func (r *ExecutorRegistry) registerAs(e NodeExecutor, aliases ...string) {
	for _, a := range aliases {
		r.executors[a] = e
	}
}

// DefaultExecutorRegistry builds the registry wired with all FASE 1 executors.
// The "whatsapp" outbound is resolved at execute-time from the ChannelRegistry
// inside ExecState, so this needs no adapter here.
func DefaultExecutorRegistry() *ExecutorRegistry {
	r := NewExecutorRegistry()
	r.registerAs(startExecutor{}, string(NodeStart), string(NodeInput), string(NodeTrigger))
	r.registerAs(endExecutor{}, string(NodeEnd), string(NodeOutput))
	r.Register(messageExecutor{})
	r.Register(menuExecutor{})
	r.Register(switchExecutor{})
	r.Register(ticketExecutor{})
	r.Register(knowledgeExecutor{})
	r.Register(agentExecutor{})
	r.Register(quickAnswerExecutor{})
	r.Register(assistantExecutor{})
	return r
}

// UnsupportedNodeTypes returns the DISTINCT node.types present in the graph that
// have no registered executor in the default registry — i.e. nodes the engine
// cannot execute, which would abort the run at runtime (interpreter MustGet).
//
// Used by the activation guard: a flow must not be ACTIVATED while it contains a
// node the engine can't run, or it would break silently in production. Order
// follows first appearance for a stable, user-facing message.
func UnsupportedNodeTypes(graph FlowGraph) []string {
	r := DefaultExecutorRegistry()
	seen := make(map[string]struct{})
	var out []string
	for _, n := range graph.Nodes {
		if _, ok := r.Get(n.Type); ok {
			continue
		}
		if _, dup := seen[n.Type]; dup {
			continue
		}
		seen[n.Type] = struct{}{}
		out = append(out, n.Type)
	}
	return out
}
