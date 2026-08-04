package groupsapi

import "net/http"

type createCommunityBody struct {
	TenantID string `json:"tenantId"`
	Name     string `json:"name"`
}

func handleCreateCommunity(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		var body createCommunityBody
		if !decodeJSON(w, r, &body) {
			return
		}
		if body.Name == "" {
			writeError(w, http.StatusBadRequest, CodeInvalidInput, "name is required")
			return
		}
		community, err := backend.CreateCommunity(sessionID, body.TenantID, body.Name)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusCreated, community)
	}
}

type linkCommunityGroupBody struct {
	TenantID string `json:"tenantId"`
}

func handleLinkCommunityGroup(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		communityJID := r.PathValue("communityJID")
		groupJID := r.PathValue("groupJID")
		var body linkCommunityGroupBody
		if !decodeJSON(w, r, &body) {
			return
		}
		if err := backend.LinkGroupToCommunity(sessionID, body.TenantID, communityJID, groupJID); err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, nil)
	}
}

func handleUnlinkCommunityGroup(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		communityJID := r.PathValue("communityJID")
		groupJID := r.PathValue("groupJID")
		var body linkCommunityGroupBody
		if !decodeJSON(w, r, &body) {
			return
		}
		if err := backend.UnlinkGroupFromCommunity(sessionID, body.TenantID, communityJID, groupJID); err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, nil)
	}
}
