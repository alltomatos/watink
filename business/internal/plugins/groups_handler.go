package plugins

import (
	"net/http"
	"net/url"

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
		c.JSON(http.StatusOK, groups)
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
