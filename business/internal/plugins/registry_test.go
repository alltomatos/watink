package plugins

import (
	"errors"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

// fakeLicenseFetcher is a local test double for LicenseFetcher — per project
// convention (CLAUDE.md "Mocks em structs locais dentro de cada Test...
// sem variável global de mock"), it is NOT a package-level mock, just a
// small struct instantiated per test.
type fakeLicenseFetcher struct {
	info LicenseInfo
	err  error
}

func (f *fakeLicenseFetcher) GetLicense(pluginSlug string) (LicenseInfo, error) {
	return f.info, f.err
}

// fakeCatalogFetcher is a local test double for CatalogFetcher — same
// convention as fakeLicenseFetcher above.
type fakeCatalogFetcher struct {
	entries []CatalogEntry
	err     error
}

func (f *fakeCatalogFetcher) GetCatalog() ([]CatalogEntry, error) {
	return f.entries, f.err
}

func createInstallation(t *testing.T, db *gorm.DB, tenantID uuid.UUID, slug string, active bool) {
	t.Helper()
	inst := models.PluginInstallation{
		TenantID: tenantID,
		PluginID: slug,
		Active:   true,
	}
	if err := db.Create(&inst).Error; err != nil {
		t.Fatalf("failed to seed PluginInstallation: %v", err)
	}
	if !active {
		// Active has `gorm:"default:true"` — GORM skips zero-value fields
		// with a default tag on Create, so `false` would silently become
		// `true`. Force it via an explicit UPDATE instead.
		if err := db.Model(&inst).Update("active", false).Error; err != nil {
			t.Fatalf("failed to force PluginInstallation.active=false: %v", err)
		}
	}
}

func TestPluginRegistry_GetStatus_AllocatedAndActive(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	createInstallation(t, db, tenantID, "helpdesk", true)

	fetcher := &fakeLicenseFetcher{info: LicenseInfo{Status: "active", TenantCap: 5}}
	reg := NewPluginRegistry(db, fetcher, nil)

	status := reg.GetStatus(tenantID, "helpdesk")
	assert.Equal(t, sdk.StatusActive, status)
}

// TestPluginRegistry_GetStatus_FreePlugin_IgnoraLicenca cobre o caso real
// que motivou IsFreePlugin: um plugin Type=free no catálogo do Hub nunca
// recebe token (invariante "free não toca o Hub"), então o LicenseFetcher
// devolveria sempre "unlicensed" -- sem o atalho de IsFreePlugin, GetStatus
// bloquearia todo plugin free mesmo já alocado. O fetcher aqui simula
// exatamente esse cenário sem-token, provando que GetStatus nem chega a
// consultá-lo.
func TestPluginRegistry_GetStatus_FreePlugin_IgnoraLicenca(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	createInstallation(t, db, tenantID, "assistant", true)

	fetcher := &fakeLicenseFetcher{info: LicenseInfo{Status: "unlicensed"}}
	catalog := &fakeCatalogFetcher{entries: []CatalogEntry{{Slug: "assistant", Type: "free"}}}
	reg := NewPluginRegistry(db, fetcher, catalog)

	status := reg.GetStatus(tenantID, "assistant")
	assert.Equal(t, sdk.StatusActive, status)
}

// TestPluginRegistry_GetStatus_FreePlugin_NaoAlocadoContinuaBloqueado
// confirma que IsFreePlugin não vira um "sempre ativo" incondicional --
// alocação (PluginInstallations) continua sendo o gate real mesmo pra free.
func TestPluginRegistry_GetStatus_FreePlugin_NaoAlocadoContinuaBloqueado(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	// Sem createInstallation -- nunca alocado para este tenant.

	fetcher := &fakeLicenseFetcher{info: LicenseInfo{Status: "unlicensed"}}
	catalog := &fakeCatalogFetcher{entries: []CatalogEntry{{Slug: "assistant", Type: "free"}}}
	reg := NewPluginRegistry(db, fetcher, catalog)

	status := reg.GetStatus(tenantID, "assistant")
	assert.Equal(t, sdk.StatusBlocked, status)
}

// TestPluginRegistry_IsFreePlugin_CatalogNil_FailSafeFalse garante o
// fail-safe: sem CatalogFetcher (nil), nunca trata nada como free -- segue
// o caminho normal de licença (pro), nunca o de "sempre ativo".
func TestPluginRegistry_IsFreePlugin_CatalogNil_FailSafeFalse(t *testing.T) {
	db := testutil.NewTestDB(t)
	reg := NewPluginRegistry(db, &fakeLicenseFetcher{}, nil)

	assert.False(t, reg.IsFreePlugin("assistant"))
}

// TestPluginRegistry_IsFreePlugin_ErroDeCatalogo_FailSafeFalse garante o
// mesmo fail-safe quando o catálogo existe mas a chamada falha (Hub/
// plugin-manager fora) -- nunca trata como free por omissão de erro.
func TestPluginRegistry_IsFreePlugin_ErroDeCatalogo_FailSafeFalse(t *testing.T) {
	db := testutil.NewTestDB(t)
	catalog := &fakeCatalogFetcher{err: errors.New("plugin-manager indisponível")}
	reg := NewPluginRegistry(db, &fakeLicenseFetcher{}, catalog)

	assert.False(t, reg.IsFreePlugin("assistant"))
}

func TestPluginRegistry_GetStatus_AllocatedAndReadOnly(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	createInstallation(t, db, tenantID, "webchat", true)

	fetcher := &fakeLicenseFetcher{info: LicenseInfo{Status: "readonly"}}
	reg := NewPluginRegistry(db, fetcher, nil)

	status := reg.GetStatus(tenantID, "webchat")
	assert.Equal(t, sdk.StatusReadOnly, status)
}

func TestPluginRegistry_GetStatus_AllocatedAndBlocked(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	createInstallation(t, db, tenantID, "webchat", true)

	fetcher := &fakeLicenseFetcher{info: LicenseInfo{Status: "blocked"}}
	reg := NewPluginRegistry(db, fetcher, nil)

	status := reg.GetStatus(tenantID, "webchat")
	assert.Equal(t, sdk.StatusBlocked, status)
}

func TestPluginRegistry_GetStatus_AllocatedAndUnlicensed(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	createInstallation(t, db, tenantID, "webchat", true)

	fetcher := &fakeLicenseFetcher{info: LicenseInfo{Status: "unlicensed"}}
	reg := NewPluginRegistry(db, fetcher, nil)

	status := reg.GetStatus(tenantID, "webchat")
	assert.Equal(t, sdk.StatusBlocked, status)
}

func TestPluginRegistry_GetStatus_NotAllocated_NoRow(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	// No PluginInstallation row at all for this tenant/slug.

	fetcher := &fakeLicenseFetcher{info: LicenseInfo{Status: "active"}}
	reg := NewPluginRegistry(db, fetcher, nil)

	status := reg.GetStatus(tenantID, "helpdesk")
	assert.Equal(t, sdk.StatusBlocked, status, "not allocated must be blocked even if a license would otherwise be active")
}

func TestPluginRegistry_GetStatus_NotAllocated_InactiveRow(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	createInstallation(t, db, tenantID, "helpdesk", false)

	fetcher := &fakeLicenseFetcher{info: LicenseInfo{Status: "active"}}
	reg := NewPluginRegistry(db, fetcher, nil)

	status := reg.GetStatus(tenantID, "helpdesk")
	assert.Equal(t, sdk.StatusBlocked, status)
}

func TestPluginRegistry_GetStatus_LicenseFetchError_FailsClosed(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	createInstallation(t, db, tenantID, "webchat", true)

	fetcher := &fakeLicenseFetcher{err: errors.New("plugin-manager indisponível e sem cache")}
	reg := NewPluginRegistry(db, fetcher, nil)

	status := reg.GetStatus(tenantID, "webchat")
	assert.Equal(t, sdk.StatusBlocked, status, "license query failure must fail-closed, never Active")
}

func TestPluginRegistry_GetStatus_OtherTenantAllocation_DoesNotLeak(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	createInstallation(t, db, tenantA, "helpdesk", true)

	fetcher := &fakeLicenseFetcher{info: LicenseInfo{Status: "active"}}
	reg := NewPluginRegistry(db, fetcher, nil)

	status := reg.GetStatus(tenantB, "helpdesk")
	assert.Equal(t, sdk.StatusBlocked, status, "tenant B has no allocation of its own")
}
