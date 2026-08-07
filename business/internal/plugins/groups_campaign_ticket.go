package plugins

import (
	"strconv"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ensureGroupContact finds or creates the Contact row for a group JID --
// mirrors receive_message.go's FindOrCreate for a group (IsGroup=true,
// Number = the JID's local part), except here it's the CAMPAIGN posting
// into the group, not a message received from it, so there is no
// PushName/ProfilePicURL to seed on creation.
//
// Contacts.number is UNIQUE GLOBALLY (models/contact.go), not per-tenant --
// a pre-existing gap (two tenants with chips in the same group collide).
// Retry-on-conflict here just re-reads the row another goroutine/tenant
// already created, rather than surfacing a spurious 500 for something this
// function didn't cause and can't fix.
func ensureGroupContact(db *gorm.DB, tenantID uuid.UUID, jid, subject string) (models.Contact, error) {
	number := strings.SplitN(jid, "@", 2)[0]

	var contact models.Contact
	err := db.Where(`"tenantId" = ? AND number = ? AND "isGroup" = ?`, tenantID, number, true).First(&contact).Error
	if err == nil {
		return contact, nil
	}
	if err != gorm.ErrRecordNotFound {
		return contact, err
	}

	contact = models.Contact{TenantID: tenantID, Name: subject, Number: number, IsGroup: true}
	if createErr := db.Create(&contact).Error; createErr == nil {
		return contact, nil
	} else if !isUniqueViolation(createErr) {
		return contact, createErr
	}

	// Unique violation on Contacts.number: outra goroutine/tenant já criou
	// -- relê em vez de propagar.
	if reErr := db.Where(`"tenantId" = ? AND number = ? AND "isGroup" = ?`, tenantID, number, true).First(&contact).Error; reErr != nil {
		return contact, reErr
	}
	return contact, nil
}

// ensureGroupTicket reuses an open ticket for (tenantId, contactId,
// whatsappId) or creates one -- Status "open" for a fresh group ticket
// mirrors receive_message.go's own group behavior (groups open directly,
// they never sit in "pending" waiting for triage).
func ensureGroupTicket(db *gorm.DB, tenantID uuid.UUID, whatsappID int, contact models.Contact) (models.Ticket, error) {
	var ticket models.Ticket
	err := db.Where(`"tenantId" = ? AND "contactId" = ? AND "whatsappId" = ? AND status IN ?`,
		tenantID, contact.ID, whatsappID, []string{"open", "pending"}).First(&ticket).Error
	if err == nil {
		return ticket, nil
	}
	if err != gorm.ErrRecordNotFound {
		return ticket, err
	}

	ticket = models.Ticket{
		TenantID:   tenantID,
		ContactID:  contact.ID,
		WhatsappID: whatsappID,
		Status:     "open",
		IsGroup:    true,
	}
	if createErr := db.Create(&ticket).Error; createErr != nil {
		return ticket, createErr
	}
	return ticket, nil
}

// persistOutgoingCampaignMessageForTicket records the outgoing campaign
// message as a normal outbound Message (ID == envID -- see
// models.GroupCampaignSend doc) BEFORE the publish, not after:
// receive_message.go only sets Message.QuotedMsgID on an INBOUND reply
// when the quoted message id already exists in the Messages table
// (ExistsByID check) -- persisting first is what makes quoted-reply
// correlation (issue #598) possible at all, not just a nicety for the chat
// UI. Takes envID directly (not a GroupCampaignSend) so /test (issue #597)
// can reuse it without a send row.
func persistOutgoingCampaignMessageForTicket(db *gorm.DB, core sdk.WatinkCore, tenantID uuid.UUID, ticket models.Ticket, envID, qaType, body string, contentMap map[string]interface{}) (models.Message, error) {
	now := time.Now()
	msg := models.Message{
		ID:        envID,
		Body:      body,
		TicketID:  ticket.ID,
		FromMe:    true,
		ContactID: &ticket.ContactID,
		TenantID:  tenantID,
		Reactions: "[]",
		DataJson:  flow.BuildInteractiveDataJSON(qaType, contentMap),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := db.Create(&msg).Error; err != nil {
		return msg, err
	}

	db.Model(&models.Ticket{}).Where(`id = ?`, ticket.ID).Updates(map[string]interface{}{
		"lastMessage": body,
		"updatedAt":   now,
	})

	if core != nil {
		payload := map[string]interface{}{"action": "create", "message": msg}
		core.EmitSocketEvent("chat:"+strconv.Itoa(ticket.ID), "appMessage", payload)
		core.EmitSocketEvent("tenant:"+tenantID.String(), "appMessage", payload)
	}

	return msg, nil
}

// markOutgoingCampaignMessageUndelivered soft-deletes the just-persisted
// Message when the actual publish fails AFTER persistOutgoingCampaignMessageForTicket
// already wrote it -- the chat must never show a message that never left
// (IsDeleted mirrors the existing convention used for revoked messages).
func markOutgoingCampaignMessageUndelivered(db *gorm.DB, messageID string, tenantID uuid.UUID) {
	db.Model(&models.Message{}).
		Where(`id = ? AND "tenantId" = ?`, messageID, tenantID).
		Update("isDeleted", true)
}
