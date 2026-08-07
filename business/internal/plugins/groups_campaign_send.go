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

	ticket, err := dispatchCampaignMessage(ctx, db, core, adapter, dispatchCampaignMessageParams{
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

	db.Model(&models.GroupCampaignSend{}).Where(`id = ?`, send.ID).Updates(map[string]interface{}{
		"ticketId":  ticket.ID,
		"messageId": send.EnvID,
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
func dispatchCampaignMessage(ctx context.Context, db *gorm.DB, core sdk.WatinkCore, adapter *flow.WhatsAppAdapter, p dispatchCampaignMessageParams) (models.Ticket, error) {
	var ticket models.Ticket
	if adapter == nil {
		return ticket, errAdapterNotConfigured
	}

	contact, err := ensureGroupContact(db, p.TenantID, p.JID, p.Subject)
	if err != nil {
		return ticket, err
	}
	ticket, err = ensureGroupTicket(db, p.TenantID, p.WhatsappID, contact)
	if err != nil {
		return ticket, err
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
		return ticket, err
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

	if err := adapter.Send(ctx, msg); err != nil {
		markOutgoingCampaignMessageUndelivered(db, p.EnvID, p.TenantID)
		return ticket, err
	}
	return ticket, nil
}
