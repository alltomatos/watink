package izapia

import (
	"context"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProvider_ListGroups_NoSessionID_ReturnsFriendlyError(t *testing.T) {
	db := testutil.NewTestDB(t)
	p := New(db, nil)

	w := models.Whatsapp{ID: 1, TenantID: uuid.New(), IzapiaSessionID: nil}
	_, err := p.ListGroups(context.Background(), w)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sem sessão izapia ativa")
}

func TestProvider_GetGroup_NoSessionID_ReturnsFriendlyError(t *testing.T) {
	db := testutil.NewTestDB(t)
	p := New(db, nil)

	w := models.Whatsapp{ID: 1, TenantID: uuid.New(), IzapiaSessionID: nil}
	_, err := p.GetGroup(context.Background(), w, "120363xxx@g.us")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sem sessão izapia ativa")
}

func TestProvider_UpdateGroupSettings_NoSessionID_ReturnsFriendlyError(t *testing.T) {
	db := testutil.NewTestDB(t)
	p := New(db, nil)

	w := models.Whatsapp{ID: 1, TenantID: uuid.New(), IzapiaSessionID: nil}
	subject := "novo nome"
	err := p.UpdateGroupSettings(context.Background(), w, "120363xxx@g.us", domain.GroupSettingsPatch{Subject: &subject})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sem sessão izapia ativa")
}

// TestGroupInfoFromDTO_MissingFieldsAreZeroValue documents the known gap
// (engine-go/docs/groups-api.md): the izapia group endpoints don't return
// announce/locked/memberAddMode/joinApprovalMode/pictureURL — this must
// resolve to zero-value, not fail the mapping.
func TestGroupInfoFromDTO_MissingFieldsAreZeroValue(t *testing.T) {
	dto := groupDTO{
		GroupID: "120363xxx@g.us",
		Subject: "Grupo",
		Owner:   "a@lid",
		Created: 1785463827,
		Participants: []groupParticipantDTO{
			{JID: "a@lid", IsAdmin: true, IsSuperAdmin: true},
		},
	}
	info := groupInfoFromDTO(dto)
	assert.Equal(t, "120363xxx@g.us", info.JID)
	assert.False(t, info.Announce)
	assert.False(t, info.Locked)
	assert.Equal(t, "", info.MemberAddMode)
	assert.False(t, info.JoinApprovalMode)
	assert.Equal(t, "", info.PictureURL)
	assert.Len(t, info.Participants, 1)
}

func TestParticipantResultsFromDTO_PreservesPerItemError(t *testing.T) {
	results := participantResultsFromDTO([]participantResultDTO{
		{JID: "a@s.whatsapp.net", Status: "ok"},
		{JID: "b@s.whatsapp.net", Status: "error", Error: "not-on-whatsapp"},
	})
	require.Len(t, results, 2)
	assert.Equal(t, "ok", results[0].Status)
	assert.Equal(t, "not-on-whatsapp", results[1].Error)
}
