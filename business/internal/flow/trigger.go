package flow

import (
	"encoding/json"
	"strconv"
	"strings"
)

// Trigger projection constants. The skeleton's matchTriggers reads these
// projected columns ("triggerType"/"triggerValue") off the Flow row, so the
// graph's entry/trigger node MUST be projected onto them at Create/Update time.
const (
	// TriggerWhatsAppMessage fires on any inbound WhatsApp message; when a
	// keyword is set, TriggerValue carries the normalized keyword and the match
	// is exact (case-insensitive). Empty TriggerValue = match any message.
	TriggerWhatsAppMessage = "whatsapp_message"

	// TriggerWhatsAppFirstContact fires only on the first message of a brand-new
	// contact/ticket. TriggerValue is empty.
	TriggerWhatsAppFirstContact = "whatsapp_first_contact"
)

// triggerNodeData is the subset of a start/trigger node's data envelope that
// drives projection. Field names mirror the frontend (nodeEditorTypes.ts +
// TriggerForm/StartForm): triggerType ∈ {keyword,any,firstContact,message,...},
// with the keyword carried inside the conditions[] builder.
type triggerNodeData struct {
	TriggerType string `json:"triggerType"`
	// WhatsAppID is the connection id the trigger is bound to. The frontend Select
	// stores it as a string; parseConnID turns it into the *int the Flow column uses.
	WhatsAppID *string `json:"whatsappId"`
	Conditions []struct {
		Field    string `json:"field"`
		Operator string `json:"operator"`
		Value    string `json:"value"`
	} `json:"conditions"`
	// TriggerOperator carries an explicit operator authored outside the
	// conditions[] builder (e.g. the Assistants plugin's synthetic trigger
	// node — see assistant_sync_flow.go). When set, it wins over whatever
	// operator a condition[] entry might also carry.
	TriggerOperator string `json:"triggerOperator"`
}

// TriggerProjection is the flat (type,value,operator,connection) tuple
// written to the Flow columns. WhatsAppID binds the flow to a connection
// (nil = any connection). Operator is one of ValidTriggerOperators — empty
// defaults to "equals" (matchTriggers' historical behavior, preserved for
// backward compatibility with flows created before the operator existed).
type TriggerProjection struct {
	Type       string
	Value      string
	Operator   string
	WhatsAppID *int
}

// ValidTriggerOperators is the closed set of keyword-match operators the
// runtime's matchTriggers understands (ADR 0027 follow-up: extends the
// matcher beyond exact-equals for the Assistants plugin, benefiting every
// Flow). "" (absent) is treated as "equals" for backward compatibility.
var ValidTriggerOperators = map[string]bool{
	"":            true,
	"equals":      true,
	"contains":    true,
	"starts_with": true,
	"ends_with":   true,
	"regex":       true,
}

// ProjectTrigger walks the graph, finds the entry/trigger node and projects its
// configured trigger onto the flat columns the runtime matches against.
//
// Resolution order for the entry node: a node of type "trigger" wins; otherwise
// the first "start"/"input" node. An absent/zero triggerType defaults to
// "keyword" (mirrors TriggerForm's default), which without a keyword degrades to
// a match-any message trigger.
//
// Returns an empty (zero) projection when no entry node exists — the caller then
// leaves the existing columns untouched (a graph with no trigger is simply not
// auto-startable, never an error here).
func ProjectTrigger(g FlowGraph) TriggerProjection {
	node, ok := entryNode(g)
	if !ok {
		return TriggerProjection{}
	}

	var d triggerNodeData
	if len(node.Data) > 0 {
		_ = json.Unmarshal(node.Data, &d)
	}
	connID := parseConnID(d.WhatsAppID)

	switch strings.TrimSpace(d.TriggerType) {
	case "firstContact":
		return TriggerProjection{Type: TriggerWhatsAppFirstContact, Value: "", WhatsAppID: connID}
	case "any", "message":
		// Any inbound message starts the flow.
		return TriggerProjection{Type: TriggerWhatsAppMessage, Value: "", WhatsAppID: connID}
	case "keyword", "":
		// Keyword lives in the conditions builder. Extract the first textual
		// keyword (a contains/equals condition on the last input); fall back to
		// match-any when no keyword is configured.
		kw := extractKeyword(d)
		op := extractOperator(d)
		return TriggerProjection{Type: TriggerWhatsAppMessage, Value: kw, Operator: op, WhatsAppID: connID}
	default:
		// Unknown trigger type (time/webhook/action) — not a message trigger,
		// so it is not projected onto the message-match columns.
		return TriggerProjection{}
	}
}

// entryNode returns the graph's trigger node, preferring an explicit "trigger"
// node over the canvas-seeded "start"/"input" entry node.
func entryNode(g FlowGraph) (Node, bool) {
	var start *Node
	for i := range g.Nodes {
		switch NodeType(g.Nodes[i].Type) {
		case NodeTrigger:
			return g.Nodes[i], true
		case NodeStart, NodeInput:
			if start == nil {
				start = &g.Nodes[i]
			}
		}
	}
	if start != nil {
		return *start, true
	}
	return Node{}, false
}

// extractKeyword pulls a normalized keyword from the trigger's conditions. It
// takes the value of the first condition that carries a non-empty value (the
// keyword builder uses field=lastInput, operator=contains/equals). The value is
// trimmed + lowercased so it matches the runtime's case-insensitive compare.
func extractKeyword(d triggerNodeData) string {
	for _, c := range d.Conditions {
		v := strings.TrimSpace(c.Value)
		if v != "" {
			return strings.ToLower(v)
		}
	}
	return ""
}

// extractOperator resolves the keyword-match operator: an explicit
// TriggerOperator on the node data wins; otherwise the first condition's
// Operator; otherwise "" (= "equals", backward-compatible default). An
// unrecognized operator degrades to "" rather than propagating garbage into
// the Flow column.
func extractOperator(d triggerNodeData) string {
	op := strings.TrimSpace(d.TriggerOperator)
	if op == "" {
		for _, c := range d.Conditions {
			if strings.TrimSpace(c.Value) != "" {
				op = strings.TrimSpace(c.Operator)
				break
			}
		}
	}
	if !ValidTriggerOperators[op] {
		return ""
	}
	return op
}

// parseConnID turns the trigger node's connection id (a string from the frontend
// Select, possibly empty) into the *int the Flow "whatsappId" column uses. An empty
// or non-numeric value yields nil (= unbound / any connection).
func parseConnID(s *string) *int {
	if s == nil {
		return nil
	}
	v := strings.TrimSpace(*s)
	if v == "" {
		return nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return nil
	}
	return &n
}
