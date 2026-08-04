package plugins

import (
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// enrichContactsFromGroups is best-effort: every time the Groups plugin
// fetches GroupInfo from WhatsApp (ListGroups/GetGroup), it already carries
// PictureURL + the full Participants list -- richer than what the core's
// own contact-sync flow gets for a group (ContactController.SyncContact's
// GetContactPictureURL is built for individual numbers, not groups).
// Reusing that response here updates the matching Contact row instead of
// making a second WhatsApp round-trip just to get the same picture. Never
// blocks/fails the caller's actual response -- write errors are swallowed,
// this is a side effect of viewing groups, not the handler's job.
func enrichContactsFromGroups(db *gorm.DB, tenantID uuid.UUID, groups []domain.GroupInfo) {
	writeDB := db.Session(&gorm.Session{NewDB: true})
	for _, g := range groups {
		enrichContactFromGroup(writeDB, tenantID, g)
	}
}

// enrichContactFromGroup matches Contact.Number against the group's JID
// local part (same convention as pluginContactJID: contact.Number +
// "@g.us" for IsGroup contacts) and updates picture + participant count.
// No-op if no matching Contact row exists yet (the group was never
// messaged, so receive_message.go never created one).
func enrichContactFromGroup(writeDB *gorm.DB, tenantID uuid.UUID, g domain.GroupInfo) {
	number := strings.SplitN(g.JID, "@", 2)[0]
	if number == "" {
		return
	}
	count := len(g.Participants)
	updates := map[string]interface{}{"groupParticipantCount": count}
	if g.PictureURL != "" {
		updates["profilePicUrl"] = g.PictureURL
	}
	writeDB.Model(&models.Contact{}).
		Where(`"tenantId" = ? AND number = ? AND "isGroup" = ?`, tenantID, number, true).
		Updates(updates)
}
