package whatsapp

import (
	"errors"
	"testing"
)

// TestListGroups_SessionNotConnected verifies ListGroups fails clearly (via
// the exported ErrSessionNotConnected sentinel) when no client is
// registered for the session — the branch internal/groupsapi maps to 409
// SESSION_NOT_CONNECTED.
func TestListGroups_SessionNotConnected(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	_, err := svc.ListGroups(99)
	if err == nil {
		t.Fatal("expected error for unconnected session")
	}
	if !errors.Is(err, ErrSessionNotConnected) {
		t.Fatalf("expected ErrSessionNotConnected, got %v", err)
	}
}

func TestGetGroup_SessionNotConnected(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	_, err := svc.GetGroup(99, "120363xxx@g.us")
	if !errors.Is(err, ErrSessionNotConnected) {
		t.Fatalf("expected ErrSessionNotConnected, got %v", err)
	}
}

func TestGetCommunity_SessionNotConnected(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	_, err := svc.GetCommunity(99, "120363xxx@g.us")
	if !errors.Is(err, ErrSessionNotConnected) {
		t.Fatalf("expected ErrSessionNotConnected, got %v", err)
	}
}

// TestGetGroup_ChecksConnectionBeforeJID verifies getConnectedClient is
// checked before JID parsing (fail fast on the cheaper check) — an
// invalid-JID-with-a-live-client test lives at the groupsapi layer instead
// (internal/groupsapi/groups_read_test.go), since *whatsmeow.Client can't be
// faked here.
func TestGetGroup_ChecksConnectionBeforeJID(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	_, err := svc.GetGroup(1, "not-a-valid-jid")
	if !errors.Is(err, ErrSessionNotConnected) {
		t.Fatalf("expected ErrSessionNotConnected (checked before JID parsing), got %v", err)
	}
}
