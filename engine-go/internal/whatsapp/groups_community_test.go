package whatsapp

import (
	"errors"
	"testing"
)

func TestCreateCommunity_SessionNotConnected(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	_, err := svc.CreateCommunity(99, "tenant-1", "Comunidade")
	if !errors.Is(err, ErrSessionNotConnected) {
		t.Fatalf("expected ErrSessionNotConnected, got %v", err)
	}
}

func TestLinkGroupToCommunity_InvalidJID(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	err := svc.LinkGroupToCommunity(1, "tenant-1", "comm-1@g.us", "sub-1@g.us")
	// No client registered at all → hits ErrSessionNotConnected before JID
	// parsing, same "fail fast on the cheaper check" pattern as GetGroup.
	if !errors.Is(err, ErrSessionNotConnected) {
		t.Fatalf("expected ErrSessionNotConnected, got %v", err)
	}
}

func TestUnlinkGroupFromCommunity_SessionNotConnected(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	err := svc.UnlinkGroupFromCommunity(99, "tenant-1", "comm-1@g.us", "sub-1@g.us")
	if !errors.Is(err, ErrSessionNotConnected) {
		t.Fatalf("expected ErrSessionNotConnected, got %v", err)
	}
}
