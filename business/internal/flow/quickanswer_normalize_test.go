package flow

import (
	"testing"
)

func TestNormalizeQuickAnswerContent_ListButtonTextLegacyKey(t *testing.T) {
	got := NormalizeQuickAnswerContent("list", map[string]interface{}{
		"button_text": "Ver opções",
		"sections":    []interface{}{},
	})
	if got["button"] != "Ver opções" {
		t.Fatalf("expected button_text to normalize into button, got %#v", got)
	}
	if _, exists := got["button_text"]; exists {
		t.Fatalf("expected legacy button_text key to be removed, got %#v", got)
	}
}

func TestNormalizeQuickAnswerContent_ListCanonicalKeyIsPreserved(t *testing.T) {
	got := NormalizeQuickAnswerContent("list", map[string]interface{}{
		"button": "Abrir menu",
	})
	if got["button"] != "Abrir menu" {
		t.Fatalf("expected canonical button to round-trip unchanged, got %#v", got)
	}
}

func TestNormalizeQuickAnswerContent_ListCanonicalWinsOverLegacy(t *testing.T) {
	got := NormalizeQuickAnswerContent("list", map[string]interface{}{
		"button":      "Canônico",
		"button_text": "Legado",
	})
	if got["button"] != "Canônico" {
		t.Fatalf("expected canonical key to win when both present, got %#v", got)
	}
}

func TestNormalizeQuickAnswerContent_MediaTypeLegacyKey(t *testing.T) {
	got := NormalizeQuickAnswerContent("media", map[string]interface{}{
		"media_type": "video",
	})
	if got["mediaType"] != "video" {
		t.Fatalf("expected media_type to normalize into mediaType, got %#v", got)
	}
	if _, exists := got["media_type"]; exists {
		t.Fatalf("expected legacy media_type key to be removed, got %#v", got)
	}
}

func TestNormalizeQuickAnswerContent_PollMaxSelectionsLegacyKey(t *testing.T) {
	got := NormalizeQuickAnswerContent("poll", map[string]interface{}{
		"max_selections": float64(3),
	})
	if got["maxSelections"] != float64(3) {
		t.Fatalf("expected max_selections to normalize into maxSelections, got %#v", got)
	}
	if _, exists := got["max_selections"]; exists {
		t.Fatalf("expected legacy max_selections key to be removed, got %#v", got)
	}
}

func TestNormalizeQuickAnswerContent_UnknownKeysPreserved(t *testing.T) {
	got := NormalizeQuickAnswerContent("interactive_buttons", map[string]interface{}{
		"body":    "texto",
		"footer":  "rodapé",
		"buttons": []interface{}{"x"},
	})
	if got["body"] != "texto" || got["footer"] != "rodapé" {
		t.Fatalf("expected unrelated keys untouched, got %#v", got)
	}
}

func TestNormalizeQuickAnswerContent_NilContentReturnsNil(t *testing.T) {
	if got := NormalizeQuickAnswerContent("list", nil); got != nil {
		t.Fatalf("expected nil content to return nil, got %#v", got)
	}
}

func TestNormalizeQuickAnswerContent_DoesNotMutateInput(t *testing.T) {
	input := map[string]interface{}{"button_text": "Original"}
	_ = NormalizeQuickAnswerContent("list", input)
	if _, stillHasLegacy := input["button_text"]; !stillHasLegacy {
		t.Fatalf("expected input map to be untouched by normalization, got %#v", input)
	}
	if _, hasCanonical := input["button"]; hasCanonical {
		t.Fatalf("expected input map to be untouched by normalization, got %#v", input)
	}
}

func TestBuildInteractiveDataJSON_TextReturnsEmptyObject(t *testing.T) {
	got := BuildInteractiveDataJSON("text", map[string]interface{}{})
	if got != "{}" {
		t.Fatalf("expected {} for text type, got %q", got)
	}
}

func TestBuildInteractiveDataJSON_ListIncludesButtonTextAndSections(t *testing.T) {
	got := BuildInteractiveDataJSON("list", map[string]interface{}{
		"button": "Ver opções",
	})
	if got == "{}" {
		t.Fatalf("expected non-empty interactive JSON for list type")
	}
}

func TestBuildInteractiveDataJSON_PollWithoutOptionsReturnsEmptyObject(t *testing.T) {
	got := BuildInteractiveDataJSON("poll", map[string]interface{}{})
	if got != "{}" {
		t.Fatalf("expected {} for poll with no options, got %q", got)
	}
}
