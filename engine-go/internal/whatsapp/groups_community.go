package whatsapp

import (
	"context"
	"fmt"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

// CreateCommunity creates a community — a WhatsApp group with IsParent set
// (whatsmeow auto-creates the linked announcement group server-side).
func (s *WhatsAppService) CreateCommunity(sessionID int, tenantID, name string) (*CommunityInfo, error) {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return nil, err
	}
	g, err := client.CreateGroup(context.Background(), whatsmeow.ReqCreateGroup{
		Name:        name,
		GroupParent: types.GroupParent{IsParent: true},
	})
	if err != nil {
		return nil, s.classifyGroupWriteError(sessionID, tenantID, "communities.create", err)
	}
	info := groupInfoFromWhatsmeow(g)
	info.IsCommunity = true
	return &CommunityInfo{GroupInfo: info}, nil
}

// LinkGroupToCommunity links an existing group as a sub-group of a community.
func (s *WhatsAppService) LinkGroupToCommunity(sessionID int, tenantID, communityJID, groupJID string) error {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return err
	}
	parent, err := types.ParseJID(communityJID)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	child, err := types.ParseJID(groupJID)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	if err := client.LinkGroup(context.Background(), parent, child); err != nil {
		return s.classifyGroupWriteError(sessionID, tenantID, "communities.link", err)
	}
	return nil
}

// UnlinkGroupFromCommunity removes a sub-group from a community.
func (s *WhatsAppService) UnlinkGroupFromCommunity(sessionID int, tenantID, communityJID, groupJID string) error {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		return err
	}
	parent, err := types.ParseJID(communityJID)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	child, err := types.ParseJID(groupJID)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidGroupJID, err)
	}
	if err := client.UnlinkGroup(context.Background(), parent, child); err != nil {
		return s.classifyGroupWriteError(sessionID, tenantID, "communities.unlink", err)
	}
	return nil
}
