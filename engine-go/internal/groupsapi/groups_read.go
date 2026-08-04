package groupsapi

import (
	"net/http"
	"strconv"
)

// newMux wires every route this package exposes. Every WRITE route (POST/
// PUT — never GET) is wrapped in withThrottle: defense-in-depth rate
// limiting (T1.4) so a single session can't hammer whatsmeow even if the
// business-side limiter (the primary one, #521) is ever bypassed.
func newMux(backend Backend, th *throttle) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /sessions/{sessionID}/groups", handleListGroups(backend))
	mux.HandleFunc("GET /sessions/{sessionID}/groups/{groupJID}", handleGetGroup(backend))
	mux.HandleFunc("GET /sessions/{sessionID}/communities/{communityJID}", handleGetCommunity(backend))

	mux.HandleFunc("POST /sessions/{sessionID}/groups", withThrottle(th, handleCreateGroup(backend)))
	mux.HandleFunc("POST /sessions/{sessionID}/groups/{groupJID}/participants", withThrottle(th, handleUpdateParticipants(backend)))
	mux.HandleFunc("PUT /sessions/{sessionID}/groups/{groupJID}", withThrottle(th, handleUpdateGroupSettings(backend)))
	mux.HandleFunc("GET /sessions/{sessionID}/groups/{groupJID}/invite", handleGetInviteLink(backend))
	mux.HandleFunc("POST /sessions/{sessionID}/groups/{groupJID}/invite/revoke", withThrottle(th, handleRevokeInviteLink(backend)))
	mux.HandleFunc("POST /sessions/{sessionID}/groups/{groupJID}/leave", withThrottle(th, handleLeaveGroup(backend)))
	mux.HandleFunc("POST /sessions/{sessionID}/groups/{groupJID}/join-approval-mode", withThrottle(th, handleSetJoinApprovalMode(backend)))
	mux.HandleFunc("GET /sessions/{sessionID}/groups/{groupJID}/join-requests", handleListJoinRequests(backend))
	mux.HandleFunc("POST /sessions/{sessionID}/groups/{groupJID}/join-requests", withThrottle(th, handleResolveJoinRequests(backend)))

	mux.HandleFunc("POST /sessions/{sessionID}/communities", withThrottle(th, handleCreateCommunity(backend)))
	mux.HandleFunc("POST /sessions/{sessionID}/communities/{communityJID}/groups/{groupJID}", withThrottle(th, handleLinkCommunityGroup(backend)))
	mux.HandleFunc("POST /sessions/{sessionID}/communities/{communityJID}/groups/{groupJID}/remove", withThrottle(th, handleUnlinkCommunityGroup(backend)))

	return mux
}

// parseSessionID extracts and validates the {sessionID} path param, writing
// a 400 INVALID_INPUT response and returning ok=false if it's not a
// positive integer.
func parseSessionID(w http.ResponseWriter, r *http.Request) (int, bool) {
	raw := r.PathValue("sessionID")
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, CodeInvalidInput, "sessionID must be a positive integer")
		return 0, false
	}
	return id, true
}

func handleListGroups(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groups, err := backend.ListGroups(sessionID)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, groups)
	}
}

func handleGetGroup(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groupJID := r.PathValue("groupJID")
		if groupJID == "" {
			writeError(w, http.StatusBadRequest, CodeInvalidInput, "groupJID is required")
			return
		}
		group, err := backend.GetGroup(sessionID, groupJID)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, group)
	}
}

func handleGetCommunity(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		communityJID := r.PathValue("communityJID")
		if communityJID == "" {
			writeError(w, http.StatusBadRequest, CodeInvalidInput, "communityJID is required")
			return
		}
		community, err := backend.GetCommunity(sessionID, communityJID)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, community)
	}
}
