package plugins

import "github.com/alltomatos/watinkdev/business/pkg/sdk"

// AssistantPlugin — "Assistentes de IA". CRUD only here; runtime dispatch
// (synthetic Flow, Agent Runtime reuse, Pipeline events) lands in later
// issues. See docs/agents/assistants.md and ADR 0027.
type AssistantPlugin struct{}

func (ap *AssistantPlugin) GetManifest() sdk.PluginManifest {
	return sdk.PluginManifest{
		Slug:        "assistant",
		Name:        "Assistentes de IA",
		Version:     "1.0.0",
		Description: "Automação conversacional por IA — pipeline, flow, persona ou roteador",
		Type:        "pro",
	}
}

func (ap *AssistantPlugin) OnInstall(core sdk.WatinkCore) error {
	return nil
}

func (ap *AssistantPlugin) OnActivate(core sdk.WatinkCore) error {
	ac := NewAssistantController()
	rc := NewAssistantRouterController()
	gc := NewAiGatewayController()

	core.RegisterRoute("GET", "/assistants", ac.List)
	core.RegisterRoute("POST", "/assistants", ac.Create)
	core.RegisterRoute("GET", "/assistants/:id", ac.Get)
	core.RegisterRoute("PUT", "/assistants/:id", ac.Update)
	core.RegisterRoute("DELETE", "/assistants/:id", ac.Delete)
	core.RegisterRoute("POST", "/assistants/:id/duplicate", ac.Duplicate)

	core.RegisterRoute("GET", "/assistants/:id/router-options", rc.List)
	core.RegisterRoute("POST", "/assistants/:id/router-options", rc.Create)
	core.RegisterRoute("PUT", "/assistants/:id/router-options/:optionId", rc.Update)
	core.RegisterRoute("DELETE", "/assistants/:id/router-options/:optionId", rc.Delete)

	core.RegisterRoute("GET", "/ai-gateways", gc.List)
	core.RegisterRoute("POST", "/ai-gateways", gc.Create)
	core.RegisterRoute("GET", "/ai-gateways/:id", gc.Get)
	core.RegisterRoute("PUT", "/ai-gateways/:id", gc.Update)
	core.RegisterRoute("DELETE", "/ai-gateways/:id", gc.Delete)

	return nil
}

func (ap *AssistantPlugin) OnDeactivate(core sdk.WatinkCore) error {
	return nil
}
