package whatsapp

import (
	"context"
	"encoding/base64"
	"fmt"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

// decodeBase64Image decodes the base64-encoded image payload sent by the
// business side for group photo updates — GroupSettingsPatch.PictureURL is
// named after the READ-side field (a CDN URL, once whatsmeow uploads it),
// but on WRITE it carries the raw image as base64 (same convention as the
// izapia provider's client_groups.go SetGroupPhoto "image" field).
func decodeBase64Image(encoded string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid base64 image: %v", ErrInvalidInput, err)
	}
	return raw, nil
}

// Write methods (T1.2, plan §4 trilho A) take tenantID (unlike the read
// methods in groups.go) because a write failure may need to route through
// classifyGroupWriteError → reportIfRiskSignal, which emits a
// "session.risk" event scoped to the tenant (same as every other risk
// report in this service — see risk.go). The internal groups HTTP API has
// no other source of tenantID (there's no per-tenant auth on this
// docker-internal endpoint, only the session ID) — the business-side
// enginego.Provider sends it in the request body of every write call.

// CreateGroup creates a new WhatsApp group with the given subject and
// initial participants.
func (s *WhatsAppService) CreateGroup(sessionID int, tenantID, subject string, participants []string) (*GroupInfo, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return nil, err
	}
	jids, err := parseJIDs(participants)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	g, err := client.CreateGroup(context.Background(), whatsmeow.ReqCreateGroup{
		Name:         subject,
		Participants: jids,
	})
	if err != nil {
		return nil, s.classifyGroupWriteError(sessionID, tenantID, "groups.create", err)
	}
	info := groupInfoFromWhatsmeow(g)
	return &info, nil
}

// UpdateParticipants adds/removes/promotes/demotes participants. action
// must be one of "add"|"remove"|"promote"|"demote". Returns per-participant
// results — WhatsApp can partially fail a batch (e.g. one number not on
// WhatsApp), so this NEVER collapses into a single error for a partial
// failure; only a request-level failure (session down, invalid action)
// returns an error.
func (s *WhatsAppService) UpdateParticipants(sessionID int, tenantID, groupJID, action string, participants []string) ([]ParticipantResult, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return nil, err
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	change, ok := participantChangeFromString(action)
	if !ok {
		return nil, fmt.Errorf("%w: unknown action %q", ErrInvalidInput, action)
	}
	jids, err := parseJIDs(participants)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	results, err := client.UpdateGroupParticipants(context.Background(), jid, jids, change)
	if err != nil {
		return nil, s.classifyGroupWriteError(sessionID, tenantID, "groups.participants."+action, err)
	}
	return participantResultsFromWhatsmeow(results), nil
}

// UpdateGroupSettingsPayload mirrors domain.GroupSettingsPatch (business
// side) — only non-nil fields are applied, one whatsmeow call per field
// present (whatsmeow has no combined "update everything" call).
type UpdateGroupSettingsPayload struct {
	Subject       *string
	Description   *string
	PictureBase64 *string
	Announce      *bool
	Locked        *bool
	MemberAddMode *string
}

// UpdateGroupSettings applies every non-nil field of payload, in a fixed
// order. Stops at the first failure — the caller (HTTP handler) sees
// exactly which field failed via the wrapped error, same contract as
// izapia.Provider.UpdateGroupSettings on the business side.
func (s *WhatsAppService) UpdateGroupSettings(sessionID int, tenantID, groupJID string, payload UpdateGroupSettingsPayload) error {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return err
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	ctx := context.Background()

	if payload.Subject != nil {
		if err := client.SetGroupName(ctx, jid, *payload.Subject); err != nil {
			return fmt.Errorf("subject: %w", s.classifyGroupWriteError(sessionID, tenantID, "groups.subject", err))
		}
	}
	if payload.Description != nil {
		if err := client.SetGroupTopic(ctx, jid, "", "", *payload.Description); err != nil {
			return fmt.Errorf("description: %w", s.classifyGroupWriteError(sessionID, tenantID, "groups.description", err))
		}
	}
	if payload.Announce != nil {
		if err := client.SetGroupAnnounce(ctx, jid, *payload.Announce); err != nil {
			return fmt.Errorf("announce: %w", s.classifyGroupWriteError(sessionID, tenantID, "groups.announce", err))
		}
	}
	if payload.Locked != nil {
		if err := client.SetGroupLocked(ctx, jid, *payload.Locked); err != nil {
			return fmt.Errorf("locked: %w", s.classifyGroupWriteError(sessionID, tenantID, "groups.locked", err))
		}
	}
	if payload.MemberAddMode != nil {
		if err := client.SetGroupMemberAddMode(ctx, jid, types.GroupMemberAddMode(*payload.MemberAddMode)); err != nil {
			return fmt.Errorf("memberAddMode: %w", s.classifyGroupWriteError(sessionID, tenantID, "groups.memberAddMode", err))
		}
	}
	if payload.PictureBase64 != nil {
		raw, err := decodeBase64Image(*payload.PictureBase64)
		if err != nil {
			return fmt.Errorf("picture: %w", err)
		}
		if _, err := client.SetGroupPhoto(ctx, jid, raw); err != nil {
			return fmt.Errorf("picture: %w", s.classifyGroupWriteError(sessionID, tenantID, "groups.picture", err))
		}
	}
	return nil
}

// GetInviteLink returns the group's current invite link (creating one if
// none exists yet).
func (s *WhatsAppService) GetInviteLink(sessionID int, groupJID string) (string, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return "", err
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	link, err := client.GetGroupInviteLink(context.Background(), jid, false)
	if err != nil {
		// tenantID vazio é seguro aqui: classifyGroupWriteError só o usa no
		// branch de risco (401/429/463) do reportIfRiskSignal -- o request
		// GET desta rota (ao contrário de RevokeInviteLink) não carrega
		// tenantId no corpo, então não há de onde tirar um valor real.
		return "", s.classifyGroupWriteError(sessionID, "", "groups.invite.get", err)
	}
	return link, nil
}

// RevokeInviteLink invalidates the current invite link and returns the new one.
func (s *WhatsAppService) RevokeInviteLink(sessionID int, tenantID, groupJID string) (string, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return "", err
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	link, err := client.GetGroupInviteLink(context.Background(), jid, true)
	if err != nil {
		return "", s.classifyGroupWriteError(sessionID, tenantID, "groups.invite.revoke", err)
	}
	return link, nil
}

// LeaveGroup makes the connected session leave the group.
func (s *WhatsAppService) LeaveGroup(sessionID int, tenantID, groupJID string) error {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return err
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	if err := client.LeaveGroup(context.Background(), jid); err != nil {
		return s.classifyGroupWriteError(sessionID, tenantID, "groups.leave", err)
	}
	return nil
}

// SetJoinApprovalMode toggles whether new members need admin approval to join.
func (s *WhatsAppService) SetJoinApprovalMode(sessionID int, tenantID, groupJID string, enabled bool) error {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return err
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	if err := client.SetGroupJoinApprovalMode(context.Background(), jid, enabled); err != nil {
		return s.classifyGroupWriteError(sessionID, tenantID, "groups.joinApprovalMode", err)
	}
	return nil
}

// ListJoinRequests returns pending join requests for a group with
// join-approval-mode enabled.
func (s *WhatsAppService) ListJoinRequests(sessionID int, groupJID string) ([]JoinRequestEntry, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return nil, err
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	requests, err := client.GetGroupRequestParticipants(context.Background(), jid)
	if err != nil {
		return nil, fmt.Errorf("list join requests: %w", err)
	}
	out := make([]JoinRequestEntry, 0, len(requests))
	for _, r := range requests {
		out = append(out, JoinRequestEntry{JID: r.JID.String(), RequestedAt: r.RequestedAt.Unix()})
	}
	return out, nil
}

// ResolveJoinRequests approves or rejects pending join requests. action
// must be "approve"|"reject".
func (s *WhatsAppService) ResolveJoinRequests(sessionID int, tenantID, groupJID, action string, participants []string) ([]ParticipantResult, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return nil, err
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	change, ok := participantRequestChangeFromString(action)
	if !ok {
		return nil, fmt.Errorf("%w: unknown action %q", ErrInvalidInput, action)
	}
	jids, err := parseJIDs(participants)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	results, err := client.UpdateGroupRequestParticipants(context.Background(), jid, jids, change)
	if err != nil {
		return nil, s.classifyGroupWriteError(sessionID, tenantID, "groups.joinRequests."+action, err)
	}
	return participantResultsFromWhatsmeow(results), nil
}

func parseJIDs(raw []string) ([]types.JID, error) {
	out := make([]types.JID, 0, len(raw))
	for _, r := range raw {
		jid, err := types.ParseJID(r)
		if err != nil {
			return nil, fmt.Errorf("%q: %w", r, err)
		}
		out = append(out, jid)
	}
	return out, nil
}

func participantChangeFromString(action string) (whatsmeow.ParticipantChange, bool) {
	switch action {
	case "add":
		return whatsmeow.ParticipantChangeAdd, true
	case "remove":
		return whatsmeow.ParticipantChangeRemove, true
	case "promote":
		return whatsmeow.ParticipantChangePromote, true
	case "demote":
		return whatsmeow.ParticipantChangeDemote, true
	default:
		return "", false
	}
}

func participantRequestChangeFromString(action string) (whatsmeow.ParticipantRequestChange, bool) {
	switch action {
	case "approve":
		return whatsmeow.ParticipantChangeApprove, true
	case "reject":
		return whatsmeow.ParticipantChangeReject, true
	default:
		return "", false
	}
}

func participantResultsFromWhatsmeow(participants []types.GroupParticipant) []ParticipantResult {
	out := make([]ParticipantResult, 0, len(participants))
	for _, p := range participants {
		result := ParticipantResult{JID: p.JID.String(), Status: "ok"}
		if p.Error != 0 {
			result.Status = "error"
			result.Error = fmt.Sprintf("whatsapp error code %d", p.Error)
		}
		out = append(out, result)
	}
	return out
}
