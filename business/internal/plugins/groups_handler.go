package plugins

import (
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
)

// groupJIDParam decodes the ":id"/":groupId" path param — it is the full
// JID (invariant 5), path-encoded by the frontend.
func groupJIDParam(c *gin.Context, name string) (string, bool) {
	raw := c.Param(name)
	jid, err := url.PathUnescape(raw)
	if err != nil || jid == "" {
		utils.RespondWithError(c, http.StatusBadRequest, err, "JID de grupo inválido")
		return "", false
	}
	return jid, true
}

// groupsListEntry adiciona ao domain.GroupInfo canônico o único dado que só
// faz sentido no contexto "esta conexão, este grupo": se o número conectado
// é admin do grupo ou só participa. Não vira campo em domain.GroupInfo
// porque ali é o shape neutro que os dois providers preenchem a partir do
// transporte deles -- isso aqui é derivado depois, olhando Participants
// contra w.Number.
type groupsListEntry struct {
	domain.GroupInfo
	IsConnectionAdmin bool `json:"isConnectionAdmin"`
}

// connectionIsGroupAdmin varre Participants em busca do participante cujo
// número bate com o da conexão e devolve o IsAdmin desse participante.
//
// Checa DOIS campos, não só JID: grupos com a privacidade "LID" da Meta
// ativada (rollout amplo, ver engine-go/internal/whatsapp/groups_dto.go
// participantFromWhatsmeow) reportam o próprio participante com JID sendo
// um "@lid" opaco -- não é o número de telefone, comparar só contra ele
// nunca bate e todo grupo LID marca a conexão como "não-admin" mesmo sendo.
// PhoneNumber é o campo que o whatsmeow preenche quando consegue resolver o
// número real por trás do LID (vazio quando não consegue). Testa PhoneNumber
// primeiro (mais confiável quando presente) e cai para JID como fallback
// (grupos sem LID, onde JID já É o número).
//
// Sem match (não deveria acontecer para um grupo em que a conexão está, mas
// dado de terceiro nunca é garantia), o fail-safe é false: nunca assumir
// admin sem confirmação explícita.
func connectionIsGroupAdmin(participants []domain.Participant, connectionNumber string) bool {
	for _, p := range participants {
		if p.PhoneNumber != "" && localPart(p.PhoneNumber) == connectionNumber {
			return p.IsAdmin
		}
	}
	for _, p := range participants {
		if localPart(p.JID) == connectionNumber {
			return p.IsAdmin
		}
	}
	return false
}

// localPart strips "@domain" and a whatsmeow ":device" suffix, same split
// used by usecases.jidNumber.
func localPart(jid string) string {
	local := strings.SplitN(jid, "@", 2)[0]
	return strings.SplitN(local, ":", 2)[0]
}

// handleListGroups NUNCA fala com o WhatsApp no caminho comum -- lê
// GroupCache (groups_cache.go), mantido quente pelo sync de background
// (groups_cache_sync.go, a cada 15min, em lotes de 5 conexões). Só faz um
// fetch ao vivo na primeira vez que a conexão é vista (cache vazio) --
// depois disso vira a única fonte, evitando tanto o risco de ban de bater
// no WhatsApp a cada abertura da tela quanto o timeout visto em conexões
// com muitos grupos.
func handleListGroups(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		w, engine, err := svc.resolveConnectionFromQuery(c, tenantID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ListGroups")
			return
		}

		cached, found, err := loadGroupsCache(svc.db, tenantID, w.ID)
		if err != nil {
			utils.RespondWithInternalError(c, err, "GroupsPlugin.ListGroups")
			return
		}
		if found {
			c.JSON(http.StatusOK, cached)
			return
		}

		groups, err := engine.ListGroups(groupsCtx(c), w)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ListGroups")
			return
		}
		if err := saveGroupsToCache(svc.db, tenantID, w, groups); err != nil {
			log.Printf("[groups] bootstrap: saveGroupsToCache falhou (tenant %s, conexão %d): %v", tenantID, w.ID, err)
		}
		enrichContactsFromGroups(svc.db, tenantID, groups)

		out := make([]groupsListEntry, 0, len(groups))
		for _, g := range groups {
			out = append(out, groupsListEntry{GroupInfo: g, IsConnectionAdmin: connectionIsGroupAdmin(g.Participants, w.Number)})
		}
		c.JSON(http.StatusOK, out)
	}
}

func handleGetGroup(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		jid, ok := groupJIDParam(c, "id")
		if !ok {
			return
		}
		w, engine, err := svc.resolveConnectionFromQuery(c, tenantID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.GetGroup")
			return
		}
		group, err := engine.GetGroup(groupsCtx(c), w, jid)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.GetGroup")
			return
		}
		enrichContactsFromGroups(svc.db, tenantID, []domain.GroupInfo{*group})
		upsertOneGroupCache(svc.db, tenantID, w, *group)
		// Enrich participants AFTER caching the raw provider response —
		// Contact.Name/ProfilePicUrl can change independently of the group
		// cache and would go stale inside it; enrichment only ever happens
		// at read time, never persisted.
		group.Participants = enrichParticipantsFromContacts(svc.db, tenantID, group.Participants)
		c.JSON(http.StatusOK, group)
	}
}

func handleCreateGroup(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		var req createGroupRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		w, engine, err := svc.resolveConnection(c, tenantID, req.WhatsappID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.CreateGroup")
			return
		}
		if err := svc.checkThrottle(tenantID, req.WhatsappID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.CreateGroup")
			return
		}
		group, err := engine.CreateGroup(groupsCtx(c), w, req.Subject, req.Participants)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.CreateGroup")
			return
		}
		c.JSON(http.StatusCreated, group)
	}
}

func handleUpdateGroupSettings(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		jid, ok := groupJIDParam(c, "id")
		if !ok {
			return
		}
		var req updateGroupSettingsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		w, engine, err := svc.resolveConnection(c, tenantID, req.WhatsappID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.UpdateGroupSettings")
			return
		}
		if err := svc.checkThrottle(tenantID, req.WhatsappID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.UpdateGroupSettings")
			return
		}
		patch := domain.GroupSettingsPatch{
			Subject:       req.Subject,
			Description:   req.Description,
			PictureURL:    req.PictureURL,
			Announce:      req.Announce,
			Locked:        req.Locked,
			MemberAddMode: req.MemberAddMode,
		}
		if err := engine.UpdateGroupSettings(groupsCtx(c), w, jid, patch); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.UpdateGroupSettings")
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func handleGetInviteLink(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		jid, ok := groupJIDParam(c, "id")
		if !ok {
			return
		}
		w, engine, err := svc.resolveConnectionFromQuery(c, tenantID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.GetInviteLink")
			return
		}
		link, err := engine.GetInviteLink(groupsCtx(c), w, jid)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.GetInviteLink")
			return
		}
		c.JSON(http.StatusOK, gin.H{"link": link})
	}
}

func handleRevokeInviteLink(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		jid, ok := groupJIDParam(c, "id")
		if !ok {
			return
		}
		var req struct {
			WhatsappID int `json:"whatsappId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		w, engine, err := svc.resolveConnection(c, tenantID, req.WhatsappID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.RevokeInviteLink")
			return
		}
		if err := svc.checkThrottle(tenantID, req.WhatsappID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.RevokeInviteLink")
			return
		}
		link, err := engine.RevokeInviteLink(groupsCtx(c), w, jid)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.RevokeInviteLink")
			return
		}
		c.JSON(http.StatusOK, gin.H{"link": link})
	}
}

func handleLeaveGroup(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		jid, ok := groupJIDParam(c, "id")
		if !ok {
			return
		}
		var req struct {
			WhatsappID int `json:"whatsappId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		w, engine, err := svc.resolveConnection(c, tenantID, req.WhatsappID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.LeaveGroup")
			return
		}
		if err := svc.checkThrottle(tenantID, req.WhatsappID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.LeaveGroup")
			return
		}
		if err := engine.LeaveGroup(groupsCtx(c), w, jid); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.LeaveGroup")
			return
		}
		c.Status(http.StatusNoContent)
	}
}
