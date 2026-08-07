package plugins

import (
	"log"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/gin-gonic/gin"
)

// GroupsPlugin — gestão ativa de grupos/comunidades WhatsApp (T2.3, plano
// "Grupos e Comunidades", docs/agents/plugin-grupos-comunidades.md).
// Diferente de HelpdeskPlugin/AssistantPlugin (structs vazias, tudo via
// core.GetDB()), este plugin precisa resolver o domain.WhatsAppEngine da
// conexão — por isso carrega um Resolver injetado no momento do registro em
// internal/routes/routes.go (container.SessionService já implementa
// domain.WhatsAppEngineResolver).
//
// Publisher/Redis (issue #595) são usados só pela feature de Campanhas, pra
// construir um flow.WhatsAppAdapter próprio -- sdk.WatinkCore.SendTicketMessage
// não serve aqui (é texto puro e exige um Ticket já existente). nil em
// qualquer um dos dois é aceito (registros de rota/handlers seguem
// funcionando) mas deixa o envio de campanha fail-closed: ver
// groups_campaign_send.go errAdapterNotConfigured.
type GroupsPlugin struct {
	Resolver  domain.WhatsAppEngineResolver
	Publisher domain.CommandPublisher
	Redis     domain.RedisService
}

func (gp *GroupsPlugin) GetManifest() sdk.PluginManifest {
	return sdk.PluginManifest{
		Slug:        "groups",
		Name:        "Grupos e Comunidades",
		Version:     "1.0.0",
		Description: "Gestão de grupos e comunidades do WhatsApp — participantes, convites, configurações",
		Type:        "pro",
	}
}

func (gp *GroupsPlugin) OnInstall(core sdk.WatinkCore) error {
	return nil
}

// withPermission composes auth.RequirePermission (a gin middleware that
// calls c.Next() on success) with a plain handler, since
// sdk.WatinkCore.RegisterRoute only accepts one gin.HandlerFunc — not a
// chain. c.Next() here is harmless (there's nothing after it in this
// single-handler registration); what actually gates `next` is the explicit
// c.IsAborted() check.
func withPermission(resource, action string, next gin.HandlerFunc) gin.HandlerFunc {
	check := auth.RequirePermission(resource, action)
	return func(c *gin.Context) {
		check(c)
		if c.IsAborted() {
			return
		}
		next(c)
	}
}

// Recurso RBAC "whatsappGroups" (não "groups" — o core já tem
// ConnectionGroup/ProxyGroup/TagGroup, conceitos homônimos não
// relacionados). Ações: read (listar/consultar) · manage (criar/configurar/
// vincular) · admin (mexer em pessoas — add/remove/promote/demote/leave/
// join-requests, a ação de maior risco de ban).
func (gp *GroupsPlugin) OnActivate(core sdk.WatinkCore) error {
	svc := newGroupsService(core, gp.Resolver)

	core.RegisterRoute("GET", "/groups", withPermission("whatsappGroups", "read", handleListGroups(svc)))
	core.RegisterRoute("POST", "/groups", withPermission("whatsappGroups", "manage", handleCreateGroup(svc)))
	core.RegisterRoute("GET", "/groups/:id", withPermission("whatsappGroups", "read", handleGetGroup(svc)))
	core.RegisterRoute("PUT", "/groups/:id", withPermission("whatsappGroups", "manage", handleUpdateGroupSettings(svc)))
	core.RegisterRoute("POST", "/groups/:id/participants", withPermission("whatsappGroups", "admin", handleUpdateParticipants(svc)))
	core.RegisterRoute("GET", "/groups/:id/invite-link", withPermission("whatsappGroups", "read", handleGetInviteLink(svc)))
	core.RegisterRoute("POST", "/groups/:id/invite-link/revoke", withPermission("whatsappGroups", "manage", handleRevokeInviteLink(svc)))
	core.RegisterRoute("GET", "/groups/:id/join-requests", withPermission("whatsappGroups", "read", handleListJoinRequests(svc)))
	core.RegisterRoute("POST", "/groups/:id/join-requests", withPermission("whatsappGroups", "admin", handleResolveJoinRequests(svc)))
	core.RegisterRoute("POST", "/groups/:id/leave", withPermission("whatsappGroups", "admin", handleLeaveGroup(svc)))

	core.RegisterRoute("GET", "/communities", withPermission("whatsappGroups", "read", handleListCommunities(svc)))
	core.RegisterRoute("POST", "/communities", withPermission("whatsappGroups", "manage", handleCreateCommunity(svc)))
	core.RegisterRoute("GET", "/communities/:id", withPermission("whatsappGroups", "read", handleGetCommunity(svc)))
	core.RegisterRoute("POST", "/communities/:id/groups/:groupId", withPermission("whatsappGroups", "manage", handleLinkCommunityGroup(svc)))
	core.RegisterRoute("DELETE", "/communities/:id/groups/:groupId", withPermission("whatsappGroups", "manage", handleUnlinkCommunityGroup(svc)))

	// Monitoramento de frase (groups_watch.go) — feature independente do
	// resolveConnection/GroupEngine acima: reage a QUALQUER mensagem de grupo
	// já persistida pelo core, não fala com o WhatsApp diretamente.
	core.RegisterRoute("GET", "/groups/watch-tags", withPermission("whatsappGroups", "read", handleListGroupWatchTags(core)))
	core.RegisterRoute("POST", "/groups/watch-tags", withPermission("whatsappGroups", "manage", handleCreateGroupWatchTag(core)))
	core.RegisterRoute("PUT", "/groups/watch-tags/:id", withPermission("whatsappGroups", "manage", handleUpdateGroupWatchTag(core)))
	core.RegisterRoute("DELETE", "/groups/watch-tags/:id", withPermission("whatsappGroups", "manage", handleDeleteGroupWatchTag(core)))
	core.RegisterRoute("GET", "/groups/watch-matches", withPermission("whatsappGroups", "read", handleListGroupWatchMatches(core)))
	registerGroupWatchEvents(core)
	registerGroupsCacheSync(core, gp.Resolver)

	var adapter *flow.WhatsAppAdapter
	if gp.Publisher != nil {
		adapter = flow.NewWhatsAppAdapter(gp.Publisher, gp.Redis, flow.WhatsAppAdapterDeps{
			DB:      core.GetDB(),
			Engines: gp.Resolver,
		})
	} else {
		log.Printf("[groups] Publisher não configurado — envio de campanha ficará fail-closed")
	}
	registerGroupCampaignCrons(core, core.GetDB(), adapter)

	return nil
}

func (gp *GroupsPlugin) OnDeactivate(core sdk.WatinkCore) error {
	return nil
}
