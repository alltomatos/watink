package flow

import (
	"fmt"

	"github.com/alltomatos/watinkdev/business/internal/domain"
)

// buildRichButtons converts the QuickAnswer content's raw button list
// ({id,label,type,url,phoneNumber,copyCode}) into engine-neutral
// domain.InteractiveButton — the same source shape BuildNativeFlowButtons
// consumes for the whatsmeow/AMQP path, kept in sync deliberately.
func buildRichButtons(raw interface{}) []domain.InteractiveButton {
	buttons := make([]domain.InteractiveButton, 0)
	rawBtns, ok := raw.([]interface{})
	if !ok {
		return buttons
	}
	for i, rb := range rawBtns {
		bm, ok := rb.(map[string]interface{})
		if !ok {
			continue
		}
		id, _ := bm["id"].(string)
		label, _ := bm["label"].(string)
		if id == "" {
			id = fmt.Sprintf("btn_%d", i)
		}
		btnType, _ := bm["type"].(string)
		var kind, value string
		switch btnType {
		case "url":
			kind = "url"
			value, _ = bm["url"].(string)
		case "call":
			kind = "call"
			value, _ = bm["phoneNumber"].(string)
		case "copy":
			kind = "copy"
			value, _ = bm["copyCode"].(string)
			if value == "" {
				value = id
			}
		default: // "quickreply" / "quick_reply" / vazio
			kind = "quick_reply"
			value = id
		}
		buttons = append(buttons, domain.InteractiveButton{ID: id, Kind: kind, Label: label, Value: value})
	}
	return buttons
}

// BuildRichMessageRequest translates a QuickAnswer type + interpolated
// message + decoded content into the engine-neutral domain.RichMessageRequest
// consumed by domain.RichMessageEngine implementations (e.g. izapia). Only
// called for the rich types (interactive_buttons/list/poll/carousel/pix) —
// text/media are sent via WhatsAppEngine.SendText/SendMedia directly. Mirrors
// BuildQuickAnswerCommand's per-type field mapping so the two translations
// (AMQP-shaped vs engine-neutral) never drift on business meaning, only on
// wire shape.
func BuildRichMessageRequest(qaType, message string, contentMap map[string]interface{}) domain.RichMessageRequest {
	switch qaType {
	case "interactive_buttons":
		bodyText, _ := contentMap["body"].(string)
		if bodyText == "" {
			bodyText = message
		}
		return domain.RichMessageRequest{Kind: "interactive", Body: bodyText, Buttons: buildRichButtons(contentMap["buttons"])}

	case "list":
		bodyText, _ := contentMap["body"].(string)
		if bodyText == "" {
			bodyText = message
		}
		buttonText, _ := contentMap["button"].(string)
		if buttonText == "" {
			buttonText = "Ver opções"
		}
		var sections []domain.ListSection
		if rawSecs, ok := contentMap["sections"].([]interface{}); ok {
			for _, rs := range rawSecs {
				sm, ok := rs.(map[string]interface{})
				if !ok {
					continue
				}
				var rows []domain.ListRow
				if rawRows, ok := sm["rows"].([]interface{}); ok {
					for _, rr := range rawRows {
						rm, ok := rr.(map[string]interface{})
						if !ok {
							continue
						}
						id, _ := rm["id"].(string)
						title, _ := rm["title"].(string)
						desc, _ := rm["description"].(string)
						rows = append(rows, domain.ListRow{ID: id, Title: title, Description: desc})
					}
				}
				title, _ := sm["title"].(string)
				sections = append(sections, domain.ListSection{Title: title, Rows: rows})
			}
		}
		return domain.RichMessageRequest{
			Kind: "interactive",
			Body: bodyText,
			Buttons: []domain.InteractiveButton{
				{Kind: "list", Label: buttonText, List: sections},
			},
		}

	case "pix":
		bodyText, _ := contentMap["body"].(string)
		if bodyText == "" {
			bodyText = message
		}
		pixKey, _ := contentMap["pixKey"].(string)
		pixName, _ := contentMap["pixName"].(string)
		finalBody := bodyText
		if finalBody != "" {
			finalBody += "\n\n"
		}
		finalBody += "💳 *Pagamento via PIX*"
		if pixName != "" {
			finalBody += "\n👤 " + pixName
		}
		finalBody += "\n🔑 Chave: " + pixKey
		return domain.RichMessageRequest{
			Kind: "interactive",
			Body: finalBody,
			Buttons: []domain.InteractiveButton{
				{Kind: "copy", Label: "Copiar chave PIX", Value: pixKey},
			},
		}

	case "poll":
		question, _ := contentMap["question"].(string)
		if question == "" {
			question = message
		}
		var options []string
		if rawOpts, ok := contentMap["options"].([]interface{}); ok {
			for _, o := range rawOpts {
				if s, ok := o.(string); ok {
					options = append(options, s)
				}
			}
		}
		selectableCount := 1
		if ms, ok := contentMap["maxSelections"].(float64); ok {
			selectableCount = int(ms)
		}
		return domain.RichMessageRequest{Kind: "poll", PollQuestion: question, PollOptions: options, PollSelectableCount: selectableCount}

	case "carousel":
		bodyText, _ := contentMap["body"].(string)
		if bodyText == "" {
			bodyText = message
		}
		var cards []domain.CarouselCard
		if rawCards, ok := contentMap["cards"].([]interface{}); ok {
			for _, rc := range rawCards {
				cm, ok := rc.(map[string]interface{})
				if !ok {
					continue
				}
				img, _ := cm["image"].(string)
				title, _ := cm["title"].(string)
				cards = append(cards, domain.CarouselCard{
					ImageURL: img,
					Title:    title,
					Buttons:  buildRichButtons(cm["buttons"]),
				})
			}
		}
		return domain.RichMessageRequest{Kind: "carousel", Body: bodyText, Cards: cards}

	default:
		return domain.RichMessageRequest{}
	}
}
