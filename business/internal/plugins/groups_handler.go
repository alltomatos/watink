package plugins

import (
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

// connectionIsGroupAdmin varre Participants em busca de um JID cujo número
// bata com o da conexão (mesmo split usado em usecases.jidNumber: parte
// antes de "@", depois antes de ":", já que whatsmeow anexa o device ID
// nesse formato) e devolve o IsAdmin desse participante. Sem match (número
// não está listado nos participantes -- não deveria acontecer para um grupo
// em que a conexão está, mas dado de terceiro nunca é garantia), o
// fail-safe é false: nunca assumir admin sem confirmação explícita.
func connectionIsGroupAdmin(participants []domain.Participant, connectionNumber string) bool {
	for _, p := range participants {
		local := strings.SplitN(p.JID, "@", 2)[0]
		local = strings.SplitN(local, ":", 2)[0]
		if local == connectionNumber {
			return p.IsAdmin
		}
	}
	return false
}

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
		groups, err := engine.ListGroups(groupsCtx(c), w)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ListGroups")
			return
		}
		out := make([]groupsListEntry, 0, len(groups))
		for _, g := range groups {
			out = append(out, groupsListEntry{GroupInfo: g, IsConnectionAdmin: connectionIsGroupAdmin(g.Participants, w.Number)})
		}
		enrichContactsFromGroups(svc.db, tenantID, groups)
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
