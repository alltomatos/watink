package flow

import "testing"

func TestBuildRichMessageRequest_InteractiveButtons(t *testing.T) {
	content := map[string]interface{}{
		"body": "Escolha uma opção",
		"buttons": []interface{}{
			map[string]interface{}{"id": "b1", "label": "Site", "type": "url", "url": "https://ex.com"},
			map[string]interface{}{"id": "b2", "label": "Ligar", "type": "call", "phoneNumber": "+5511999999999"},
			map[string]interface{}{"id": "b3", "label": "Copiar", "type": "copy", "copyCode": "CODE123"},
			map[string]interface{}{"id": "b4", "label": "Responder"},
		},
	}
	req := BuildRichMessageRequest("interactive_buttons", "fallback", content)

	if req.Kind != "interactive" {
		t.Fatalf("Kind = %q, want interactive", req.Kind)
	}
	if req.Body != "Escolha uma opção" {
		t.Fatalf("Body = %q", req.Body)
	}
	if len(req.Buttons) != 4 {
		t.Fatalf("len(Buttons) = %d, want 4", len(req.Buttons))
	}
	if req.Buttons[0].Kind != "url" || req.Buttons[0].Value != "https://ex.com" {
		t.Fatalf("button[0] = %+v", req.Buttons[0])
	}
	if req.Buttons[1].Kind != "call" || req.Buttons[1].Value != "+5511999999999" {
		t.Fatalf("button[1] = %+v", req.Buttons[1])
	}
	if req.Buttons[2].Kind != "copy" || req.Buttons[2].Value != "CODE123" {
		t.Fatalf("button[2] = %+v", req.Buttons[2])
	}
	if req.Buttons[3].Kind != "quick_reply" || req.Buttons[3].Value != "b4" {
		t.Fatalf("button[3] = %+v", req.Buttons[3])
	}
}

func TestBuildRichMessageRequest_InteractiveButtons_BodyFallsBackToMessage(t *testing.T) {
	req := BuildRichMessageRequest("interactive_buttons", "fallback body", map[string]interface{}{})
	if req.Body != "fallback body" {
		t.Fatalf("Body = %q, want fallback", req.Body)
	}
}

func TestBuildRichMessageRequest_List(t *testing.T) {
	content := map[string]interface{}{
		"body":   "Menu",
		"button": "Ver opções",
		"sections": []interface{}{
			map[string]interface{}{
				"title": "Seção 1",
				"rows": []interface{}{
					map[string]interface{}{"id": "r1", "title": "Item 1", "description": "desc 1"},
				},
			},
		},
	}
	req := BuildRichMessageRequest("list", "fallback", content)

	if req.Kind != "interactive" {
		t.Fatalf("Kind = %q, want interactive", req.Kind)
	}
	if len(req.Buttons) != 1 || req.Buttons[0].Kind != "list" {
		t.Fatalf("Buttons = %+v, want single list button", req.Buttons)
	}
	if req.Buttons[0].Label != "Ver opções" {
		t.Fatalf("Label = %q", req.Buttons[0].Label)
	}
	if len(req.Buttons[0].List) != 1 || req.Buttons[0].List[0].Title != "Seção 1" {
		t.Fatalf("List = %+v", req.Buttons[0].List)
	}
	if len(req.Buttons[0].List[0].Rows) != 1 || req.Buttons[0].List[0].Rows[0].ID != "r1" {
		t.Fatalf("Rows = %+v", req.Buttons[0].List[0].Rows)
	}
}

func TestBuildRichMessageRequest_List_DefaultButtonLabel(t *testing.T) {
	req := BuildRichMessageRequest("list", "msg", map[string]interface{}{})
	if req.Buttons[0].Label != "Ver opções" {
		t.Fatalf("Label = %q, want default", req.Buttons[0].Label)
	}
}

func TestBuildRichMessageRequest_Pix(t *testing.T) {
	content := map[string]interface{}{
		"body":    "Pague aqui",
		"pixKey":  "chave@pix.com",
		"pixName": "Fulano",
	}
	req := BuildRichMessageRequest("pix", "fallback", content)

	if req.Kind != "interactive" {
		t.Fatalf("Kind = %q, want interactive", req.Kind)
	}
	if len(req.Buttons) != 1 || req.Buttons[0].Kind != "copy" || req.Buttons[0].Value != "chave@pix.com" {
		t.Fatalf("Buttons = %+v", req.Buttons)
	}
	if req.Body == "" {
		t.Fatal("Body should contain the formatted PIX text")
	}
}

func TestBuildRichMessageRequest_Poll(t *testing.T) {
	content := map[string]interface{}{
		"question":      "Qual sua cor favorita?",
		"options":       []interface{}{"Azul", "Verde"},
		"maxSelections": float64(2),
	}
	req := BuildRichMessageRequest("poll", "fallback", content)

	if req.Kind != "poll" {
		t.Fatalf("Kind = %q, want poll", req.Kind)
	}
	if req.PollQuestion != "Qual sua cor favorita?" {
		t.Fatalf("PollQuestion = %q", req.PollQuestion)
	}
	if len(req.PollOptions) != 2 || req.PollOptions[0] != "Azul" {
		t.Fatalf("PollOptions = %+v", req.PollOptions)
	}
	if req.PollSelectableCount != 2 {
		t.Fatalf("PollSelectableCount = %d, want 2", req.PollSelectableCount)
	}
}

func TestBuildRichMessageRequest_Poll_DefaultSelectableCount(t *testing.T) {
	req := BuildRichMessageRequest("poll", "msg", map[string]interface{}{"question": "q", "options": []interface{}{"a", "b"}})
	if req.PollSelectableCount != 1 {
		t.Fatalf("PollSelectableCount = %d, want default 1", req.PollSelectableCount)
	}
}

func TestBuildRichMessageRequest_Carousel(t *testing.T) {
	content := map[string]interface{}{
		"body": "Confira nossos produtos",
		"cards": []interface{}{
			map[string]interface{}{
				"image": "https://ex.com/1.jpg",
				"title": "Produto 1",
				"buttons": []interface{}{
					map[string]interface{}{"id": "c1", "label": "Ver", "type": "url", "url": "https://ex.com/p1"},
				},
			},
		},
	}
	req := BuildRichMessageRequest("carousel", "fallback", content)

	if req.Kind != "carousel" {
		t.Fatalf("Kind = %q, want carousel", req.Kind)
	}
	if len(req.Cards) != 1 || req.Cards[0].ImageURL != "https://ex.com/1.jpg" || req.Cards[0].Title != "Produto 1" {
		t.Fatalf("Cards = %+v", req.Cards)
	}
	if len(req.Cards[0].Buttons) != 1 || req.Cards[0].Buttons[0].Kind != "url" {
		t.Fatalf("Card buttons = %+v", req.Cards[0].Buttons)
	}
}

func TestBuildRichMessageRequest_UnknownType_ReturnsZeroValue(t *testing.T) {
	req := BuildRichMessageRequest("text", "msg", nil)
	if req.Kind != "" {
		t.Fatalf("Kind = %q, want empty for non-rich type", req.Kind)
	}
}
