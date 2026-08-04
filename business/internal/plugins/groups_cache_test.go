package plugins

import (
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadGroupsCache_EmptyIsNotFound(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()

	entries, found, err := loadGroupsCache(db, tenantID, 1)
	require.NoError(t, err)
	assert.False(t, found)
	assert.Nil(t, entries)
}

func TestSaveGroupsToCache_ThenLoad_RoundTrips(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := models.Whatsapp{TenantID: tenantID, Name: "conn-1", Number: "5511999990000"}
	require.NoError(t, db.Create(&w).Error)

	groups := []domain.GroupInfo{
		{
			JID:     "120363000000000001@g.us",
			Subject: "Grupo A",
			Participants: []domain.Participant{
				{JID: "5511999990000:1@s.whatsapp.net", IsAdmin: true},
				{JID: "5511988880000@s.whatsapp.net", IsAdmin: false},
			},
		},
		{
			JID:         "120363000000000002@g.us",
			Subject:     "Comunidade B",
			IsCommunity: true,
			PictureURL:  "https://example.com/pic.jpg",
			Participants: []domain.Participant{
				{JID: "5511999990000:1@s.whatsapp.net", IsAdmin: false},
			},
		},
	}

	require.NoError(t, saveGroupsToCache(db, tenantID, w, groups))

	entries, found, err := loadGroupsCache(db, tenantID, w.ID)
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, entries, 2)

	byJID := make(map[string]groupsListEntry, len(entries))
	for _, e := range entries {
		byJID[e.JID] = e
	}

	a := byJID["120363000000000001@g.us"]
	assert.Equal(t, "Grupo A", a.Subject)
	assert.True(t, a.IsConnectionAdmin, "conexão é admin do Grupo A")
	assert.Len(t, a.Participants, 2, "participant count preservado como len(), não os dados completos")

	b := byJID["120363000000000002@g.us"]
	assert.Equal(t, "Comunidade B", b.Subject)
	assert.True(t, b.IsCommunity)
	assert.False(t, b.IsConnectionAdmin, "conexão não é admin da Comunidade B")
	assert.Equal(t, "https://example.com/pic.jpg", b.PictureURL)
}

func TestSaveGroupsToCache_ReplacesStaleRows(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := models.Whatsapp{TenantID: tenantID, Name: "conn-1", Number: "5511999990000"}
	require.NoError(t, db.Create(&w).Error)

	require.NoError(t, saveGroupsToCache(db, tenantID, w, []domain.GroupInfo{
		{JID: "120363000000000001@g.us", Subject: "Sai depois"},
		{JID: "120363000000000002@g.us", Subject: "Continua"},
	}))

	// Segundo sync: o primeiro grupo não aparece mais (conexão saiu dele) --
	// o cache tem que refletir isso, não acumular o antigo.
	require.NoError(t, saveGroupsToCache(db, tenantID, w, []domain.GroupInfo{
		{JID: "120363000000000002@g.us", Subject: "Continua"},
	}))

	entries, found, err := loadGroupsCache(db, tenantID, w.ID)
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, entries, 1)
	assert.Equal(t, "120363000000000002@g.us", entries[0].JID)
}

func TestUpsertOneGroupCache_CreatesThenUpdates(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	w := models.Whatsapp{TenantID: tenantID, Name: "conn-1", Number: "5511999990000"}
	require.NoError(t, db.Create(&w).Error)

	g := domain.GroupInfo{JID: "120363000000000009@g.us", Subject: "V1"}
	upsertOneGroupCache(db, tenantID, w, g)

	entries, found, err := loadGroupsCache(db, tenantID, w.ID)
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, entries, 1)
	assert.Equal(t, "V1", entries[0].Subject)

	g.Subject = "V2"
	upsertOneGroupCache(db, tenantID, w, g)

	entries, found, err = loadGroupsCache(db, tenantID, w.ID)
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, entries, 1, "upsert não deve duplicar a linha")
	assert.Equal(t, "V2", entries[0].Subject)
}
