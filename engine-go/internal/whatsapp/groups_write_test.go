package whatsapp

import (
	"errors"
	"testing"

	"go.mau.fi/whatsmeow"
)

func TestClassifyGroupWriteError_403IsNotAdmin(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	err := svc.classifyGroupWriteError(1, "tenant-1", "groups.subject", &whatsmeow.IQError{Code: 403, Text: "not-authorized"})
	if !errors.Is(err, ErrGroupNotAdmin) {
		t.Fatalf("expected ErrGroupNotAdmin, got %v", err)
	}
	if errors.Is(err, ErrGroupRateLimited) {
		t.Fatal("403 must NOT be classified as rate limited — it's a normal permission error, not a ban signal")
	}
}

func TestClassifyGroupWriteError_429IsRateLimited(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	err := svc.classifyGroupWriteError(1, "tenant-1", "groups.participants.add", &whatsmeow.IQError{Code: 429, Text: "rate-overlimit"})
	if !errors.Is(err, ErrGroupRateLimited) {
		t.Fatalf("expected ErrGroupRateLimited, got %v", err)
	}
}

func TestClassifyGroupWriteError_463IsRateLimited(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	err := svc.classifyGroupWriteError(1, "tenant-1", "groups.leave", &whatsmeow.IQError{Code: 463, Text: "rate-overlimit"})
	if !errors.Is(err, ErrGroupRateLimited) {
		t.Fatalf("expected ErrGroupRateLimited, got %v", err)
	}
}

func TestClassifyGroupWriteError_UnclassifiedPassesThrough(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	original := errors.New("boom")
	err := svc.classifyGroupWriteError(1, "tenant-1", "groups.create", original)
	if errors.Is(err, ErrGroupNotAdmin) || errors.Is(err, ErrGroupRateLimited) {
		t.Fatalf("unclassified error must not be misclassified, got %v", err)
	}
	if !errors.Is(err, original) {
		t.Fatal("original error must still be reachable via errors.Is")
	}
}

func TestClassifyGroupWriteError_NilIsNil(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	if err := svc.classifyGroupWriteError(1, "tenant-1", "groups.create", nil); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestUpdateParticipants_UnknownAction(t *testing.T) {
	svc := newTestServiceWithClient(1, nil)
	_, err := svc.UpdateParticipants(1, "tenant-1", "120363xxx@g.us", "not-a-real-action", []string{"a@s.whatsapp.net"})
	if !errors.Is(err, ErrSessionNotConnected) {
		t.Fatalf("expected ErrSessionNotConnected (checked before action validation), got %v", err)
	}
}

func TestDecodeBase64Image_Invalid(t *testing.T) {
	_, err := decodeBase64Image("not-valid-base64!!!")
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestDecodeBase64Image_Valid(t *testing.T) {
	// "hi" base64-encoded
	raw, err := decodeBase64Image("aGk=")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(raw) != "hi" {
		t.Fatalf("expected decoded bytes 'hi', got %q", raw)
	}
}

func TestParticipantChangeFromString(t *testing.T) {
	cases := map[string]bool{"add": true, "remove": true, "promote": true, "demote": true, "bogus": false}
	for action, wantOK := range cases {
		_, ok := participantChangeFromString(action)
		if ok != wantOK {
			t.Errorf("participantChangeFromString(%q) ok=%v, want %v", action, ok, wantOK)
		}
	}
}

func TestParticipantRequestChangeFromString(t *testing.T) {
	cases := map[string]bool{"approve": true, "reject": true, "bogus": false}
	for action, wantOK := range cases {
		_, ok := participantRequestChangeFromString(action)
		if ok != wantOK {
			t.Errorf("participantRequestChangeFromString(%q) ok=%v, want %v", action, ok, wantOK)
		}
	}
}
