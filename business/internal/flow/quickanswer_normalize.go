package flow

import "encoding/json"

// NormalizeQuickAnswerContent fixes a known frontend/backend key mismatch:
// pages/QuickAnswers/quickAnswersHelpers.ts (frontend) writes snake_case
// keys (button_text, media_type, max_selections) that BuildQuickAnswerCommand
// (this package) never reads -- it reads the canonical camelCase (button,
// mediaType, maxSelections). Effect today: a list's button always falls
// back to "Ver opções", a media's mimeType always defaults to image/jpeg,
// and a poll's multi-select silently becomes single-select.
//
// Accepts either spelling and always returns the canonical one, so a
// client that already sends camelCase round-trips unchanged. Unknown keys
// are left untouched. Does NOT mutate the input map -- returns a new one.
//
// Used by campaign send (groups_campaign_send.go, issue #595) so the same
// bug is never propagated there; NOT applied to the QuickAnswers editors
// themselves -- fixing those is a separate, deliberately out-of-scope task
// (see issue #592).
func NormalizeQuickAnswerContent(qaType string, content map[string]interface{}) map[string]interface{} {
	if content == nil {
		return nil
	}
	out := make(map[string]interface{}, len(content))
	for k, v := range content {
		out[k] = v
	}

	switch qaType {
	case "list":
		if _, hasCanonical := out["button"]; !hasCanonical {
			if legacy, ok := out["button_text"]; ok {
				out["button"] = legacy
			}
		}
		delete(out, "button_text")
	case "media":
		if _, hasCanonical := out["mediaType"]; !hasCanonical {
			if legacy, ok := out["media_type"]; ok {
				out["mediaType"] = legacy
			}
		}
		delete(out, "media_type")
	case "poll":
		if _, hasCanonical := out["maxSelections"]; !hasCanonical {
			if legacy, ok := out["max_selections"]; ok {
				out["maxSelections"] = legacy
			}
		}
		delete(out, "max_selections")
	}

	return out
}

// BuildInteractiveDataJSON builds the Message.DataJson "interactive" chip
// rendered in the chat bubble for a non-text QuickAnswer/campaign send.
// Moved here from internal/controllers/quick_answer.go (unexported
// buildInteractiveDataJSON) because internal/plugins cannot import
// internal/controllers (controllers already imports plugins -- reverse
// import would cycle), and internal/flow is already the shared home of
// BuildQuickAnswerCommand for exactly this reason.
func BuildInteractiveDataJSON(qaType string, contentMap map[string]interface{}) string {
	const empty = "{}"
	var meta map[string]interface{}

	switch qaType {
	case "interactive_buttons":
		btns := make([]map[string]interface{}, 0)
		if rawBtns, ok := contentMap["buttons"].([]interface{}); ok {
			for _, rb := range rawBtns {
				bm, ok := rb.(map[string]interface{})
				if !ok {
					continue
				}
				b := map[string]interface{}{"label": bm["label"], "id": bm["id"]}
				if t, ok := bm["type"].(string); ok && t != "" {
					b["type"] = t
				}
				if u, ok := bm["url"].(string); ok && u != "" {
					b["url"] = u
				}
				if p, ok := bm["phoneNumber"].(string); ok && p != "" {
					b["phone"] = p
				}
				btns = append(btns, b)
			}
		}
		if len(btns) == 0 {
			return empty
		}
		meta = map[string]interface{}{"type": "buttons", "buttons": btns}
		if f, ok := contentMap["footer"].(string); ok && f != "" {
			meta["footer"] = f
		}
	case "list":
		meta = map[string]interface{}{"type": "list", "sections": contentMap["sections"]}
		if bt, ok := contentMap["button"].(string); ok && bt != "" {
			meta["buttonText"] = bt
		}
		if f, ok := contentMap["footer"].(string); ok && f != "" {
			meta["footer"] = f
		}
	case "poll":
		opts := make([]interface{}, 0)
		if rawOpts, ok := contentMap["options"].([]interface{}); ok {
			opts = rawOpts
		}
		if len(opts) == 0 {
			return empty
		}
		meta = map[string]interface{}{"type": "poll", "options": opts}
		if ms, ok := contentMap["maxSelections"].(float64); ok {
			meta["selectableCount"] = int(ms)
		}
	case "carousel":
		cards := make([]map[string]interface{}, 0)
		if rawCards, ok := contentMap["cards"].([]interface{}); ok {
			for _, rc := range rawCards {
				cm, ok := rc.(map[string]interface{})
				if !ok {
					continue
				}
				card := map[string]interface{}{
					"image": cm["image"], "title": cm["title"], "footer": cm["footer"],
				}
				dispBtns := make([]map[string]interface{}, 0)
				if rb, ok := cm["buttons"].([]interface{}); ok {
					for _, b := range rb {
						bm, ok := b.(map[string]interface{})
						if !ok {
							continue
						}
						db := map[string]interface{}{"label": bm["label"], "id": bm["id"]}
						if t, ok := bm["type"].(string); ok && t != "" {
							db["type"] = t
						}
						if u, ok := bm["url"].(string); ok && u != "" {
							db["url"] = u
						}
						dispBtns = append(dispBtns, db)
					}
				}
				card["buttons"] = dispBtns
				cards = append(cards, card)
			}
		}
		if len(cards) == 0 {
			return empty
		}
		meta = map[string]interface{}{"type": "carousel", "cards": cards}
	case "pix":
		meta = map[string]interface{}{
			"type":    "pix",
			"pixKey":  contentMap["pixKey"],
			"pixName": contentMap["pixName"],
			"pixType": contentMap["pixType"],
		}
	default:
		return empty
	}

	raw, err := json.Marshal(map[string]interface{}{"interactive": meta})
	if err != nil {
		return empty
	}
	return string(raw)
}
