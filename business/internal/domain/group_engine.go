package domain

import (
	"context"

	"github.com/alltomatos/watinkdev/business/internal/models"
)

// Nomes travados nesta sessão (T0.2, plano em
// docs/agents/plugin-grupos-comunidades.md) — não renomear sem atualizar o
// plano e a doc de contrato do engine-go (engine-go/docs/groups-api.md):
//
//   - slug do plugin:       "groups"
//   - recurso RBAC:         "whatsappGroups" (ações: read | manage | admin)
//   - prefixo de rota REST: /groups e /communities
//
// "whatsappGroups" (não "groups") porque o core já tem ConnectionGroup,
// ProxyGroup e TagGroup — conceitos homônimos e não relacionados
// (business/internal/controllers/{connection_group,proxy_group,tag_groups}.go).

// GroupInfo is the Watink-canonical shape of a WhatsApp group or community —
// normalized by each GroupEngine implementation from its own transport (the
// engine-go internal HTTP API for enginego, the izapia HTTP API for izapia).
// Neither provider's native format is used directly; both translate into
// this. See engine-go/docs/groups-api.md for the field-by-field mapping and
// the known gap around participant PhoneNumber/DisplayName on the izapia
// side (that provider only returns a bare JID, typically @lid).
type GroupInfo struct {
	JID              string        `json:"jid"` // "120363xxxxx@g.us" — the only identifier used end-to-end (invariant 5, never a numeric Watink-owned ID)
	Subject          string        `json:"subject"`
	Description      string        `json:"description"`
	Owner            string        `json:"owner"` // JID (or @lid) of the group creator
	IsCommunity      bool          `json:"isCommunity"`
	IsSubGroup       bool          `json:"isSubGroup"`
	ParentJID        string        `json:"parentJID,omitempty"` // set when IsSubGroup
	Announce         bool          `json:"announce"`            // only admins can post
	Locked           bool          `json:"locked"`              // only admins can edit metadata
	MemberAddMode    string        `json:"memberAddMode"`       // "admin_add" | "all_member_add"
	JoinApprovalMode bool          `json:"joinApprovalMode"`
	PictureURL       string        `json:"pictureURL,omitempty"`
	CreatedAt        int64         `json:"createdAt"` // unix seconds
	Participants     []Participant `json:"participants"`
}

// Participant is one member of a GroupInfo.Participants list.
type Participant struct {
	JID         string `json:"jid"`
	PhoneNumber string `json:"phoneNumber,omitempty"` // empty when only @lid was resolved
	DisplayName string `json:"displayName,omitempty"`
	// PictureURL is NEVER set by the provider itself (izapia/whatsmeow
	// don't return a per-participant avatar in the group payload) — it's
	// filled in by groups_participant_enrich.go (business/internal/plugins)
	// as a best-effort DB lookup against existing Contact rows, same
	// reuse-what-we-already-have strategy as enrichContactFromGroup
	// (groups_contact_enrich.go). Never a fresh WhatsApp API call per
	// participant — a 100+-member group would mean 100+ round-trips,
	// a real rate-limit/ban risk.
	PictureURL   string `json:"pictureURL,omitempty"`
	IsAdmin      bool   `json:"isAdmin"`
	IsSuperAdmin bool   `json:"isSuperAdmin"`
}

// ParticipantResult is the per-participant outcome of a bulk
// add/remove/promote/demote or join-request approve/reject call — never
// collapse a batch action into a single boolean, callers (the plugin
// handler, the frontend) need to know exactly who failed and why.
type ParticipantResult struct {
	JID    string `json:"jid"`
	Status string `json:"status"` // "ok" | "error"
	Error  string `json:"error,omitempty"`
}

// JoinRequest is one pending entry in a group's join-approval queue.
type JoinRequest struct {
	JID         string `json:"jid"`
	RequestedAt int64  `json:"requestedAt"`
}

// CommunityInfo extends GroupInfo (a community is itself a special group,
// IsCommunity=true) with the list of its linked sub-groups.
type CommunityInfo struct {
	GroupInfo
	LinkedGroups []GroupInfo `json:"linkedGroups"`
}

// GroupSettingsPatch carries only the fields being changed by
// GroupEngine.UpdateGroupSettings — callers set only what they mean to
// change; nil/zero-value fields are left as pointers precisely so "not
// provided" is distinguishable from "set to false/empty".
type GroupSettingsPatch struct {
	Subject       *string
	Description   *string
	PictureURL    *string
	Announce      *bool
	Locked        *bool
	MemberAddMode *string // "admin_add" | "all_member_add"
}

// GroupEngine is an OPTIONAL extension of WhatsAppEngine (same pattern as
// RichMessageEngine, interfaces.go:170-178) for engines that support active
// group/community management — creating groups, managing participants,
// invite links, join requests, communities. Callers (the groups plugin's
// service layer) resolve a connection's WhatsAppEngine via
// WhatsAppEngineResolver.EngineFor and type-assert it against GroupEngine;
// an engine that doesn't implement it returns a clear 501, never silently
// no-ops.
//
// Excludes JoinByLink/PreviewByLink on purpose — MVP scope decision (plan
// §1): joining/previewing third-party groups by invite link is the classic
// mass-action ban vector and is deferred to a v2.
//
// Every method identifies a group/community by its full JID
// (models.Whatsapp.JID-style string, e.g. "120363xxxxx@g.us") — never a
// Watink-owned numeric ID (invariant 5).
type GroupEngine interface {
	ListGroups(ctx context.Context, w models.Whatsapp) ([]GroupInfo, error)
	GetGroup(ctx context.Context, w models.Whatsapp, groupJID string) (*GroupInfo, error)
	CreateGroup(ctx context.Context, w models.Whatsapp, subject string, participants []string) (*GroupInfo, error)

	UpdateParticipants(ctx context.Context, w models.Whatsapp, groupJID string, action string, participants []string) ([]ParticipantResult, error)
	UpdateGroupSettings(ctx context.Context, w models.Whatsapp, groupJID string, patch GroupSettingsPatch) error

	GetInviteLink(ctx context.Context, w models.Whatsapp, groupJID string) (string, error)
	RevokeInviteLink(ctx context.Context, w models.Whatsapp, groupJID string) (string, error)

	LeaveGroup(ctx context.Context, w models.Whatsapp, groupJID string) error

	SetJoinApprovalMode(ctx context.Context, w models.Whatsapp, groupJID string, enabled bool) error
	ListJoinRequests(ctx context.Context, w models.Whatsapp, groupJID string) ([]JoinRequest, error)
	ResolveJoinRequests(ctx context.Context, w models.Whatsapp, groupJID string, action string, participants []string) ([]ParticipantResult, error)

	CreateCommunity(ctx context.Context, w models.Whatsapp, name string) (*CommunityInfo, error)
	GetCommunity(ctx context.Context, w models.Whatsapp, communityJID string) (*CommunityInfo, error)
	LinkGroupToCommunity(ctx context.Context, w models.Whatsapp, communityJID, groupJID string) error
	UnlinkGroupFromCommunity(ctx context.Context, w models.Whatsapp, communityJID, groupJID string) error
}
