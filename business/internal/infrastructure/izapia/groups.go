package izapia

import (
	"context"
	"fmt"
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
)

var _ domain.GroupEngine = (*Provider)(nil)

// sidFor resolves w.IzapiaSessionID, or a friendly, actionable error —
// same message shape as clientFor (provider.go:77-84), reused by every
// method below.
func (p *Provider) sidFor(w models.Whatsapp) (string, error) {
	if w.IzapiaSessionID == nil || *w.IzapiaSessionID == "" {
		return "", utils.NewFriendlyError(http.StatusUnprocessableEntity,
			"Esta conexão ainda não tem uma sessão izapia ativa.",
			fmt.Errorf("izapia: conexão %d sem sessão izapia ativa", w.ID))
	}
	return *w.IzapiaSessionID, nil
}

func groupInfoFromDTO(g groupDTO) domain.GroupInfo {
	info := domain.GroupInfo{
		JID:          g.GroupID,
		Subject:      g.Subject,
		Description:  g.Description,
		Owner:        g.Owner,
		CreatedAt:    g.Created,
		Participants: make([]domain.Participant, 0, len(g.Participants)),
	}
	// announce/locked/memberAddMode/joinApprovalMode/pictureURL/isCommunity/
	// isSubGroup/parentJID are NOT returned by the izapia group endpoints
	// (see client_groups.go groupDTO doc + engine-go/docs/groups-api.md) —
	// left at zero-value. Known upstream gap, not a mapping bug.
	for _, part := range g.Participants {
		info.Participants = append(info.Participants, domain.Participant{
			JID:          part.JID,
			IsAdmin:      part.IsAdmin,
			IsSuperAdmin: part.IsSuperAdmin,
		})
	}
	return info
}

func participantResultsFromDTO(results []participantResultDTO) []domain.ParticipantResult {
	out := make([]domain.ParticipantResult, 0, len(results))
	for _, r := range results {
		out = append(out, domain.ParticipantResult{JID: r.JID, Status: r.Status, Error: r.Error})
	}
	return out
}

func (p *Provider) ListGroups(ctx context.Context, w models.Whatsapp) ([]domain.GroupInfo, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return nil, err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return nil, err
	}
	groups, err := client.ListGroups(ctx, sid)
	if err != nil {
		return nil, err
	}
	out := make([]domain.GroupInfo, 0, len(groups))
	for _, g := range groups {
		out = append(out, groupInfoFromDTO(g))
	}
	return out, nil
}

func (p *Provider) GetGroup(ctx context.Context, w models.Whatsapp, groupJID string) (*domain.GroupInfo, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return nil, err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return nil, err
	}
	g, err := client.GetGroup(ctx, sid, groupJID)
	if err != nil {
		return nil, err
	}
	info := groupInfoFromDTO(*g)
	return &info, nil
}

func (p *Provider) CreateGroup(ctx context.Context, w models.Whatsapp, subject string, participants []string) (*domain.GroupInfo, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return nil, err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return nil, err
	}
	g, err := client.CreateGroup(ctx, sid, subject, participants)
	if err != nil {
		return nil, err
	}
	info := groupInfoFromDTO(*g)
	return &info, nil
}

func (p *Provider) UpdateParticipants(ctx context.Context, w models.Whatsapp, groupJID string, action string, participants []string) ([]domain.ParticipantResult, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return nil, err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return nil, err
	}
	results, err := client.UpdateGroupParticipants(ctx, sid, groupJID, action, participants)
	if err != nil {
		return nil, err
	}
	return participantResultsFromDTO(results), nil
}

func (p *Provider) UpdateGroupSettings(ctx context.Context, w models.Whatsapp, groupJID string, patch domain.GroupSettingsPatch) error {
	sid, err := p.sidFor(w)
	if err != nil {
		return err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	// izapia has one endpoint per field (no combined PATCH) — apply each
	// field present in the patch sequentially. First error stops the chain;
	// caller sees exactly which field failed via the wrapped izapia error.
	if patch.Subject != nil {
		if err := client.SetGroupSubject(ctx, sid, groupJID, *patch.Subject); err != nil {
			return fmt.Errorf("subject: %w", err)
		}
	}
	if patch.Description != nil {
		if err := client.SetGroupDescription(ctx, sid, groupJID, *patch.Description); err != nil {
			return fmt.Errorf("description: %w", err)
		}
	}
	if patch.PictureURL != nil {
		if err := client.SetGroupPhoto(ctx, sid, groupJID, *patch.PictureURL); err != nil {
			return fmt.Errorf("picture: %w", err)
		}
	}
	if patch.Announce != nil {
		if err := client.SetGroupAnnounce(ctx, sid, groupJID, *patch.Announce); err != nil {
			return fmt.Errorf("announce: %w", err)
		}
	}
	if patch.Locked != nil {
		if err := client.SetGroupLocked(ctx, sid, groupJID, *patch.Locked); err != nil {
			return fmt.Errorf("locked: %w", err)
		}
	}
	if patch.MemberAddMode != nil {
		if err := client.SetGroupMemberAddMode(ctx, sid, groupJID, *patch.MemberAddMode); err != nil {
			return fmt.Errorf("memberAddMode: %w", err)
		}
	}
	return nil
}

func (p *Provider) GetInviteLink(ctx context.Context, w models.Whatsapp, groupJID string) (string, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return "", err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return "", err
	}
	return client.GetGroupInvite(ctx, sid, groupJID)
}

func (p *Provider) RevokeInviteLink(ctx context.Context, w models.Whatsapp, groupJID string) (string, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return "", err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return "", err
	}
	return client.RevokeGroupInvite(ctx, sid, groupJID)
}

func (p *Provider) LeaveGroup(ctx context.Context, w models.Whatsapp, groupJID string) error {
	sid, err := p.sidFor(w)
	if err != nil {
		return err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	return client.LeaveGroup(ctx, sid, groupJID)
}

func (p *Provider) SetJoinApprovalMode(ctx context.Context, w models.Whatsapp, groupJID string, enabled bool) error {
	sid, err := p.sidFor(w)
	if err != nil {
		return err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	return client.SetGroupJoinApprovalMode(ctx, sid, groupJID, enabled)
}

func (p *Provider) ListJoinRequests(ctx context.Context, w models.Whatsapp, groupJID string) ([]domain.JoinRequest, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return nil, err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return nil, err
	}
	requests, err := client.ListGroupJoinRequests(ctx, sid, groupJID)
	if err != nil {
		return nil, err
	}
	out := make([]domain.JoinRequest, 0, len(requests))
	for _, r := range requests {
		out = append(out, domain.JoinRequest{JID: r.JID, RequestedAt: r.RequestedAt})
	}
	return out, nil
}

func (p *Provider) ResolveJoinRequests(ctx context.Context, w models.Whatsapp, groupJID string, action string, participants []string) ([]domain.ParticipantResult, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return nil, err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return nil, err
	}
	results, err := client.UpdateGroupJoinRequests(ctx, sid, groupJID, action, participants)
	if err != nil {
		return nil, err
	}
	return participantResultsFromDTO(results), nil
}

func (p *Provider) CreateCommunity(ctx context.Context, w models.Whatsapp, name string) (*domain.CommunityInfo, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return nil, err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return nil, err
	}
	c, err := client.CreateCommunity(ctx, sid, name)
	if err != nil {
		return nil, err
	}
	info := domain.GroupInfo{
		JID:         c.CommunityID,
		Subject:     c.Subject,
		Description: c.Description,
		Owner:       c.Owner,
		IsCommunity: true,
		CreatedAt:   c.Created,
	}
	for _, part := range c.Participants {
		info.Participants = append(info.Participants, domain.Participant{JID: part.JID, IsAdmin: part.IsAdmin, IsSuperAdmin: part.IsSuperAdmin})
	}
	return &domain.CommunityInfo{GroupInfo: info}, nil
}

// GetCommunity — the izapia detail endpoint's shape (communityDetailDTO) has
// NO top-level subject/owner/description at all, and participants is a flat
// []string of JIDs, not objects with admin flags (confirmed live, see
// client_groups.go doc comment). GroupInfo.Subject/Owner/Description are
// left empty here; callers needing those must fall back to a prior
// CreateCommunity/ListGroups result — this is what the API actually
// returns, not a mapping gap.
func (p *Provider) GetCommunity(ctx context.Context, w models.Whatsapp, communityJID string) (*domain.CommunityInfo, error) {
	sid, err := p.sidFor(w)
	if err != nil {
		return nil, err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return nil, err
	}
	c, err := client.GetCommunity(ctx, sid, communityJID)
	if err != nil {
		return nil, err
	}
	info := domain.GroupInfo{JID: communityJID, IsCommunity: true}
	for _, jid := range c.Participants {
		info.Participants = append(info.Participants, domain.Participant{JID: jid})
	}
	linked := make([]domain.GroupInfo, 0, len(c.Groups))
	for _, g := range c.Groups {
		linked = append(linked, domain.GroupInfo{
			JID:        g.GroupID,
			Subject:    g.Subject,
			IsSubGroup: true,
			ParentJID:  communityJID,
		})
	}
	return &domain.CommunityInfo{GroupInfo: info, LinkedGroups: linked}, nil
}

func (p *Provider) LinkGroupToCommunity(ctx context.Context, w models.Whatsapp, communityJID, groupJID string) error {
	sid, err := p.sidFor(w)
	if err != nil {
		return err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	return client.LinkCommunityGroup(ctx, sid, communityJID, groupJID)
}

func (p *Provider) UnlinkGroupFromCommunity(ctx context.Context, w models.Whatsapp, communityJID, groupJID string) error {
	sid, err := p.sidFor(w)
	if err != nil {
		return err
	}
	client, err := p.clientFor(w)
	if err != nil {
		return err
	}
	return client.UnlinkCommunityGroup(ctx, sid, communityJID, groupJID)
}
