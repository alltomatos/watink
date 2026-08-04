package enginego

import (
	"context"
	"net/http"
	"net/url"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
)

var _ domain.GroupEngine = (*Provider)(nil)

// domain.GroupInfo/Participant/ParticipantResult/JoinRequest/CommunityInfo
// share EXACTLY the same JSON tags as their engine-go counterparts
// (engine-go/internal/whatsapp/groups_dto.go) — both were derived from the
// same T0.1 contract (engine-go/docs/groups-api.md), so responses unmarshal
// straight into the domain types without an intermediate DTO layer. This is
// deliberate: it's what "code-mirror" (groups-api.md) actually buys us.

func (p *Provider) ListGroups(ctx context.Context, w models.Whatsapp) ([]domain.GroupInfo, error) {
	var out []domain.GroupInfo
	if err := groupsDo(ctx, http.MethodGet, sessionGroupsPath(w.ID), nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (p *Provider) GetGroup(ctx context.Context, w models.Whatsapp, groupJID string) (*domain.GroupInfo, error) {
	var out domain.GroupInfo
	if err := groupsDo(ctx, http.MethodGet, sessionGroupItemPath(w.ID, groupJID), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (p *Provider) CreateGroup(ctx context.Context, w models.Whatsapp, subject string, participants []string) (*domain.GroupInfo, error) {
	body := map[string]interface{}{"tenantId": w.TenantID.String(), "subject": subject, "participants": participants}
	var out domain.GroupInfo
	if err := groupsDo(ctx, http.MethodPost, sessionGroupsPath(w.ID), body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (p *Provider) UpdateParticipants(ctx context.Context, w models.Whatsapp, groupJID string, action string, participants []string) ([]domain.ParticipantResult, error) {
	body := map[string]interface{}{"tenantId": w.TenantID.String(), "action": action, "participants": participants}
	var out struct {
		Participants []domain.ParticipantResult `json:"participants"`
	}
	if err := groupsDo(ctx, http.MethodPost, sessionGroupItemPath(w.ID, groupJID)+"/participants", body, &out); err != nil {
		return nil, err
	}
	return out.Participants, nil
}

// UpdateGroupSettings, unlike izapia.Provider's one-endpoint-per-field
// chain, is a single PUT with only the changed fields — no
// "which sub-call failed" ambiguity possible here.
func (p *Provider) UpdateGroupSettings(ctx context.Context, w models.Whatsapp, groupJID string, patch domain.GroupSettingsPatch) error {
	body := map[string]interface{}{"tenantId": w.TenantID.String()}
	if patch.Subject != nil {
		body["subject"] = *patch.Subject
	}
	if patch.Description != nil {
		body["description"] = *patch.Description
	}
	if patch.PictureURL != nil {
		body["pictureURL"] = *patch.PictureURL
	}
	if patch.Announce != nil {
		body["announce"] = *patch.Announce
	}
	if patch.Locked != nil {
		body["locked"] = *patch.Locked
	}
	if patch.MemberAddMode != nil {
		body["memberAddMode"] = *patch.MemberAddMode
	}
	return groupsDo(ctx, http.MethodPut, sessionGroupItemPath(w.ID, groupJID), body, nil)
}

func (p *Provider) GetInviteLink(ctx context.Context, w models.Whatsapp, groupJID string) (string, error) {
	var out struct {
		Link string `json:"link"`
	}
	if err := groupsDo(ctx, http.MethodGet, sessionGroupItemPath(w.ID, groupJID)+"/invite", nil, &out); err != nil {
		return "", err
	}
	return out.Link, nil
}

func (p *Provider) RevokeInviteLink(ctx context.Context, w models.Whatsapp, groupJID string) (string, error) {
	body := map[string]interface{}{"tenantId": w.TenantID.String()}
	var out struct {
		Link string `json:"link"`
	}
	if err := groupsDo(ctx, http.MethodPost, sessionGroupItemPath(w.ID, groupJID)+"/invite/revoke", body, &out); err != nil {
		return "", err
	}
	return out.Link, nil
}

func (p *Provider) LeaveGroup(ctx context.Context, w models.Whatsapp, groupJID string) error {
	body := map[string]interface{}{"tenantId": w.TenantID.String()}
	return groupsDo(ctx, http.MethodPost, sessionGroupItemPath(w.ID, groupJID)+"/leave", body, nil)
}

func (p *Provider) SetJoinApprovalMode(ctx context.Context, w models.Whatsapp, groupJID string, enabled bool) error {
	body := map[string]interface{}{"tenantId": w.TenantID.String(), "enabled": enabled}
	return groupsDo(ctx, http.MethodPost, sessionGroupItemPath(w.ID, groupJID)+"/join-approval-mode", body, nil)
}

func (p *Provider) ListJoinRequests(ctx context.Context, w models.Whatsapp, groupJID string) ([]domain.JoinRequest, error) {
	var out []domain.JoinRequest
	if err := groupsDo(ctx, http.MethodGet, sessionGroupItemPath(w.ID, groupJID)+"/join-requests", nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (p *Provider) ResolveJoinRequests(ctx context.Context, w models.Whatsapp, groupJID string, action string, participants []string) ([]domain.ParticipantResult, error) {
	body := map[string]interface{}{"tenantId": w.TenantID.String(), "action": action, "participants": participants}
	var out struct {
		Participants []domain.ParticipantResult `json:"participants"`
	}
	if err := groupsDo(ctx, http.MethodPost, sessionGroupItemPath(w.ID, groupJID)+"/join-requests", body, &out); err != nil {
		return nil, err
	}
	return out.Participants, nil
}

func (p *Provider) CreateCommunity(ctx context.Context, w models.Whatsapp, name string) (*domain.CommunityInfo, error) {
	body := map[string]interface{}{"tenantId": w.TenantID.String(), "name": name}
	var out domain.CommunityInfo
	if err := groupsDo(ctx, http.MethodPost, sessionCommunitiesPath(w.ID), body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (p *Provider) GetCommunity(ctx context.Context, w models.Whatsapp, communityJID string) (*domain.CommunityInfo, error) {
	var out domain.CommunityInfo
	if err := groupsDo(ctx, http.MethodGet, sessionCommunityItemPath(w.ID, communityJID), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (p *Provider) LinkGroupToCommunity(ctx context.Context, w models.Whatsapp, communityJID, groupJID string) error {
	path := sessionCommunityItemPath(w.ID, communityJID) + "/groups/" + url.PathEscape(groupJID)
	body := map[string]interface{}{"tenantId": w.TenantID.String()}
	return groupsDo(ctx, http.MethodPost, path, body, nil)
}

func (p *Provider) UnlinkGroupFromCommunity(ctx context.Context, w models.Whatsapp, communityJID, groupJID string) error {
	path := sessionCommunityItemPath(w.ID, communityJID) + "/groups/" + url.PathEscape(groupJID) + "/remove"
	body := map[string]interface{}{"tenantId": w.TenantID.String()}
	return groupsDo(ctx, http.MethodPost, path, body, nil)
}
