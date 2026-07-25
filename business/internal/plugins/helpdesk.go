package plugins

import (
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
)

// HelpdeskPlugin — DB via core.GetDB() (DI), zero acesso a database.DB
// global. Rotas registradas em OnActivate delegam para handlers definidos em
// helpdesk_protocols.go / helpdesk_kanban.go / helpdesk_attachments.go /
// helpdesk_public.go (mesmo pacote — arquivos separados por responsabilidade,
// CLAUDE.md "divida sem medo").
type HelpdeskPlugin struct{}

func (hp *HelpdeskPlugin) GetManifest() sdk.PluginManifest {
	return sdk.PluginManifest{
		Slug:        "helpdesk",
		Name:        "Helpdesk Pro",
		Version:     "2.0.0",
		Description: "Gestão completa de tickets e protocolos",
		Type:        "pro",
	}
}

// OnInstall existe pelo contrato sdk.WatinkPlugin, mas NÃO roda no boot real
// (PluginManager.Register só chama OnActivate — ver manager.go). A migration
// de produção real de Protocol/ProtocolLog/ProtocolAttachment vive em
// database.Migrate(). Mantido para compatibilidade com testes/instalação
// manual futura.
func (hp *HelpdeskPlugin) OnInstall(core sdk.WatinkCore) error {
	return core.GetDB().AutoMigrate(&models.Protocol{}, &models.ProtocolLog{}, &models.ProtocolAttachment{})
}

// Rotas SEM prefixo "/helpdesk" (exceto o link público) — o módulo frontend
// maduro em frontend/src/pages/Helpdesk/ já chama bare "/protocols*"
// (useHelpdesk.ts, useHelpdeskKanban.ts, useProtocolModal.ts,
// useProtocolDetails.ts, HelpdeskReports.tsx). O stub anterior registrava em
// "/helpdesk/protocols" — nunca batia com o contrato real do frontend, e por
// nunca ter sido testado ao vivo esse descompasso não tinha sido percebido.
func (hp *HelpdeskPlugin) OnActivate(core sdk.WatinkCore) error {
	core.RegisterRoute("GET", "/protocols", handleListProtocols(core))
	core.RegisterRoute("GET", "/protocols/kanban", handleKanban(core))
	core.RegisterRoute("GET", "/protocols/dashboard", handleDashboard(core))
	core.RegisterRoute("POST", "/protocols", handleCreateProtocol(core))
	core.RegisterRoute("GET", "/protocols/:id", handleGetProtocol(core))
	core.RegisterRoute("PUT", "/protocols/:id", handleUpdateProtocol(core))
	core.RegisterRoute("GET", "/protocols/:id/attachments", handleListAttachments(core))
	core.RegisterRoute("POST", "/protocols/:id/attachments", handleUploadAttachments(core))
	core.RegisterRoute("DELETE", "/protocols/:id/attachments/:attachmentId", handleDeleteAttachment(core))

	// Link público (sem login) — token é a credencial, resolvido dentro do
	// handler; nunca passa pelo gating de licença de RegisterRoute (não há
	// tenant pré-resolvido para checar).
	core.RegisterPublicRoute("GET", "/public/protocols/:token", handlePublicProtocol(core))
	return nil
}

func (hp *HelpdeskPlugin) OnDeactivate(core sdk.WatinkCore) error {
	return nil
}
