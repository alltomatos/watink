package controllers

import (
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMarketplaceMode_UsesInstancePolicyWhenPresent(t *testing.T) {
	db := setupSaasTestDB(t)
	require.NoError(t, db.Create(&models.InstancePolicy{MarketplaceMode: "plan_only"}).Error)
	t.Setenv("SAAS_INTERNAL_TOKEN", "some-token")

	assert.Equal(t, "plan_only", marketplaceMode(db))
}

func TestMarketplaceMode_FallsBackToCatalogVisibleWithToken(t *testing.T) {
	db := setupSaasTestDB(t)
	t.Setenv("SAAS_INTERNAL_TOKEN", "some-token")

	assert.Equal(t, "catalog_visible", marketplaceMode(db))
}

func TestMarketplaceMode_FallsBackToSelfServiceWithoutToken(t *testing.T) {
	db := setupSaasTestDB(t)
	t.Setenv("SAAS_INTERNAL_TOKEN", "")

	assert.Equal(t, "self_service", marketplaceMode(db))
}
