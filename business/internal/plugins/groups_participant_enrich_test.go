package plugins

import (
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnrichParticipantsFromContacts_FillsFromExistingContact(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	contact := models.Contact{
		TenantID:      tenantID,
		Number:        "5511999990001",
		Name:          "Maria Silva",
		ProfilePicUrl: "https://cdn.example.com/maria.jpg",
	}
	require.NoError(t, db.Create(&contact).Error)

	participants := []domain.Participant{
		{JID: "5511999990001@s.whatsapp.net"},
	}

	out := enrichParticipantsFromContacts(db, tenantID, participants)
	require.Len(t, out, 1)
	assert.Equal(t, "Maria Silva", out[0].DisplayName)
	assert.Equal(t, "https://cdn.example.com/maria.jpg", out[0].PictureURL)
}

func TestEnrichParticipantsFromContacts_PrefersPhoneNumberOverJID(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	contact := models.Contact{TenantID: tenantID, Number: "5511999990002", Name: "João"}
	require.NoError(t, db.Create(&contact).Error)

	// JID is an opaque @lid; PhoneNumber carries the resolved real number —
	// must match on PhoneNumber, not the (unrelated) JID local part.
	participants := []domain.Participant{
		{JID: "999999999@lid", PhoneNumber: "5511999990002@s.whatsapp.net"},
	}

	out := enrichParticipantsFromContacts(db, tenantID, participants)
	require.Len(t, out, 1)
	assert.Equal(t, "João", out[0].DisplayName)
}

func TestEnrichParticipantsFromContacts_NoMatchLeavesParticipantUnchanged(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	participants := []domain.Participant{
		{JID: "5511999999999@s.whatsapp.net"},
	}

	out := enrichParticipantsFromContacts(db, tenantID, participants)
	require.Len(t, out, 1)
	assert.Equal(t, "", out[0].DisplayName)
	assert.Equal(t, "", out[0].PictureURL)
}

func TestEnrichParticipantsFromContacts_NeverOverwritesExistingDisplayName(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	contact := models.Contact{TenantID: tenantID, Number: "5511999990003", Name: "Nome do Contato"}
	require.NoError(t, db.Create(&contact).Error)

	// Provider already resolved a display name (e.g. announcement-group
	// anonymized name) — enrichment must not clobber it.
	participants := []domain.Participant{
		{JID: "5511999990003@s.whatsapp.net", DisplayName: "Nome do Provider"},
	}

	out := enrichParticipantsFromContacts(db, tenantID, participants)
	require.Len(t, out, 1)
	assert.Equal(t, "Nome do Provider", out[0].DisplayName)
}

func TestEnrichParticipantsFromContacts_DoesNotLeakOtherTenantsContacts(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()

	contact := models.Contact{TenantID: tenantB, Number: "5511999990004", Name: "Contato de outro tenant"}
	require.NoError(t, db.Create(&contact).Error)

	participants := []domain.Participant{
		{JID: "5511999990004@s.whatsapp.net"},
	}

	out := enrichParticipantsFromContacts(db, tenantA, participants)
	require.Len(t, out, 1)
	assert.Equal(t, "", out[0].DisplayName, "must never enrich from a different tenant's Contact row")
}

func TestEnrichParticipantsFromContacts_EmptyInputReturnsEmpty(t *testing.T) {
	db := testutil.NewTestDB(t)
	out := enrichParticipantsFromContacts(db, uuid.New(), []domain.Participant{})
	assert.Empty(t, out)
}
