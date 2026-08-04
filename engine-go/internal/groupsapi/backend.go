package groupsapi

import "github.com/alltomatos/watinkdev/engine-go/internal/whatsapp"

// Backend is the subset of *whatsapp.WhatsAppService this package depends
// on. Keeping it as a narrow interface (rather than importing the concrete
// type everywhere) is what makes the HTTP layer testable with a fake —
// *whatsmeow.Client itself can't be faked (concrete struct), so the
// package-boundary here is where offline testing actually happens, per the
// plan's "testável offline" acceptance criterion for T1.1-T1.3.
//
// Grows with T1.3 (community mutation routes) — this revision (T1.2) adds
// the write methods.
type Backend interface {
	ListGroups(sessionID int) ([]whatsapp.GroupInfo, error)
	GetGroup(sessionID int, groupJID string) (*whatsapp.GroupInfo, error)
	GetCommunity(sessionID int, communityJID string) (*whatsapp.CommunityInfo, error)

	CreateGroup(sessionID int, tenantID, subject string, participants []string) (*whatsapp.GroupInfo, error)
	UpdateParticipants(sessionID int, tenantID, groupJID, action string, participants []string) ([]whatsapp.ParticipantResult, error)
	UpdateGroupSettings(sessionID int, tenantID, groupJID string, payload whatsapp.UpdateGroupSettingsPayload) error
	GetInviteLink(sessionID int, groupJID string) (string, error)
	RevokeInviteLink(sessionID int, tenantID, groupJID string) (string, error)
	LeaveGroup(sessionID int, tenantID, groupJID string) error
	SetJoinApprovalMode(sessionID int, tenantID, groupJID string, enabled bool) error
	ListJoinRequests(sessionID int, groupJID string) ([]whatsapp.JoinRequestEntry, error)
	ResolveJoinRequests(sessionID int, tenantID, groupJID, action string, participants []string) ([]whatsapp.ParticipantResult, error)

	CreateCommunity(sessionID int, tenantID, name string) (*whatsapp.CommunityInfo, error)
	LinkGroupToCommunity(sessionID int, tenantID, communityJID, groupJID string) error
	UnlinkGroupFromCommunity(sessionID int, tenantID, communityJID, groupJID string) error
}

// compile-time assertion: *whatsapp.WhatsAppService must keep satisfying
// Backend as it grows.
var _ Backend = (*whatsapp.WhatsAppService)(nil)
