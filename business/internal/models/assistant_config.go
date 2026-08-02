package models

// These structs are NOT persisted directly — they describe the shape expected
// inside Assistant.Config depending on Assistant.Mode. Controllers decode/
// validate against the matching struct on Create/Update; never trust the raw
// JSON blob without validating it against the Mode first.
// See docs/agents/assistants.md.

type AssistantPipelineConfig struct {
	PipelineID             int      `json:"pipelineId"`
	Events                 []string `json:"events"` // deal_created|stage_changed|idle|closed
	IdleThresholdDays      int      `json:"idleThresholdDays"`
	RespondsAfterProactive bool     `json:"respondsAfterProactive"`

	// Present only when RespondsAfterProactive=true — mirrors AssistantPersonaConfig.
	Persona             string  `json:"persona"`
	KnowledgeBaseID     *int    `json:"knowledgeBaseId"`
	MaxTurns            int     `json:"maxTurns"`
	AiGatewayID         int     `json:"aiGatewayId"`
	RagFallbackBehavior string  `json:"ragFallbackBehavior"`
	RagFallbackMessage  *string `json:"ragFallbackMessage"`
}

type AssistantFlowConfig struct {
	FlowID int `json:"flowId"`
}

type AssistantPersonaConfig struct {
	Persona             string  `json:"persona"`
	KnowledgeBaseID     *int    `json:"knowledgeBaseId"`
	MaxTurns            int     `json:"maxTurns"`
	AiGatewayID         int     `json:"aiGatewayId"`
	RagFallbackBehavior string  `json:"ragFallbackBehavior"` // handoff|generic_answer|fixed_message
	RagFallbackMessage  *string `json:"ragFallbackMessage"`
}

// AssistantMode enumerates the valid values of Assistant.Mode.
const (
	AssistantModePipeline = "pipeline"
	AssistantModeFlow     = "flow"
	AssistantModePersona  = "persona"
	AssistantModeRouter   = "router"
)

// AssistantGroupsMode enumerates the valid values of Assistant.GroupsMode.
const (
	AssistantGroupsModeLegacy    = "legacy"
	AssistantGroupsModeSelective = "selective"
)

// ValidAssistantGroupsModes is the allow-list used by the controller to
// validate GroupsMode on Create/Update, same pattern as ValidAssistantModes.
var ValidAssistantGroupsModes = map[string]bool{
	AssistantGroupsModeLegacy:    true,
	AssistantGroupsModeSelective: true,
}

// ValidAssistantModes is the allow-list used by controllers to validate
// Assistant.Mode on Create/Update.
var ValidAssistantModes = map[string]bool{
	AssistantModePipeline: true,
	AssistantModeFlow:     true,
	AssistantModePersona:  true,
	AssistantModeRouter:   true,
}

// RagFallbackBehavior enumerates the valid values for
// AssistantPersonaConfig.RagFallbackBehavior / AssistantPipelineConfig.RagFallbackBehavior.
const (
	RagFallbackHandoff       = "handoff"
	RagFallbackGenericAnswer = "generic_answer"
	RagFallbackFixedMessage  = "fixed_message"
)

var ValidRagFallbackBehaviors = map[string]bool{
	RagFallbackHandoff:       true,
	RagFallbackGenericAnswer: true,
	RagFallbackFixedMessage:  true,
}
