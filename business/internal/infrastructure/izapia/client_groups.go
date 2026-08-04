package izapia

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// groupDTO mirrors the REAL shape returned by GET /sessions/{sid}/groups and
// GET /sessions/{sid}/groups/{groupId} — captured live against a connected
// session (see engine-go/docs/groups-api.md "Probe real contra a izapia").
// It intentionally does NOT include announce/locked/memberAddMode/
// joinApprovalMode/pictureURL — the izapia API does not return them on
// these endpoints. Provider.groupInfoFromDTO (groups.go) fills those with
// zero-values; this is a known upstream limitation, not a mapping bug.
type groupDTO struct {
	GroupID      string                `json:"group_id"`
	Subject      string                `json:"subject"`
	Description  string                `json:"description"`
	Owner        string                `json:"owner"`
	Created      int64                 `json:"created"`
	Participants []groupParticipantDTO `json:"participants"`
}

type groupParticipantDTO struct {
	JID          string `json:"jid"`
	IsAdmin      bool   `json:"is_admin"`
	IsSuperAdmin bool   `json:"is_super_admin"`
}

// communityCreateDTO mirrors the REAL shape of POST /sessions/{sid}/communities
// — captured live 2026-08-04 (probe + cleanup documented in
// engine-go/docs/groups-api.md). NOT the same shape as groupDTO: the key is
// "community_id", not "group_id".
type communityCreateDTO struct {
	CommunityID  string                `json:"community_id"`
	Subject      string                `json:"subject"`
	Description  string                `json:"description"`
	Owner        string                `json:"owner"`
	Created      int64                 `json:"created"`
	Participants []groupParticipantDTO `json:"participants"`
}

// communityDetailDTO mirrors the REAL shape of
// GET /sessions/{sid}/communities/{communityId} — captured live, and
// entirely different from what the original (unverified) contract draft
// assumed: no top-level subject/owner/description at all, participants is a
// flat array of JID strings (not objects), and linked groups are under
// "groups" (not "linkedGroups"), each with only group_id/subject/
// is_default_sub_group — no per-group participant list.
type communityDetailDTO struct {
	Groups           []communityLinkedGroupDTO `json:"groups"`
	ParticipantCount int                       `json:"participant_count"`
	Participants     []string                  `json:"participants"`
}

type communityLinkedGroupDTO struct {
	GroupID           string `json:"group_id"`
	Subject           string `json:"subject"`
	IsDefaultSubGroup bool   `json:"is_default_sub_group"`
}

type participantResultDTO struct {
	JID    string `json:"jid"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

type joinRequestDTO struct {
	JID         string `json:"jid"`
	RequestedAt int64  `json:"requestedAt"`
}

func groupPath(sid string) string {
	return "/api/v1/sessions/" + url.PathEscape(sid) + "/groups"
}

func groupItemPath(sid, groupID string) string {
	return groupPath(sid) + "/" + url.PathEscape(groupID)
}

// ListGroups → GET /sessions/{sid}/groups
func (c *Client) ListGroups(ctx context.Context, sid string) ([]groupDTO, error) {
	var out []groupDTO
	if err := c.do(ctx, http.MethodGet, groupPath(sid), nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetGroup → GET /sessions/{sid}/groups/{groupId}
func (c *Client) GetGroup(ctx context.Context, sid, groupID string) (*groupDTO, error) {
	var out groupDTO
	if err := c.do(ctx, http.MethodGet, groupItemPath(sid, groupID), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateGroup → POST /sessions/{sid}/groups
func (c *Client) CreateGroup(ctx context.Context, sid, subject string, participants []string) (*groupDTO, error) {
	body := map[string]interface{}{"subject": subject, "participants": participants}
	var out groupDTO
	if err := c.do(ctx, http.MethodPost, groupPath(sid), body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// UpdateGroupParticipants → POST /sessions/{sid}/groups/{groupId}/participants
func (c *Client) UpdateGroupParticipants(ctx context.Context, sid, groupID, action string, participants []string) ([]participantResultDTO, error) {
	body := map[string]interface{}{"action": action, "participants": participants}
	var out struct {
		Participants []participantResultDTO `json:"participants"`
	}
	if err := c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/participants", body, &out); err != nil {
		return nil, err
	}
	return out.Participants, nil
}

// SetGroupSubject → POST /sessions/{sid}/groups/{groupId}/subject
func (c *Client) SetGroupSubject(ctx context.Context, sid, groupID, subject string) error {
	return c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/subject", map[string]string{"subject": subject}, nil)
}

// SetGroupDescription → POST /sessions/{sid}/groups/{groupId}/description
func (c *Client) SetGroupDescription(ctx context.Context, sid, groupID, description string) error {
	return c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/description", map[string]string{"description": description}, nil)
}

// SetGroupAnnounce → POST /sessions/{sid}/groups/{groupId}/announce
func (c *Client) SetGroupAnnounce(ctx context.Context, sid, groupID string, announce bool) error {
	return c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/announce", map[string]bool{"announce": announce}, nil)
}

// SetGroupLocked → POST /sessions/{sid}/groups/{groupId}/locked
func (c *Client) SetGroupLocked(ctx context.Context, sid, groupID string, locked bool) error {
	return c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/locked", map[string]bool{"locked": locked}, nil)
}

// SetGroupMemberAddMode → POST /sessions/{sid}/groups/{groupId}/member-add-mode
func (c *Client) SetGroupMemberAddMode(ctx context.Context, sid, groupID, mode string) error {
	return c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/member-add-mode", map[string]string{"mode": mode}, nil)
}

// SetGroupPhoto → POST /sessions/{sid}/groups/{groupId}/picture
func (c *Client) SetGroupPhoto(ctx context.Context, sid, groupID, base64Image string) error {
	return c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/picture", map[string]string{"image": base64Image}, nil)
}

// GetGroupInvite → GET /sessions/{sid}/groups/{groupId}/invite
func (c *Client) GetGroupInvite(ctx context.Context, sid, groupID string) (string, error) {
	var out struct {
		Link string `json:"link"`
	}
	if err := c.do(ctx, http.MethodGet, groupItemPath(sid, groupID)+"/invite", nil, &out); err != nil {
		return "", err
	}
	return out.Link, nil
}

// RevokeGroupInvite → POST /sessions/{sid}/groups/{groupId}/invite/revoke
func (c *Client) RevokeGroupInvite(ctx context.Context, sid, groupID string) (string, error) {
	var out struct {
		Link string `json:"link"`
	}
	if err := c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/invite/revoke", nil, &out); err != nil {
		return "", err
	}
	return out.Link, nil
}

// LeaveGroup → POST /sessions/{sid}/groups/{groupId}/leave
func (c *Client) LeaveGroup(ctx context.Context, sid, groupID string) error {
	return c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/leave", nil, nil)
}

// SetGroupJoinApprovalMode → POST /sessions/{sid}/groups/{groupId}/join-approval-mode
func (c *Client) SetGroupJoinApprovalMode(ctx context.Context, sid, groupID string, enabled bool) error {
	return c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/join-approval-mode", map[string]bool{"enabled": enabled}, nil)
}

// ListGroupJoinRequests → GET /sessions/{sid}/groups/{groupId}/join-requests
func (c *Client) ListGroupJoinRequests(ctx context.Context, sid, groupID string) ([]joinRequestDTO, error) {
	var out []joinRequestDTO
	if err := c.do(ctx, http.MethodGet, groupItemPath(sid, groupID)+"/join-requests", nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// UpdateGroupJoinRequests → POST /sessions/{sid}/groups/{groupId}/join-requests
func (c *Client) UpdateGroupJoinRequests(ctx context.Context, sid, groupID, action string, participants []string) ([]participantResultDTO, error) {
	body := map[string]interface{}{"action": action, "participants": participants}
	var out struct {
		Participants []participantResultDTO `json:"participants"`
	}
	if err := c.do(ctx, http.MethodPost, groupItemPath(sid, groupID)+"/join-requests", body, &out); err != nil {
		return nil, err
	}
	return out.Participants, nil
}

func communityPath(sid string) string {
	return "/api/v1/sessions/" + url.PathEscape(sid) + "/communities"
}

func communityItemPath(sid, communityID string) string {
	return communityPath(sid) + "/" + url.PathEscape(communityID)
}

// CreateCommunity → POST /sessions/{sid}/communities
func (c *Client) CreateCommunity(ctx context.Context, sid, name string) (*communityCreateDTO, error) {
	var out communityCreateDTO
	if err := c.do(ctx, http.MethodPost, communityPath(sid), map[string]string{"name": name}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetCommunity → GET /sessions/{sid}/communities/{communityId}
func (c *Client) GetCommunity(ctx context.Context, sid, communityID string) (*communityDetailDTO, error) {
	var out communityDetailDTO
	if err := c.do(ctx, http.MethodGet, communityItemPath(sid, communityID), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// LinkCommunityGroup → POST /sessions/{sid}/communities/{communityId}/groups/{groupId}
func (c *Client) LinkCommunityGroup(ctx context.Context, sid, communityID, groupID string) error {
	path := fmt.Sprintf("%s/groups/%s", communityItemPath(sid, communityID), url.PathEscape(groupID))
	return c.do(ctx, http.MethodPost, path, nil, nil)
}

// UnlinkCommunityGroup → POST /sessions/{sid}/communities/{communityId}/groups/{groupId}/remove
func (c *Client) UnlinkCommunityGroup(ctx context.Context, sid, communityID, groupID string) error {
	path := fmt.Sprintf("%s/groups/%s/remove", communityItemPath(sid, communityID), url.PathEscape(groupID))
	return c.do(ctx, http.MethodPost, path, nil, nil)
}
