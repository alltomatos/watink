package plugins

import (
	"github.com/alltomatos/watinkdev/business/internal/domain"
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
type GroupsPlugin struct {
	Resolver domain.WhatsAppEngineResolver
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
	core.RegisterRoute("DELETE", "/groups/watch-tags/:id", withPermission("whatsappGroups", "manage", handleDeleteGroupWatchTag(core)))
	core.RegisterRoute("GET", "/groups/watch-matches", withPermission("whatsappGroups", "read", handleListGroupWatchMatches(core)))
	registerGroupWatchEvents(core)

	return nil
}

func (gp *GroupsPlugin) OnDeactivate(core sdk.WatinkCore) error {
	return nil
}
