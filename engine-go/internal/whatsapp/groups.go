package whatsapp

import (
	"context"
	"fmt"

	"go.mau.fi/whatsmeow/types"
)

// ListGroups returns every group the connected session is a member of,
// normalized to the canonical GroupInfo shape. Scope: internal/groupsapi
// (T1.1, plan §4 trilho A) — read-only.
func (s *WhatsAppService) ListGroups(sessionID int) ([]GroupInfo, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return nil, err
	}
	groups, err := client.GetJoinedGroups(context.Background())
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}
	out := make([]GroupInfo, 0, len(groups))
	for _, g := range groups {
		out = append(out, groupInfoFromWhatsmeow(g))
	}
	return out, nil
}

// GetGroup returns a single group by JID. Returns ErrGroupNotFound when
// whatsmeow reports the group doesn't exist / the session isn't a member.
func (s *WhatsAppService) GetGroup(sessionID int, groupJID string) (*GroupInfo, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return nil, err
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	g, err := client.GetGroupInfo(context.Background(), jid)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGroupNotFound, err)
	}
	info := groupInfoFromWhatsmeow(g)
	return &info, nil
}

// GetCommunity returns a community's own group info plus its linked
// sub-groups. Returns ErrGroupNotFound when the community JID doesn't
// resolve.
//
// NOTE (engine-go/docs/groups-api.md): this shape was inferred, not proven
// live against a real community — GetSubGroups gives us JID+name only
// (types.GroupLinkTarget), so each linked group is re-fetched via
// GetGroupInfo to fill in the full GroupInfo. Validate against a real test
// community before closing T1.3 (communities.go) — if whatsmeow's actual
// behavior differs, fix here and in groups-api.md in the same PR.
func (s *WhatsAppService) GetCommunity(sessionID int, communityJID string) (*CommunityInfo, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return nil, err
	}
	jid, err := types.ParseJID(communityJID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	g, err := client.GetGroupInfo(context.Background(), jid)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGroupNotFound, err)
	}
	community := CommunityInfo{GroupInfo: groupInfoFromWhatsmeow(g)}
	community.IsCommunity = true

	subGroups, err := client.GetSubGroups(context.Background(), jid)
	if err != nil {
		return nil, fmt.Errorf("list sub-groups: %w", err)
	}
	community.LinkedGroups = make([]GroupInfo, 0, len(subGroups))
	for _, sub := range subGroups {
		subInfo, err := client.GetGroupInfo(context.Background(), sub.JID)
		if err != nil {
			// A sub-group that fails to resolve individually shouldn't fail
			// the whole community read — surface it as a minimal stub
			// instead of dropping it silently (caller still knows it exists).
			community.LinkedGroups = append(community.LinkedGroups, GroupInfo{
				JID:        sub.JID.String(),
				Subject:    sub.Name,
				IsSubGroup: true,
				ParentJID:  jid.String(),
			})
			continue
		}
		info := groupInfoFromWhatsmeow(subInfo)
		info.IsSubGroup = true
		info.ParentJID = jid.String()
		community.LinkedGroups = append(community.LinkedGroups, info)
	}
	return &community, nil
}
