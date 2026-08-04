package plugins

import (
	"net/http"

	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
)

// handleUpdateParticipants covers add/remove/promote/demote — the highest
// anti-ban risk action, hence gated by whatsappGroups:admin (not manage)
// and always throttled. Response is always the per-participant
// []ParticipantResult, never collapsed into a single boolean (plan §6.5 —
// a bulk action must be rendered item-by-item, never "success" generically).
func handleUpdateParticipants(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		jid, ok := groupJIDParam(c, "id")
		if !ok {
			return
		}
		var req updateParticipantsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		w, engine, err := svc.resolveConnection(c, tenantID, req.WhatsappID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.UpdateParticipants")
			return
		}
		if err := svc.checkThrottle(tenantID, req.WhatsappID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.UpdateParticipants")
			return
		}
		results, err := engine.UpdateParticipants(groupsCtx(c), w, jid, req.Action, req.Participants)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.UpdateParticipants")
			return
		}
		c.JSON(http.StatusOK, gin.H{"participants": results})
	}
}

func handleListJoinRequests(svc *groupsService) gin.HandlerFunc {
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
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ListJoinRequests")
			return
		}
		requests, err := engine.ListJoinRequests(groupsCtx(c), w, jid)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ListJoinRequests")
			return
		}
		c.JSON(http.StatusOK, requests)
	}
}

func handleResolveJoinRequests(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		jid, ok := groupJIDParam(c, "id")
		if !ok {
			return
		}
		var req resolveJoinRequestsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		w, engine, err := svc.resolveConnection(c, tenantID, req.WhatsappID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ResolveJoinRequests")
			return
		}
		if err := svc.checkThrottle(tenantID, req.WhatsappID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ResolveJoinRequests")
			return
		}
		results, err := engine.ResolveJoinRequests(groupsCtx(c), w, jid, req.Action, req.Participants)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ResolveJoinRequests")
			return
		}
		c.JSON(http.StatusOK, gin.H{"participants": results})
	}
}
