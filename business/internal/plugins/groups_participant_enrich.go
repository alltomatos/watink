package plugins

import (
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// enrichParticipantsFromContacts fills DisplayName/PictureURL for a group's
// participants from the tenant's EXISTING Contact rows — same
// reuse-what-the-core-already-has strategy as enrichContactFromGroup
// (groups_contact_enrich.go), just applied per participant instead of per
// group. A participant only gets enriched if they've already messaged the
// tenant individually at some point (receive_message.go creates/updates
// Contact.Name from the WhatsApp push name, Contact.ProfilePicUrl from the
// contact-sync flow) — a participant who never DM'd the number stays
// JID-only, which is correct: there's no cheap way to resolve a name for
// someone the tenant has never talked to (izapia's participant payload has
// no name field; asking whatsmeow/izapia for a fresh picture per
// participant would mean one WhatsApp round-trip per member — a real
// rate-limit/ban risk on large groups, so deliberately not done here).
//
// One bulk query (never N+1) regardless of participant count.
func enrichParticipantsFromContacts(db *gorm.DB, tenantID uuid.UUID, participants []domain.Participant) []domain.Participant {
	if len(participants) == 0 {
		return participants
	}

	numbers := make([]string, 0, len(participants))
	seen := make(map[string]bool, len(participants))
	for _, p := range participants {
		number := participantNumber(p)
		if number == "" || seen[number] {
			continue
		}
		seen[number] = true
		numbers = append(numbers, number)
	}
	if len(numbers) == 0 {
		return participants
	}

	var contacts []models.Contact
	if err := db.
		Where(`"tenantId" = ? AND number IN ? AND "isGroup" = ?`, tenantID, numbers, false).
		Find(&contacts).Error; err != nil {
		return participants // best-effort — a lookup failure never blocks the group response
	}
	if len(contacts) == 0 {
		return participants
	}

	byNumber := make(map[string]models.Contact, len(contacts))
	for _, c := range contacts {
		byNumber[c.Number] = c
	}

	enriched := make([]domain.Participant, len(participants))
	for i, p := range participants {
		enriched[i] = p
		number := participantNumber(p)
		if number == "" {
			continue
		}
		contact, ok := byNumber[number]
		if !ok {
			continue
		}
		if enriched[i].DisplayName == "" && contact.Name != "" {
			enriched[i].DisplayName = contact.Name
		}
		if contact.ProfilePicUrl != "" {
			enriched[i].PictureURL = contact.ProfilePicUrl
		}
	}
	return enriched
}

// participantNumber prefers PhoneNumber (populated for @lid participants
// whose real number whatsmeow/izapia resolved); falls back to the local
// part of JID for plain @s.whatsapp.net participants where PhoneNumber was
// never set. Matches Contact.Number's convention (bare digits, no server).
func participantNumber(p domain.Participant) string {
	if p.PhoneNumber != "" {
		return strings.SplitN(p.PhoneNumber, "@", 2)[0]
	}
	return strings.SplitN(p.JID, "@", 2)[0]
}
