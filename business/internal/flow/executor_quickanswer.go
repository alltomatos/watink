package flow

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"gorm.io/gorm"
)

// quickAnswerData is the "quickAnswer" node envelope (QuickAnswerForm.tsx):
// the id of a QuickAnswer template configured in the Respostas Rápidas module.
type quickAnswerData struct {
	QuickAnswerID string `json:"quickAnswerId"`
}

// quickAnswerExecutor sends a QuickAnswers template (text/interactive_buttons/
// list/media/poll/carousel/pix) from within a flow run. It reuses the same
// payload-building code as the manual "Enviar" button (QuickAnswerController.
// Send, via flow.BuildQuickAnswerCommand) so the two paths never drift, then
// advances.
//
// Reads use Session(NewDB) + manual WHERE "tenantId" (RLS inert in worker).
type quickAnswerExecutor struct{}

func (quickAnswerExecutor) Type() string { return string(NodeQuickAnswer) }

func (quickAnswerExecutor) Execute(ctx context.Context, st *ExecState, node Node) (Outcome, error) {
	var d quickAnswerData
	if len(node.Data) > 0 {
		_ = json.Unmarshal(node.Data, &d)
	}

	if d.QuickAnswerID == "" || st.DB == nil {
		return Outcome{Kind: OutcomeAdvance, Detail: "no quick answer configured"}, nil
	}

	var qa models.QuickAnswer
	if err := st.DB.Session(&gorm.Session{NewDB: true}).
		Where(`id = ? AND "tenantId" = ?`, d.QuickAnswerID, st.TenantID).
		First(&qa).Error; err != nil {
		return Outcome{}, err
	}

	content := applyVars(st, qa.Content)
	message := applyVars(st, qa.Message)

	qaType := qa.Type
	if qaType == "" {
		qaType = "text"
	}

	var contentMap map[string]interface{}
	if content != "" {
		_ = json.Unmarshal([]byte(content), &contentMap)
	}

	to := destination(st)
	sid, _ := strconv.Atoi(sessionID(st))
	env := envID(st, node.ID)

	commandType, payload := BuildQuickAnswerCommand(qaType, message, contentMap, sid, env, to)

	// qaType/qaContent/qaMessage let WhatsAppAdapter.sendViaEngine rebuild an
	// engine-neutral domain.RichMessageRequest (via BuildRichMessageRequest)
	// for non-AMQP engines, without reverse-engineering the AMQP-shaped
	// commandType/payload above (which stays exactly as-is for whatsmeow).
	meta := map[string]any{
		"commandType": commandType,
		"payload":     payload,
		"qaType":      qaType,
		"qaContent":   contentMap,
		"qaMessage":   message,
	}
	if qaType == "media" {
		// Media quick answers keep their fields nested in payload (built by
		// BuildQuickAnswerCommand) — flatten into Meta too, mirroring the
		// plain "message" node (executor_message.go), which is what
		// WhatsAppAdapter's plain text/media engine path reads.
		meta["mediaUrl"] = payload["mediaUrl"]
		meta["mediaType"] = payload["mediaType"]
		meta["mimeType"] = payload["mimeType"]
	}
	if err := sendWhatsAppEnv(ctx, st, env, message, meta); err != nil {
		return Outcome{}, err
	}
	return Outcome{Kind: OutcomeAdvance, Detail: "quick answer sent"}, nil
}
