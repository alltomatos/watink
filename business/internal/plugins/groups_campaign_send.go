package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	errAdapterNotConfigured   = errors.New("groups: WhatsAppAdapter não configurado (Publisher ausente)")
	errVariantIndexOutOfRange = errors.New("groups: variantIndex do envio fora do snapshot da run")
)

// sendOne dispatches ONE campaign send: loads the run's frozen variant
// snapshot, interpolates+normalizes the content, persists it as a Ticket
// message (BEFORE publishing -- see groups_campaign_ticket.go), and hands
// it to flow.WhatsAppAdapter -- the exact same shape
// flow/executor_quickanswer.go already builds for the FlowBuilder
// quickAnswer node, so both the AMQP (whatsmeow) and the izapia rich-send
// path already understand this Meta contract without any change to either
// engine.
//
// adapter == nil is fail-closed, not a no-op: GroupsPlugin.OnActivate only
// builds one when a real domain.CommandPublisher was injected (see
// groups.go) -- without it, no campaign send is a phantom success.
func sendOne(ctx context.Context, db *gorm.DB, core sdk.WatinkCore, adapter *flow.WhatsAppAdapter, send models.GroupCampaignSend) error {
	if adapter == nil {
		return errAdapterNotConfigured
	}

	var run models.GroupCampaignRun
	if err := db.Where(`id = ?`, send.RunID).First(&run).Error; err != nil {
		return err
	}
	var campaign models.GroupCampaign
	if err := db.Where(`id = ?`, send.CampaignID).First(&campaign).Error; err != nil {
		return err
	}

	var snapshot []variantSnapshotEntry
	if err := json.Unmarshal(run.VariantsSnapshot, &snapshot); err != nil {
		return err
	}
	if send.VariantIndex < 0 || send.VariantIndex >= len(snapshot) {
		return errVariantIndexOutOfRange
	}
	v := snapshot[send.VariantIndex]

	ticket, effectiveID, err := dispatchCampaignMessage(ctx, db, core, adapter, dispatchCampaignMessageParams{
		TenantID:     send.TenantID,
		WhatsappID:   send.WhatsappID,
		JID:          send.JID,
		Subject:      send.Subject,
		CampaignName: campaign.Name,
		EnvID:        send.EnvID,
		VariantType:  v.Type,
		Message:      v.Message,
		Content:      v.Content,
	})
	if err != nil {
		return err
	}

	// effectiveID == send.EnvID for every AMQP/whatsmeow send; for izapia it's
	// izapia's OWN message_id (dispatchCampaignMessage already renamed the
	// persisted Message's PK to match) -- messageId here MUST be the real one,
	// never EnvID unconditionally, or reply correlation (issue #598) can never
	// find this send again.
	db.Model(&models.GroupCampaignSend{}).Where(`id = ?`, send.ID).Updates(map[string]interface{}{
		"ticketId":  ticket.ID,
		"messageId": effectiveID,
	})

	return nil
}

// dispatchCampaignMessageParams is the explicit-field equivalent of the
// GroupCampaignSend-shaped input sendOne consumes -- lets /test (issue
// #597) dispatch a real message for a single ad-hoc group WITHOUT a
// GroupCampaignSend row (nothing scheduled, nothing to claim).
type dispatchCampaignMessageParams struct {
	TenantID     uuid.UUID
	WhatsappID   int
	JID          string
	Subject      string
	CampaignName string
	EnvID        string
	VariantType  string
	Message      string
	Content      string
}

// dispatchCampaignMessage is the shared core of sendOne and /test: resolve
// (or create) the group's ticket/contact, interpolate+normalize the
// variant content, persist the outgoing Message BEFORE publishing (needed
// for quoted-reply correlation, issue #598), then hand it to
// flow.WhatsAppAdapter using the exact Meta shape
// flow/executor_quickanswer.go already builds for the FlowBuilder
// quickAnswer node.
//
// Returns the EFFECTIVE message id actually used by WhatsApp -- for every
// AMQP/whatsmeow send this equals p.EnvID, but izapia assigns its OWN
// message_id server-side (see domain.WhatsAppEngine's doc comment); when
// that happens this function renames the just-persisted Message's primary
// key to the real id, because reply correlation matches replies against
// Messages.id (via QuotedMsgID) and GroupCampaignSend.MessageID -- keeping
// EnvID there would mean no future reply could ever match. Callers MUST
// persist the returned id, never assume it equals p.EnvID.
func dispatchCampaignMessage(ctx context.Context, db *gorm.DB, core sdk.WatinkCore, adapter *flow.WhatsAppAdapter, p dispatchCampaignMessageParams) (models.Ticket, string, error) {
	var ticket models.Ticket
	if adapter == nil {
		return ticket, "", errAdapterNotConfigured
	}

	contact, err := ensureGroupContact(db, p.TenantID, p.JID, p.Subject)
	if err != nil {
		return ticket, "", err
	}
	ticket, err = ensureGroupTicket(db, p.TenantID, p.WhatsappID, contact)
	if err != nil {
		return ticket, "", err
	}

	vars := map[string]string{
		"group_name":    p.Subject,
		"campaign_name": p.CampaignName,
	}
	message := utils.InterpolateVariables(p.Message, vars)

	var contentMap map[string]interface{}
	if p.Content != "" {
		_ = json.Unmarshal([]byte(p.Content), &contentMap)
	}
	contentMap = flow.NormalizeQuickAnswerContent(p.VariantType, contentMap)
	if body, ok := contentMap["body"].(string); ok {
		contentMap["body"] = utils.InterpolateVariables(body, vars)
	}

	commandType, payload := flow.BuildQuickAnswerCommand(p.VariantType, message, contentMap, p.WhatsappID, p.EnvID, p.JID)

	if _, err := persistOutgoingCampaignMessageForTicket(db, core, p.TenantID, ticket, p.EnvID, p.VariantType, message, contentMap); err != nil {
		return ticket, "", err
	}

	msg := flow.OutboundMessage{
		TenantID:    p.TenantID,
		SubjectType: "none",
		EnvID:       p.EnvID,
		To:          p.JID,
		SessionID:   strconv.Itoa(p.WhatsappID),
		Body:        message,
		Meta: map[string]interface{}{
			"commandType": commandType,
			"payload":     payload,
			"qaType":      p.VariantType,
			"qaContent":   contentMap,
			"qaMessage":   message,
			"messageId":   p.EnvID,
		},
	}
	if p.VariantType == "media" {
		msg.Meta["mediaUrl"] = payload["mediaUrl"]
		msg.Meta["mediaType"] = payload["mediaType"]
		msg.Meta["mimeType"] = payload["mimeType"]
	}

	effectiveID, err := adapter.SendReportingID(ctx, msg)
	if err != nil {
		markOutgoingCampaignMessageUndelivered(db, p.EnvID, p.TenantID)
		return ticket, "", err
	}
	if effectiveID == "" {
		effectiveID = p.EnvID
	}
	if effectiveID != p.EnvID {
		// izapia assigned its own message_id -- rename the Message row we just
		// persisted (PK == p.EnvID) to the REAL WhatsApp id. Nothing else has a
		// real FK to Messages.id (QuotedMsgID/GroupCampaignSend.MessageID are
		// informal string references), so this is safe. Best-effort: a failure
		// here means reply correlation degrades for this one send, not that the
		// message itself failed to go out.
		if err := db.Exec(`UPDATE "Messages" SET id = ? WHERE id = ? AND "tenantId" = ?`, effectiveID, p.EnvID, p.TenantID).Error; err != nil {
			log.Printf("[groups] campaign send: falha ao renomear id da mensagem para o id real da izapia (env=%s real=%s): %v", p.EnvID, effectiveID, err)
		}
	}
	return ticket, effectiveID, nil
}
