package flow

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// runTTL is how long a started run may stay alive before the expire sweep
// reaps it (orphan cleanup; a stalled waiting_message run is not eternal).
const runTTL = 24 * time.Hour

// flowTicketLockTTL bounds the per-ticket single-flight lock around the
// resume/start critical section (H2). Short so a crashed worker that never
// releases it does not wedge the ticket for long; long enough to cover a normal
// synchronous interpreter pass.
const flowTicketLockTTL = 30 * time.Second

// optOutWords abort an active run unconditionally, with precedence over
// everything else (case-insensitive, exact match after trim).
var optOutWords = map[string]struct{}{
	"parar": {}, "stop": {}, "sair": {},
}

// Skeleton is the inbound runtime entrypoint. From FASE 1 it does real work:
// resume-first dispatch of an active run, opt-out abort, and trigger→StartFlow.
//
// Tenant isolation: RLS is INERT in this path (the app never sets
// app.current_tenant), so every query carries WHERE "tenantId" MANUALLY and
// writes use Session(NewDB:true).
type Skeleton struct {
	db               *gorm.DB
	registry         *ChannelRegistry
	redis            domain.RedisService
	interpreter      *Interpreter
	retriever        Retriever
	responder        AgentResponder
	assistantRuntime AssistantRuntime
}

// SetRetriever wires the RAG retriever (internal/knowledge.PgVectorRetriever,
// built in main.go via knowledge.BuildRetrieverAndResponder) after
// construction — flow doesn't import internal/knowledge directly (it would
// cycle back, since knowledge already imports flow), so NewSkeleton starts
// with a nil retriever and every real construction site sets it right after.
// A nil argument is a no-op, so callers can pass through an optional override
// freely; consumers (agent/knowledge executors) already nil-check before use.
func (s *Skeleton) SetRetriever(r Retriever) {
	if r != nil {
		s.retriever = r
	}
}

// SetResponder wires the Agent Runtime responder after construction — same
// pattern as SetRetriever, for the agent node/Assistants persona mode. A nil
// argument is a no-op.
func (s *Skeleton) SetResponder(r AgentResponder) {
	if r != nil {
		s.responder = r
	}
}

// SetAssistantRuntime wires the "Assistentes de IA" plugin's runtime after
// construction (the plugin manager, which owns the implementation, is built
// after the Skeleton in routes.go — DI pura, no global). Nil is the default
// (no plugin active): the assistant executor then advances gracefully.
func (s *Skeleton) SetAssistantRuntime(ar AssistantRuntime) {
	s.assistantRuntime = ar
}

// NewSkeleton builds the skeleton with an injected DB, the outbound channel
// registry and Redis (DI pura — no global). It wires the interpreter with the
// default executor set so the inbound seam can drive node execution. Redis is
// used to dedup inbound redeliveries before advancing a run.
func NewSkeleton(db *gorm.DB, registry *ChannelRegistry, redis domain.RedisService) *Skeleton {
	var ip *Interpreter
	if db != nil {
		ip = NewInterpreter(DefaultExecutorRegistry(), registry, db)
	}
	return &Skeleton{db: db, registry: registry, redis: redis, interpreter: ip}
}

// InboundContext carries everything the runtime needs to resume/start a run for
// one inbound message. EnvID is the inbound message id (used for redelivery
// dedup); Ticket/Contact bind the run to the conversation.
type InboundContext struct {
	TenantID uuid.UUID
	Body     string
	FromMe   bool
	EnvID    string
	Ticket   *domain.Ticket
	Contact  *domain.Contact
	// MentionedJIDs carries the @-mentioned JIDs from the WhatsApp message
	// (engine-go's extractMentionedJIDs), threaded through to ExecState so
	// an Assistant configured to only respond when mentioned in a group can
	// tell a direct mention apart from ambient group chatter.
	MentionedJIDs []string
}

// RouteInbound is the legacy (no-ticket) trigger-match + log path, preserved for
// the inbound seam when no ticket context is available. It never starts a run.
func (s *Skeleton) RouteInbound(ctx context.Context, tenantID uuid.UUID, body string, fromMe bool) {
	if fromMe || s == nil || s.db == nil {
		return
	}
	for _, f := range s.matchTriggers(ctx, tenantID, body, 0) {
		log.Printf("[FlowSkeleton] flow %d roteado para tenant %s (trigger=%q)", f.ID, tenantID, f.TriggerValue)
	}
}

// RouteInboundTicket is the FASE 1 dispatcher. Precedence:
//  1. opt-out (PARAR/STOP/SAIR) → abort any active run, stop.
//  2. resume-first → an active waiting_message run for (tenant,ticket) resumes
//     with the body (session-manda: an active run ignores new triggers).
//  3. trigger-match → StartFlow on the first matching active flow.
//
// fromMe and a nil db/ticket are tolerated (no-op).
func (s *Skeleton) RouteInboundTicket(ctx context.Context, in InboundContext) {
	if s == nil || s.db == nil || in.FromMe || in.Ticket == nil {
		return
	}

	body := strings.TrimSpace(in.Body)

	// 1. Opt-out has precedence over everything (even a redelivery must abort).
	if _, ok := optOutWords[strings.ToLower(body)]; ok {
		if s.abortActiveRun(ctx, in.TenantID, in.Ticket.ID) {
			log.Printf("[FlowSkeleton] opt-out: aborted active run for tenant %s ticket %d", in.TenantID, in.Ticket.ID)
		}
		return
	}

	// H2: serialize the resume/start critical section per ticket. Two concurrent
	// deliveries for the same ticket would otherwise (a) resume the same run twice
	// via a read-modify-write race, or (b) both find "no active run" and start two
	// FlowRuns. A short-TTL per-ticket lock makes the section single-flight; if we
	// fail to acquire it, another delivery is processing right now → return and let
	// AMQP redeliver (the redelivery re-acquires once the other finishes).
	if s.redis != nil {
		ticketLock := fmt.Sprintf("wbot:flowlock:%s:%d", in.TenantID, in.Ticket.ID)
		acquired, err := s.redis.SetLock(ticketLock, "1", flowTicketLockTTL)
		if err != nil {
			// Fail-closed on a lock backend error: without serialization we risk
			// double-start/double-advance, so drop this delivery and let AMQP retry.
			log.Printf("[FlowSkeleton] ticket lock backend error (tenant %s ticket %d): %v — dropping for redelivery", in.TenantID, in.Ticket.ID, err)
			return
		}
		if !acquired {
			return
		}
		defer func() {
			if delErr := s.redis.DelLock(ticketLock); delErr != nil {
				log.Printf("[FlowSkeleton] ticket lock release failed (tenant %s ticket %d): %v", in.TenantID, in.Ticket.ID, delErr)
			}
		}()
	}

	// FB1-W2: dedup the inbound by message id BEFORE advancing a run, so an AMQP
	// redelivery of the same message never advances the run twice. SetLock is
	// SetNX → false means we already processed this inbound. On a Redis error we
	// log and proceed (the per-ticket lock above already bounds the blast radius).
	if s.redis != nil && in.EnvID != "" {
		acquired, err := s.redis.SetLock("wbot:flowin:"+in.EnvID, "1", runTTL)
		if err != nil {
			log.Printf("[FlowSkeleton] inbound dedup lock error (tenant %s env %s): %v — proceeding", in.TenantID, in.EnvID, err)
		} else if !acquired {
			return
		}
	}

	// 2. Resume-first: an active waiting run takes the inbound (session-manda).
	if run, ok := s.activeRun(ctx, in.TenantID, in.Ticket.ID); ok {
		s.resume(ctx, in, run)
		return
	}

	// 3. No active run → match triggers and start the first one.
	matches := s.matchTriggers(ctx, in.TenantID, in.Body, in.Ticket.WhatsappID)
	if len(matches) == 0 {
		return
	}
	if err := s.StartFlow(ctx, in, matches[0]); err != nil {
		log.Printf("[FlowSkeleton] StartFlow failed (tenant %s flow %d): %v", in.TenantID, matches[0].ID, err)
	}
}

// matchTriggers returns ACTIVE flows whose projected trigger matches the body.
// A keyword flow (non-empty triggerValue) matches case-insensitively exact; an
// "any message" flow (empty triggerValue with type whatsapp_message) matches any
// non-empty body. Tenant-scoped MANUALLY ("tenantId").
//
// GAP (M4 — FASE posterior): only whatsapp_message flows are matched here.
// whatsapp_first_contact flows ARE projected by trigger.go but never fire,
// because the skeleton has no "is this the contact's first message ever?" signal
// in this seam (it would need new-contact/new-ticket detection upstream). Until
// that lands, a firstContact flow is silently inert — so we emit a one-line
// warning when one exists for the tenant, to make the gap observable instead of a
// mystery "my flow never runs".
func (s *Skeleton) matchTriggers(ctx context.Context, tenantID uuid.UUID, body string, connectionID int) []models.Flow {
	normalized := strings.TrimSpace(strings.ToLower(body))

	var candidates []models.Flow
	q := s.db.WithContext(ctx).
		Where(`"tenantId" = ? AND active = ? AND "triggerType" = ?`, tenantID, true, TriggerWhatsAppMessage)
	// Connection-scoped triggers: a flow bound to a connection ("whatsappId" set)
	// only fires for inbound on THAT connection; an unbound flow (NULL "whatsappId")
	// fires for any connection. This is what makes an "agent bound to a connection"
	// possible (an "any message" flow with whatsappId=X → all inbound on X is the
	// agent's). connectionID<=0 (legacy no-ticket path) skips the filter.
	if connectionID > 0 {
		q = q.Where(`("whatsappId" IS NULL OR "whatsappId" = ?)`, connectionID)
	}
	if err := q.Find(&candidates).Error; err != nil {
		log.Printf("[FlowSkeleton] trigger match query failed for tenant %s: %v", tenantID, err)
		return nil
	}

	// Matched in Go (not SQL) so the operator set (contains/starts_with/
	// ends_with/regex) can grow without hand-rolled dynamic SQL per operator.
	// Dataset per tenant is small (dozens of flows), so this is not a hot path.
	flows := make([]models.Flow, 0, len(candidates))
	for _, f := range candidates {
		if f.TriggerValue == "" || matchesTriggerValue(f.TriggerOperator, f.TriggerValue, normalized) {
			flows = append(flows, f)
		}
	}

	s.warnFirstContactGap(ctx, tenantID)
	return flows
}

// matchesTriggerValue applies the Flow's keyword operator against the
// already-trimmed-lowercased inbound body. An empty/unrecognized operator is
// "equals" — the historical (pre-operator) behavior, preserved so existing
// Flows keep matching exactly as before. regex matches the lowercased body
// against the lowercased pattern (a known limitation for patterns relying on
// case-sensitive classes — documented in ValidTriggerOperators).
func matchesTriggerValue(operator, value, normalizedBody string) bool {
	v := strings.ToLower(strings.TrimSpace(value))
	switch operator {
	case "contains":
		return strings.Contains(normalizedBody, v)
	case "starts_with":
		return strings.HasPrefix(normalizedBody, v)
	case "ends_with":
		return strings.HasSuffix(normalizedBody, v)
	case "regex":
		re, err := regexp.Compile(v)
		if err != nil {
			return false
		}
		return re.MatchString(normalizedBody)
	default: // "equals", ""
		return normalizedBody == v
	}
}

// warnFirstContactGap logs (best-effort) when the tenant has an active
// firstContact flow that the current seam cannot match (M4). Detection of the
// actual first-contact event is a later phase; this just surfaces the gap.
func (s *Skeleton) warnFirstContactGap(ctx context.Context, tenantID uuid.UUID) {
	var n int64
	if err := s.db.WithContext(ctx).
		Model(&models.Flow{}).
		Where(`"tenantId" = ? AND active = ? AND "triggerType" = ?`,
			tenantID, true, TriggerWhatsAppFirstContact).
		Count(&n).Error; err == nil && n > 0 {
		log.Printf("[FlowSkeleton] WARN: tenant %s has %d active firstContact flow(s) that are NOT matched yet (M4 gap — first-contact detection is a later phase)", tenantID, n)
	}
}

// activeRun returns the single active waiting_message run for (tenant,ticket).
func (s *Skeleton) activeRun(ctx context.Context, tenantID uuid.UUID, ticketID int) (models.FlowRun, bool) {
	var run models.FlowRun
	err := s.db.WithContext(ctx).
		Where(`"tenantId" = ? AND "ticketId" = ? AND status = ?`,
			tenantID, ticketID, models.FlowRunStatusWaitingMessage).
		Order(`"updatedAt" DESC`).
		First(&run).Error
	if err != nil {
		return models.FlowRun{}, false
	}
	return run, true
}

// abortActiveRun marks any non-terminal run for (tenant,ticket) as aborted.
// Returns true when at least one row was updated.
func (s *Skeleton) abortActiveRun(ctx context.Context, tenantID uuid.UUID, ticketID int) bool {
	res := s.db.Session(&gorm.Session{NewDB: true}).
		WithContext(ctx).
		Model(&models.FlowRun{}).
		Where(`"tenantId" = ? AND "ticketId" = ? AND status IN ?`,
			tenantID, ticketID, []string{
				models.FlowRunStatusRunning,
				models.FlowRunStatusWaitingMessage,
				models.FlowRunStatusWaitingUntil,
				models.FlowRunStatusWaitingEvent,
			}).
		Updates(map[string]interface{}{"status": models.FlowRunStatusAborted, "updatedAt": time.Now()})
	return res.Error == nil && res.RowsAffected > 0
}

// StartFlow snapshots the flow graph, creates a running FlowRun bound to the
// ticket and drives the interpreter. Writes in Session(NewDB) + WHERE tenantId.
func (s *Skeleton) StartFlow(ctx context.Context, in InboundContext, f models.Flow) error {
	graph, err := ParseGraph(f.Nodes, f.Edges)
	if err != nil {
		return err
	}
	snapshot, err := json.Marshal(graph)
	if err != nil {
		return err
	}

	now := time.Now()
	expires := now.Add(runTTL)
	ticketID := in.Ticket.ID

	run := models.FlowRun{
		ID:            uuid.New(),
		TenantID:      in.TenantID,
		FlowID:        f.ID,
		TicketID:      &ticketID,
		Status:        models.FlowRunStatusRunning,
		SubjectType:   models.FlowRunSubjectTicket,
		Vars:          mustJSON(buildVars(in)),
		ExpiresAt:     &expires,
		GraphSnapshot: snapshot,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := s.db.Session(&gorm.Session{NewDB: true}).WithContext(ctx).Create(&run).Error; err != nil {
		return err
	}

	st := &ExecState{
		TenantID:         in.TenantID,
		Run:              &run,
		Graph:            graph,
		Vars:             buildVars(in),
		Inbound:          in.Body, // carry the triggering body for the first menu/switch
		Ticket:           in.Ticket,
		Contact:          in.Contact,
		MentionedJIDs:    in.MentionedJIDs,
		Retriever:        s.retriever,
		Responder:        s.responder,
		AssistantRuntime: s.assistantRuntime,
		Starter:          s,
	}
	return s.interpreter.Run(ctx, st)
}

// StartFlowForContact creates a FlowRun bound to a contact (subjectType=contact)
// and drives the interpreter. Used when starting a flow from the contact sidebar
// without an active ticket. SubjectID is a run-local UUID (opaque); the contact
// int ID is stored in vars["contact_id"] for reentrance queries.
// Writes in Session(NewDB:true) + WHERE tenantId manual (RLS is INERT here).
func (s *Skeleton) StartFlowForContact(ctx context.Context, tenantID uuid.UUID, contact *domain.Contact, f models.Flow) error {
	graph, err := ParseGraph(f.Nodes, f.Edges)
	if err != nil {
		return err
	}
	snapshot, err := json.Marshal(graph)
	if err != nil {
		return err
	}

	now := time.Now()
	expires := now.Add(runTTL)
	subjectID := uuid.New() // opaque run identity; contact int ID lives in vars

	vars := map[string]string{
		"contact_id":     strconv.Itoa(contact.ID),
		"contact_name":   contact.Name,
		"contact_number": contact.Number,
		"ticket_id":      "",
		"last_input":     "",
		"firstName":      firstName(contact.Name),
		"name":           contact.Name,
		"protocol":       "",
		"date":           now.Format("02/01/2006"),
	}

	run := models.FlowRun{
		ID:            uuid.New(),
		TenantID:      tenantID,
		FlowID:        f.ID,
		Status:        models.FlowRunStatusRunning,
		SubjectType:   models.FlowRunSubjectContact,
		SubjectID:     &subjectID,
		Vars:          mustJSON(vars),
		ExpiresAt:     &expires,
		GraphSnapshot: snapshot,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := s.db.Session(&gorm.Session{NewDB: true}).WithContext(ctx).Create(&run).Error; err != nil {
		return err
	}

	st := &ExecState{
		TenantID:         tenantID,
		Run:              &run,
		Graph:            graph,
		Vars:             vars,
		Inbound:          "",
		Contact:          contact,
		Retriever:        s.retriever,
		Responder:        s.responder,
		AssistantRuntime: s.assistantRuntime,
		Starter:          s,
	}
	return s.interpreter.Run(ctx, st)
}

// claimRun atomically flips a waiting run to running, conditional on it still
// being in the status we read. RowsAffected==0 means another delivery already
// advanced (or aborted/expired) it between our read and now → the caller must
// discard this delivery instead of resuming a stale snapshot. Defense-in-depth
// behind the per-ticket lock (H2): even if the lock were bypassed, two resumes of
// the same run can never both win.
func (s *Skeleton) claimRun(ctx context.Context, run models.FlowRun, fromStatus string) (bool, error) {
	res := s.db.Session(&gorm.Session{NewDB: true}).
		WithContext(ctx).
		Model(&models.FlowRun{}).
		Where(`"tenantId" = ? AND id = ? AND status = ?`, run.TenantID, run.ID, fromStatus).
		Updates(map[string]interface{}{"status": models.FlowRunStatusRunning, "updatedAt": time.Now()})
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}

// resume rehydrates a suspended run from its GraphSnapshot and drives the
// interpreter with the new inbound body.
func (s *Skeleton) resume(ctx context.Context, in InboundContext, run models.FlowRun) {
	// Optimistically claim the run (waiting_message → running). If another
	// delivery already advanced it, RowsAffected==0 → discard this one.
	claimed, err := s.claimRun(ctx, run, models.FlowRunStatusWaitingMessage)
	if err != nil {
		log.Printf("[FlowSkeleton] resume: claim failed run=%s: %v", run.ID, err)
		return
	}
	if !claimed {
		log.Printf("[FlowSkeleton] resume: run=%s already advanced by a concurrent delivery — discarding", run.ID)
		return
	}
	run.Status = models.FlowRunStatusRunning

	var graph FlowGraph
	if err := json.Unmarshal(run.GraphSnapshot, &graph); err != nil {
		log.Printf("[FlowSkeleton] resume: bad snapshot run=%s: %v", run.ID, err)
		return
	}

	vars := map[string]string{}
	if len(run.Vars) > 0 {
		_ = json.Unmarshal(run.Vars, &vars)
	}
	for k, v := range buildVars(in) {
		vars[k] = v // refresh contact/ticket-derived vars
	}

	st := &ExecState{
		TenantID:         in.TenantID,
		Run:              &run,
		Graph:            graph,
		Vars:             vars,
		Inbound:          in.Body,
		ResumeNodeID:     run.CurrentNodeID, // the node we suspended at owns the reply
		Ticket:           in.Ticket,
		Contact:          in.Contact,
		MentionedJIDs:    in.MentionedJIDs,
		Retriever:        s.retriever,
		Responder:        s.responder,
		AssistantRuntime: s.assistantRuntime,
		Starter:          s,
	}
	if err := s.interpreter.Run(ctx, st); err != nil {
		log.Printf("[FlowSkeleton] resume failed run=%s: %v", run.ID, err)
	}
}

// buildVars seeds the run variable map from the ticket/contact. It covers both
// the runtime names ({{contact_name}}, {{ticket_id}}) and the names the canvas
// editor offers (MessageForm.tsx: {{firstName}}, {{name}}, {{protocol}},
// {{date}}) so a message authored with the editor buttons interpolates instead of
// stripping to "". Absent values are empty strings (invariant: var ausente → "").
func buildVars(in InboundContext) map[string]string {
	vars := map[string]string{
		"contact_name":   "",
		"contact_number": "",
		"ticket_id":      "",
		"last_input":     in.Body,
		// Editor-offered aliases (MessageForm.tsx).
		"firstName": "",
		"name":      "",
		"protocol":  "",
		"date":      time.Now().Format("02/01/2006"),
	}
	if in.Contact != nil {
		vars["contact_name"] = in.Contact.Name
		vars["contact_number"] = in.Contact.Number
		vars["name"] = in.Contact.Name
		vars["firstName"] = firstName(in.Contact.Name)
	}
	if in.Ticket != nil {
		vars["ticket_id"] = strconv.Itoa(in.Ticket.ID)
		// No dedicated protocol column on Ticket — the ticket id is the protocol
		// number in this domain, so map {{protocol}} to it.
		vars["protocol"] = strconv.Itoa(in.Ticket.ID)
	}
	return vars
}

// firstName returns the first whitespace-delimited token of a full name (empty
// for an empty name).
func firstName(full string) string {
	fields := strings.Fields(full)
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}

// ExpireDueRuns sweeps runs whose ExpiresAt has passed and are still waiting,
// marking them expired. Tenant-agnostic batch (each row carries its tenantId);
// the WHERE filters by status+time only, never crossing into tenant data. This
// is a callable method — the real periodic scheduler is FASE 3.
func (s *Skeleton) ExpireDueRuns(ctx context.Context) (int64, error) {
	if s == nil || s.db == nil {
		return 0, nil
	}
	res := s.db.Session(&gorm.Session{NewDB: true}).
		WithContext(ctx).
		Model(&models.FlowRun{}).
		Where(`"expiresAt" IS NOT NULL AND "expiresAt" < ? AND status IN ?`,
			time.Now(), []string{
				models.FlowRunStatusRunning,
				models.FlowRunStatusWaitingMessage,
				models.FlowRunStatusWaitingUntil,
				models.FlowRunStatusWaitingEvent,
			}).
		Updates(map[string]interface{}{"status": models.FlowRunStatusExpired, "updatedAt": time.Now()})
	return res.RowsAffected, res.Error
}

// mustJSON marshals v to a JSON blob, falling back to "{}".
func mustJSON(v map[string]string) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}
	return b
}
