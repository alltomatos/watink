package whatsapp

import (
	"errors"
	"testing"

	"go.mau.fi/whatsmeow"
)

func TestClassifyRiskError_463IsRisk(t *testing.T) {
	err := &whatsmeow.IQError{Code: 463, Text: "rate-overlimit"}
	code, risky := classifyRiskError(err)
	if !risky {
		t.Fatal("expected code 463 to be classified as a risk signal")
	}
	if code != 463 {
		t.Errorf("code = %d, want 463", code)
	}
}

func TestClassifyRiskError_KnownBenignCodesAreNotRisk(t *testing.T) {
	for _, code := range []int{404, 405, 410} {
		err := &whatsmeow.IQError{Code: code, Text: "irrelevant"}
		if _, risky := classifyRiskError(err); risky {
			t.Errorf("code %d should not be classified as a risk signal", code)
		}
	}
}

func TestClassifyRiskError_NonIQError(t *testing.T) {
	if _, risky := classifyRiskError(errors.New("network timeout")); risky {
		t.Error("a plain non-IQError should never be classified as a risk signal")
	}
}

func TestClassifyRiskError_NilError(t *testing.T) {
	if _, risky := classifyRiskError(nil); risky {
		t.Error("nil error should never be classified as a risk signal")
	}
}

func TestReportIfRiskSignal_PublishesSessionRiskEvent(t *testing.T) {
	svc, calls := newTestService()

	svc.reportIfRiskSignal(42, "tenant-a", "message.send", &whatsmeow.IQError{Code: 463, Text: "rate-overlimit"})

	if len(*calls) != 1 {
		t.Fatalf("expected 1 publishEvent call, got %d", len(*calls))
	}
	if (*calls)[0].eventType != "session.risk" {
		t.Errorf("eventType = %q, want session.risk", (*calls)[0].eventType)
	}
}

func TestReportIfRiskSignal_NoEventForBenignError(t *testing.T) {
	svc, calls := newTestService()

	svc.reportIfRiskSignal(42, "tenant-a", "message.send", &whatsmeow.IQError{Code: 404, Text: "item-not-found"})

	if len(*calls) != 0 {
		t.Fatalf("expected 0 publishEvent calls for a non-risk error, got %d", len(*calls))
	}
}
