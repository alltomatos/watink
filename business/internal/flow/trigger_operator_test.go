package flow

import "testing"

func TestMatchesTriggerValue_Equals_DefaultAndExplicit(t *testing.T) {
	if !matchesTriggerValue("", "menu", "menu") {
		t.Fatal("empty operator should behave as equals (backward compat)")
	}
	if matchesTriggerValue("", "menu", "abrir menu") {
		t.Fatal("equals must not match a superstring")
	}
	if !matchesTriggerValue("equals", "menu", "menu") {
		t.Fatal("explicit equals should match exact body")
	}
}

func TestMatchesTriggerValue_Contains(t *testing.T) {
	if !matchesTriggerValue("contains", "menu", "quero ver o menu, por favor") {
		t.Fatal("contains should match a substring anywhere in the body")
	}
	if matchesTriggerValue("contains", "menu", "sem a palavra") {
		t.Fatal("contains must not match when the substring is absent")
	}
}

func TestMatchesTriggerValue_StartsWith(t *testing.T) {
	if !matchesTriggerValue("starts_with", "oi", "oi tudo bem?") {
		t.Fatal("starts_with should match a matching prefix")
	}
	if matchesTriggerValue("starts_with", "oi", "e ai, oi") {
		t.Fatal("starts_with must not match when the value is not a prefix")
	}
}

func TestMatchesTriggerValue_EndsWith(t *testing.T) {
	if !matchesTriggerValue("ends_with", "sair", "quero sair") {
		t.Fatal("ends_with should match a matching suffix")
	}
	if matchesTriggerValue("ends_with", "sair", "sair agora") {
		t.Fatal("ends_with must not match when the value is not a suffix")
	}
}

func TestMatchesTriggerValue_Regex(t *testing.T) {
	if !matchesTriggerValue("regex", "^[0-9]+$", "12345") {
		t.Fatal("regex should match per the compiled pattern")
	}
	if matchesTriggerValue("regex", "^[0-9]+$", "abc123") {
		t.Fatal("regex must not match when the pattern does not fully apply")
	}
}

func TestMatchesTriggerValue_InvalidRegexNeverMatches(t *testing.T) {
	if matchesTriggerValue("regex", "([unclosed", "anything") {
		t.Fatal("an invalid regex must never match (fail closed, not panic)")
	}
}

func TestExtractOperator_ExplicitFieldWins(t *testing.T) {
	d := triggerNodeData{TriggerOperator: "contains"}
	if got := extractOperator(d); got != "contains" {
		t.Fatalf("expected explicit triggerOperator to win, got %q", got)
	}
}

func TestExtractOperator_FallsBackToConditionOperator(t *testing.T) {
	d := triggerNodeData{
		Conditions: []struct {
			Field    string `json:"field"`
			Operator string `json:"operator"`
			Value    string `json:"value"`
		}{{Field: "lastInput", Operator: "starts_with", Value: "oi"}},
	}
	if got := extractOperator(d); got != "starts_with" {
		t.Fatalf("expected condition operator fallback, got %q", got)
	}
}

func TestExtractOperator_UnknownDegradesToEmpty(t *testing.T) {
	d := triggerNodeData{TriggerOperator: "not-a-real-operator"}
	if got := extractOperator(d); got != "" {
		t.Fatalf("expected unknown operator to degrade to empty (equals), got %q", got)
	}
}
