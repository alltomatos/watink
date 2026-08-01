package plugins

import (
	"encoding/json"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
)

func TestValidateAssistantConfig_RejectsInvalidMode(t *testing.T) {
	if err := validateAssistantConfig("bogus", json.RawMessage(`{}`)); err == nil {
		t.Fatal("expected error for invalid mode")
	}
}

func TestValidateAssistantConfig_RouterHasNoConfigRequirement(t *testing.T) {
	if err := validateAssistantConfig(models.AssistantModeRouter, nil); err != nil {
		t.Fatalf("router mode should not require config, got: %v", err)
	}
}

func TestValidateAssistantConfig_FlowRequiresFlowID(t *testing.T) {
	if err := validateAssistantConfig(models.AssistantModeFlow, json.RawMessage(`{}`)); err == nil {
		t.Fatal("expected error when config.flowId is missing")
	}
	if err := validateAssistantConfig(models.AssistantModeFlow, json.RawMessage(`{"flowId":5}`)); err != nil {
		t.Fatalf("expected valid flow config to pass, got: %v", err)
	}
}

func TestValidateAssistantConfig_PipelineRequiresPipelineID(t *testing.T) {
	if err := validateAssistantConfig(models.AssistantModePipeline, json.RawMessage(`{}`)); err == nil {
		t.Fatal("expected error when config.pipelineId is missing")
	}
	valid := json.RawMessage(`{"pipelineId":3,"events":["stage_changed"]}`)
	if err := validateAssistantConfig(models.AssistantModePipeline, valid); err != nil {
		t.Fatalf("expected valid pipeline config to pass, got: %v", err)
	}
}

func TestValidateAssistantConfig_PipelineRespondsAfterProactiveRequiresRagFallback(t *testing.T) {
	invalid := json.RawMessage(`{"pipelineId":3,"respondsAfterProactive":true,"aiGatewayId":1,"ragFallbackBehavior":"nonsense"}`)
	if err := validateAssistantConfig(models.AssistantModePipeline, invalid); err == nil {
		t.Fatal("expected error for invalid ragFallbackBehavior when respondsAfterProactive=true")
	}
	valid := json.RawMessage(`{"pipelineId":3,"respondsAfterProactive":true,"aiGatewayId":1,"ragFallbackBehavior":"handoff"}`)
	if err := validateAssistantConfig(models.AssistantModePipeline, valid); err != nil {
		t.Fatalf("expected valid config to pass, got: %v", err)
	}
}

func TestValidateAssistantConfig_PersonaRequiresAiGatewayAndValidFallback(t *testing.T) {
	missingGateway := json.RawMessage(`{"ragFallbackBehavior":"handoff"}`)
	if err := validateAssistantConfig(models.AssistantModePersona, missingGateway); err == nil {
		t.Fatal("expected error when config.aiGatewayId is missing")
	}
	badFallback := json.RawMessage(`{"aiGatewayId":1,"ragFallbackBehavior":"nonsense"}`)
	if err := validateAssistantConfig(models.AssistantModePersona, badFallback); err == nil {
		t.Fatal("expected error for invalid ragFallbackBehavior")
	}
	valid := json.RawMessage(`{"aiGatewayId":1,"ragFallbackBehavior":"handoff"}`)
	if err := validateAssistantConfig(models.AssistantModePersona, valid); err != nil {
		t.Fatalf("expected valid persona config to pass, got: %v", err)
	}
}

func TestToAssistantResponse_ExposesModeAndTrigger(t *testing.T) {
	a := models.Assistant{
		ID: 1, Name: "Vendas", Mode: models.AssistantModePersona,
		TriggerType: "keyword", TriggerOperator: "contains", TriggerValue: "oi",
		Active: true,
	}
	resp := toAssistantResponse(a)
	if resp["mode"] != models.AssistantModePersona {
		t.Fatalf("expected mode persona, got %v", resp["mode"])
	}
	if resp["triggerValue"] != "oi" {
		t.Fatalf("expected triggerValue 'oi', got %v", resp["triggerValue"])
	}
}
