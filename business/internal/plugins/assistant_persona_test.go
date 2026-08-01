package plugins

import (
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/flow"
)

func TestPersonaHistory_RoundTrip(t *testing.T) {
	st := &flow.ExecState{}
	if got := loadPersonaHistory(st); got != nil {
		t.Fatalf("expected nil history on empty Vars, got %v", got)
	}

	history := []flow.AgentTurn{
		{Role: "user", Content: "oi"},
		{Role: "assistant", Content: "olá!"},
	}
	savePersonaHistory(st, history)

	got := loadPersonaHistory(st)
	if len(got) != 2 || got[0].Content != "oi" || got[1].Content != "olá!" {
		t.Fatalf("round-trip mismatch: %v", got)
	}
}

func TestPersonaHistory_InvalidJSONYieldsEmpty(t *testing.T) {
	st := &flow.ExecState{Vars: map[string]string{personaHistoryKey: "not-json"}}
	if got := loadPersonaHistory(st); got != nil {
		t.Fatalf("expected nil history on invalid JSON, got %v", got)
	}
}

func TestBumpPersonaTurn_IncrementsAndPersists(t *testing.T) {
	st := &flow.ExecState{}
	if got := bumpPersonaTurn(st); got != 1 {
		t.Fatalf("expected 1, got %d", got)
	}
	if got := bumpPersonaTurn(st); got != 2 {
		t.Fatalf("expected 2, got %d", got)
	}
	if st.Vars[personaTurnsKey] != "2" {
		t.Fatalf("expected Vars to persist counter, got %v", st.Vars)
	}
}
