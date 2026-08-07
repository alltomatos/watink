package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
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

	contact, err := ensureGroupContact(db, send.TenantID, send.JID, send.Subject)
	if err != nil {
		return err
	}
	ticket, err := ensureGroupTicket(db, send.TenantID, send.WhatsappID, contact)
	if err != nil {
		return err
	}

	vars := map[string]string{
		"group_name":    send.Subject,
		"campaign_name": campaign.Name,
	}
	message := utils.InterpolateVariables(v.Message, vars)

	var contentMap map[string]interface{}
	if v.Content != "" {
		_ = json.Unmarshal([]byte(v.Content), &contentMap)
	}
	contentMap = flow.NormalizeQuickAnswerContent(v.Type, contentMap)
	if body, ok := contentMap["body"].(string); ok {
		contentMap["body"] = utils.InterpolateVariables(body, vars)
	}

	commandType, payload := flow.BuildQuickAnswerCommand(v.Type, message, contentMap, send.WhatsappID, send.EnvID, send.JID)

	if _, err := persistOutgoingCampaignMessage(db, core, send.TenantID, ticket, send, v.Type, message, contentMap); err != nil {
		return err
	}

	msg := flow.OutboundMessage{
		TenantID:    send.TenantID,
		SubjectType: "none",
		EnvID:       send.EnvID,
		To:          send.JID,
		SessionID:   strconv.Itoa(send.WhatsappID),
		Body:        message,
		Meta: map[string]interface{}{
			"commandType": commandType,
			"payload":     payload,
			"qaType":      v.Type,
			"qaContent":   contentMap,
			"qaMessage":   message,
			"messageId":   send.EnvID,
		},
	}
	if v.Type == "media" {
		msg.Meta["mediaUrl"] = payload["mediaUrl"]
		msg.Meta["mediaType"] = payload["mediaType"]
		msg.Meta["mimeType"] = payload["mimeType"]
	}

	if err := adapter.Send(ctx, msg); err != nil {
		markOutgoingCampaignMessageUndelivered(db, send.EnvID, send.TenantID)
		return err
	}

	db.Model(&models.GroupCampaignSend{}).Where(`id = ?`, send.ID).Updates(map[string]interface{}{
		"ticketId":  ticket.ID,
		"messageId": send.EnvID,
	})

	return nil
}
