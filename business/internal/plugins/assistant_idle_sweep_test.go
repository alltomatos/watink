package plugins

import (
	"errors"
	"testing"
)

func TestIsUniqueViolation_DetectsPostgresDuplicateKey(t *testing.T) {
	err := errors.New(`ERROR: duplicate key value violates unique constraint "idx_assistant_proactive_logs_dedup" (SQLSTATE 23505)`)
	if !isUniqueViolation(err) {
		t.Fatal("expected duplicate key error to be detected")
	}
}

func TestIsUniqueViolation_OtherErrorsAreNotViolations(t *testing.T) {
	if isUniqueViolation(errors.New("connection refused")) {
		t.Fatal("expected an unrelated error to not be classified as a unique violation")
	}
}

func TestPipelineEventMessage_KnownEvents(t *testing.T) {
	cases := []string{"deal_created", "stage_changed", "idle", "closed"}
	for _, evt := range cases {
		if got := pipelineEventMessage(evt); got == "" {
			t.Fatalf("expected a non-empty message for event %q", evt)
		}
	}
}

func TestPipelineEventMessage_UnknownEventFallsBackToGeneric(t *testing.T) {
	if got := pipelineEventMessage("something_else"); got == "" {
		t.Fatal("expected a non-empty fallback message for an unknown event")
	}
}
