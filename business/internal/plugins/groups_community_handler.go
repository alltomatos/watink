package plugins

import (
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
)

// handleListCommunities has no dedicated GroupEngine method — a community
// IS a group (IsCommunity=true), so this filters ListGroups client-side.
//
// KNOWN GAP (engine-go/docs/groups-api.md, izapia.groupInfoFromDTO): the
// izapia provider currently can't populate IsCommunity (that field isn't
// returned by its group endpoints) — on an izapia connection this list is
// always empty today. Fixing it requires either an izapia API change
// upstream or a Watink-side heuristic (e.g. inferring from
// GetCommunity succeeding) — out of scope for this issue, tracked as a
// follow-up rather than silently shipped as "it just works".
func handleListCommunities(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		w, engine, err := svc.resolveConnectionFromQuery(c, tenantID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ListCommunities")
			return
		}
		groups, err := engine.ListGroups(groupsCtx(c), w)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.ListCommunities")
			return
		}
		communities := make([]domain.GroupInfo, 0, len(groups))
		for _, g := range groups {
			if g.IsCommunity {
				communities = append(communities, g)
			}
		}
		c.JSON(http.StatusOK, communities)
	}
}

func handleCreateCommunity(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		var req createCommunityRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		w, engine, err := svc.resolveConnection(c, tenantID, req.WhatsappID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.CreateCommunity")
			return
		}
		if err := svc.checkThrottle(tenantID, req.WhatsappID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.CreateCommunity")
			return
		}
		community, err := engine.CreateCommunity(groupsCtx(c), w, req.Name)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.CreateCommunity")
			return
		}
		c.JSON(http.StatusCreated, community)
	}
}

func handleGetCommunity(svc *groupsService) gin.HandlerFunc {
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
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.GetCommunity")
			return
		}
		community, err := engine.GetCommunity(groupsCtx(c), w, jid)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.GetCommunity")
			return
		}
		c.JSON(http.StatusOK, community)
	}
}

func handleLinkCommunityGroup(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		communityJID, ok := groupJIDParam(c, "id")
		if !ok {
			return
		}
		groupJID, ok := groupJIDParam(c, "groupId")
		if !ok {
			return
		}
		var req linkCommunityGroupRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		w, engine, err := svc.resolveConnection(c, tenantID, req.WhatsappID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.LinkCommunityGroup")
			return
		}
		if err := svc.checkThrottle(tenantID, req.WhatsappID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.LinkCommunityGroup")
			return
		}
		if err := engine.LinkGroupToCommunity(groupsCtx(c), w, communityJID, groupJID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.LinkCommunityGroup")
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func handleUnlinkCommunityGroup(svc *groupsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Whatsapps")
		if !ok {
			return
		}
		communityJID, ok := groupJIDParam(c, "id")
		if !ok {
			return
		}
		groupJID, ok := groupJIDParam(c, "groupId")
		if !ok {
			return
		}
		w, engine, err := svc.resolveConnectionFromQuery(c, tenantID)
		if err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.UnlinkCommunityGroup")
			return
		}
		whatsappIDRaw := c.Query("whatsappId")
		if err := svc.checkThrottleFromQuery(tenantID, whatsappIDRaw); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.UnlinkCommunityGroup")
			return
		}
		if err := engine.UnlinkGroupFromCommunity(groupsCtx(c), w, communityJID, groupJID); err != nil {
			utils.RespondWithFriendlyOrInternalError(c, err, "GroupsPlugin.UnlinkCommunityGroup")
			return
		}
		c.Status(http.StatusNoContent)
	}
}
