package whatsapp

import (
	"context"
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
)

// fakeLIDStore is a minimal store.LIDStore for offline tests -- only
// GetPNForLID is exercised by resolvePicJID.
type fakeLIDStore struct {
	pnForLID map[string]types.JID
	err      error
}

func (f *fakeLIDStore) PutManyLIDMappings(ctx context.Context, mappings []store.LIDMapping) error {
	return nil
}
func (f *fakeLIDStore) PutLIDMapping(ctx context.Context, lid, jid types.JID) error { return nil }
func (f *fakeLIDStore) GetPNForLID(ctx context.Context, lid types.JID) (types.JID, error) {
	if f.err != nil {
		return types.JID{}, f.err
	}
	if pn, ok := f.pnForLID[lid.String()]; ok {
		return pn, nil
	}
	return types.JID{}, nil
}
func (f *fakeLIDStore) GetLIDForPN(ctx context.Context, pn types.JID) (types.JID, error) {
	return types.JID{}, nil
}
func (f *fakeLIDStore) GetManyLIDsForPNs(ctx context.Context, pns []types.JID) (map[types.JID]types.JID, error) {
	return nil, nil
}

func newClientWithLIDStore(t *testing.T, lidStore store.LIDStore) *whatsmeow.Client {
	t.Helper()
	return whatsmeow.NewClient(&store.Device{LIDs: lidStore}, nil)
}

func TestResolvePicJID_NonLID_ReturnsJIDUnchanged(t *testing.T) {
	svc, _ := newTestService()
	client := newClientWithLIDStore(t, &fakeLIDStore{})

	jid, err := types.ParseJID("5511999990001@s.whatsapp.net")
	if err != nil {
		t.Fatalf("ParseJID: %v", err)
	}

	resolved, ok := svc.resolvePicJID(client, jid)
	if !ok {
		t.Fatal("expected ok=true for a regular (non-LID) JID")
	}
	if resolved.String() != jid.ToNonAD().String() {
		t.Errorf("resolved = %q, want %q", resolved, jid.ToNonAD())
	}
}

func TestResolvePicJID_LID_ResolvesToPN(t *testing.T) {
	svc, _ := newTestService()

	lidJID, err := types.ParseJID("123456789@lid")
	if err != nil {
		t.Fatalf("ParseJID lid: %v", err)
	}
	pnJID, err := types.ParseJID("5511999990002@s.whatsapp.net")
	if err != nil {
		t.Fatalf("ParseJID pn: %v", err)
	}

	client := newClientWithLIDStore(t, &fakeLIDStore{
		pnForLID: map[string]types.JID{lidJID.String(): pnJID},
	})

	resolved, ok := svc.resolvePicJID(client, lidJID)
	if !ok {
		t.Fatal("expected ok=true when the LID resolves to a PN")
	}
	if resolved.String() != pnJID.ToNonAD().String() {
		t.Errorf("resolved = %q, want %q", resolved, pnJID.ToNonAD())
	}
}

func TestResolvePicJID_LID_NoMapping_ReturnsNotOK(t *testing.T) {
	svc, _ := newTestService()

	lidJID, err := types.ParseJID("999999999@lid")
	if err != nil {
		t.Fatalf("ParseJID: %v", err)
	}

	client := newClientWithLIDStore(t, &fakeLIDStore{})

	_, ok := svc.resolvePicJID(client, lidJID)
	if ok {
		t.Fatal("expected ok=false when the LID has no known PN mapping")
	}
}
