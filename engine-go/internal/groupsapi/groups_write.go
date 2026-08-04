package groupsapi

import (
	"encoding/json"
	"net/http"

	"github.com/alltomatos/watinkdev/engine-go/internal/whatsapp"
)

// decodeJSON reads and decodes the request body, writing a 400
// INVALID_INPUT response and returning ok=false on any failure.
func decodeJSON(w http.ResponseWriter, r *http.Request, out interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(out); err != nil {
		writeError(w, http.StatusBadRequest, CodeInvalidInput, "invalid JSON body: "+err.Error())
		return false
	}
	return true
}

type createGroupBody struct {
	TenantID     string   `json:"tenantId"`
	Subject      string   `json:"subject"`
	Participants []string `json:"participants"`
}

func handleCreateGroup(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		var body createGroupBody
		if !decodeJSON(w, r, &body) {
			return
		}
		if body.Subject == "" {
			writeError(w, http.StatusBadRequest, CodeInvalidInput, "subject is required")
			return
		}
		group, err := backend.CreateGroup(sessionID, body.TenantID, body.Subject, body.Participants)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusCreated, group)
	}
}

type updateParticipantsBody struct {
	TenantID     string   `json:"tenantId"`
	Action       string   `json:"action"`
	Participants []string `json:"participants"`
}

func handleUpdateParticipants(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groupJID := r.PathValue("groupJID")
		var body updateParticipantsBody
		if !decodeJSON(w, r, &body) {
			return
		}
		if len(body.Participants) == 0 {
			writeError(w, http.StatusBadRequest, CodeInvalidInput, "participants must not be empty")
			return
		}
		results, err := backend.UpdateParticipants(sessionID, body.TenantID, groupJID, body.Action, body.Participants)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, map[string]interface{}{"participants": results})
	}
}

// updateGroupSettingsBody's wire field names MUST match exactly what
// business/internal/infrastructure/enginego/groups.go (#520, already
// shipped) sends in a single PUT body — "pictureURL" carries base64 image
// data despite the name (see whatsapp.decodeBase64Image's doc comment);
// renaming here without updating that provider would silently break every
// photo update on enginego connections.
type updateGroupSettingsBody struct {
	TenantID      string  `json:"tenantId"`
	Subject       *string `json:"subject"`
	Description   *string `json:"description"`
	PictureURL    *string `json:"pictureURL"`
	Announce      *bool   `json:"announce"`
	Locked        *bool   `json:"locked"`
	MemberAddMode *string `json:"memberAddMode"`
}

// handleUpdateGroupSettings covers subject/description/announce/locked/
// memberAddMode/picture as a single PUT — one payload, applied field by
// field on the whatsapp-package side (groups_write.go).
func handleUpdateGroupSettings(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groupJID := r.PathValue("groupJID")
		var body updateGroupSettingsBody
		if !decodeJSON(w, r, &body) {
			return
		}
		payload := whatsapp.UpdateGroupSettingsPayload{
			Subject:       body.Subject,
			Description:   body.Description,
			PictureBase64: body.PictureURL,
			Announce:      body.Announce,
			Locked:        body.Locked,
			MemberAddMode: body.MemberAddMode,
		}
		if err := backend.UpdateGroupSettings(sessionID, body.TenantID, groupJID, payload); err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, nil)
	}
}

func handleGetInviteLink(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groupJID := r.PathValue("groupJID")
		link, err := backend.GetInviteLink(sessionID, groupJID)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, map[string]string{"link": link})
	}
}

type revokeInviteBody struct {
	TenantID string `json:"tenantId"`
}

func handleRevokeInviteLink(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groupJID := r.PathValue("groupJID")
		var body revokeInviteBody
		if !decodeJSON(w, r, &body) {
			return
		}
		link, err := backend.RevokeInviteLink(sessionID, body.TenantID, groupJID)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, map[string]string{"link": link})
	}
}

type leaveGroupBody struct {
	TenantID string `json:"tenantId"`
}

func handleLeaveGroup(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groupJID := r.PathValue("groupJID")
		var body leaveGroupBody
		if !decodeJSON(w, r, &body) {
			return
		}
		if err := backend.LeaveGroup(sessionID, body.TenantID, groupJID); err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, nil)
	}
}

type joinApprovalModeBody struct {
	TenantID string `json:"tenantId"`
	Enabled  bool   `json:"enabled"`
}

func handleSetJoinApprovalMode(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groupJID := r.PathValue("groupJID")
		var body joinApprovalModeBody
		if !decodeJSON(w, r, &body) {
			return
		}
		if err := backend.SetJoinApprovalMode(sessionID, body.TenantID, groupJID, body.Enabled); err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, nil)
	}
}

func handleListJoinRequests(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groupJID := r.PathValue("groupJID")
		requests, err := backend.ListJoinRequests(sessionID, groupJID)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, requests)
	}
}

type resolveJoinRequestsBody struct {
	TenantID     string   `json:"tenantId"`
	Action       string   `json:"action"`
	Participants []string `json:"participants"`
}

func handleResolveJoinRequests(backend Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		groupJID := r.PathValue("groupJID")
		var body resolveJoinRequestsBody
		if !decodeJSON(w, r, &body) {
			return
		}
		if len(body.Participants) == 0 {
			writeError(w, http.StatusBadRequest, CodeInvalidInput, "participants must not be empty")
			return
		}
		results, err := backend.ResolveJoinRequests(sessionID, body.TenantID, groupJID, body.Action, body.Participants)
		if err != nil {
			mapBackendError(w, err)
			return
		}
		writeData(w, http.StatusOK, map[string]interface{}{"participants": results})
	}
}
