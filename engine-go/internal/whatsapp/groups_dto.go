package whatsapp

import "go.mau.fi/whatsmeow/types"

// GroupInfo, Participant and CommunityInfo mirror the Watink-canonical DTO
// documented in engine-go/docs/groups-api.md and business/internal/domain/group_engine.go
// (T0.1/T0.2) — the whole point of this shape is that enginego and izapia
// providers on the business side deserialize the exact same JSON.
type GroupInfo struct {
	JID              string        `json:"jid"`
	Subject          string        `json:"subject"`
	Description      string        `json:"description"`
	Owner            string        `json:"owner"`
	IsCommunity      bool          `json:"isCommunity"`
	IsSubGroup       bool          `json:"isSubGroup"`
	ParentJID        string        `json:"parentJID,omitempty"`
	Announce         bool          `json:"announce"`
	Locked           bool          `json:"locked"`
	MemberAddMode    string        `json:"memberAddMode"`
	JoinApprovalMode bool          `json:"joinApprovalMode"`
	PictureURL       string        `json:"pictureURL,omitempty"`
	CreatedAt        int64         `json:"createdAt"`
	Participants     []Participant `json:"participants"`
}

type Participant struct {
	JID          string `json:"jid"`
	PhoneNumber  string `json:"phoneNumber,omitempty"`
	DisplayName  string `json:"displayName,omitempty"`
	IsAdmin      bool   `json:"isAdmin"`
	IsSuperAdmin bool   `json:"isSuperAdmin"`
}

type ParticipantResult struct {
	JID    string `json:"jid"`
	Status string `json:"status"` // "ok" | "error"
	Error  string `json:"error,omitempty"`
}

type JoinRequestEntry struct {
	JID         string `json:"jid"`
	RequestedAt int64  `json:"requestedAt"`
}

type CommunityInfo struct {
	GroupInfo
	LinkedGroups []GroupInfo `json:"linkedGroups"`
}

// groupInfoFromWhatsmeow converts the whatsmeow-native *types.GroupInfo into
// our canonical GroupInfo. isSubGroup/parentJID are not derivable from
// GetGroupInfo alone (whatsmeow's GroupLinkedParent is only populated in
// some code paths) — callers that know the parent (e.g. iterating
// GetSubGroups results) set ParentJID/IsSubGroup afterwards.
func groupInfoFromWhatsmeow(g *types.GroupInfo) GroupInfo {
	info := GroupInfo{
		JID:              g.JID.String(),
		Subject:          g.Name,
		Description:      g.Topic,
		Owner:            g.OwnerJID.String(),
		IsCommunity:      g.GroupParent.IsParent,
		Announce:         g.GroupAnnounce.IsAnnounce,
		Locked:           g.GroupLocked.IsLocked,
		MemberAddMode:    string(g.MemberAddMode),
		JoinApprovalMode: g.GroupMembershipApprovalMode.IsJoinApprovalRequired,
		CreatedAt:        g.GroupCreated.Unix(),
		Participants:     make([]Participant, 0, len(g.Participants)),
	}
	if g.GroupLinkedParent.LinkedParentJID.String() != "" && g.GroupLinkedParent.LinkedParentJID.User != "" {
		info.IsSubGroup = true
		info.ParentJID = g.GroupLinkedParent.LinkedParentJID.String()
	}
	for _, p := range g.Participants {
		info.Participants = append(info.Participants, participantFromWhatsmeow(p))
	}
	return info
}

func participantFromWhatsmeow(p types.GroupParticipant) Participant {
	part := Participant{
		JID:          p.JID.String(),
		IsAdmin:      p.IsAdmin,
		IsSuperAdmin: p.IsSuperAdmin,
		DisplayName:  p.DisplayName,
	}
	if p.PhoneNumber.User != "" {
		part.PhoneNumber = p.PhoneNumber.String()
	}
	return part
}
