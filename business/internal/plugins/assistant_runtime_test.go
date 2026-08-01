package plugins

import (
	"strings"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
)

func TestMatchRouterOption_ByNumericPosition(t *testing.T) {
	options := []models.AssistantRouterOption{
		{ID: 1, Label: "Suporte", TargetAssistantID: 10},
		{ID: 2, Label: "Vendas", TargetAssistantID: 20},
	}
	got := matchRouterOption(options, "2")
	if got == nil || got.TargetAssistantID != 20 {
		t.Fatalf("expected option 2 (Vendas), got %v", got)
	}
}

func TestMatchRouterOption_ByLabelSubstring(t *testing.T) {
	options := []models.AssistantRouterOption{
		{ID: 1, Label: "Suporte Técnico", TargetAssistantID: 10},
		{ID: 2, Label: "Vendas", TargetAssistantID: 20},
	}
	got := matchRouterOption(options, "suporte")
	if got == nil || got.TargetAssistantID != 10 {
		t.Fatalf("expected Suporte Técnico by substring match, got %v", got)
	}
}

func TestMatchRouterOption_NoMatchReturnsNil(t *testing.T) {
	options := []models.AssistantRouterOption{{ID: 1, Label: "Suporte", TargetAssistantID: 10}}
	if got := matchRouterOption(options, "financeiro"); got != nil {
		t.Fatalf("expected no match, got %v", got)
	}
	if got := matchRouterOption(options, "99"); got != nil {
		t.Fatalf("expected out-of-range numeric to not match, got %v", got)
	}
}

func TestBuildRouterMenu_NumbersOptionsInOrder(t *testing.T) {
	options := []models.AssistantRouterOption{
		{Label: "Suporte"},
		{Label: "Vendas"},
	}
	menu := buildRouterMenu(options)
	if !strings.Contains(menu, "1. Suporte") || !strings.Contains(menu, "2. Vendas") {
		t.Fatalf("expected numbered menu, got: %q", menu)
	}
}

func TestBumpRouterTurn_IncrementsAndPersistsInVars(t *testing.T) {
	st := &flow.ExecState{}
	if got := bumpRouterTurn(st); got != 1 {
		t.Fatalf("expected first bump to return 1, got %d", got)
	}
	if got := bumpRouterTurn(st); got != 2 {
		t.Fatalf("expected second bump to return 2, got %d", got)
	}
	if st.Vars["assistant_router_turns"] != "2" {
		t.Fatalf("expected Vars to persist the counter, got %v", st.Vars)
	}
}
