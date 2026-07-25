package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/pluginlicense"
	"github.com/alltomatos/watinkdev/business/internal/plugins"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// mockPlanLimitSvc satisfies domain.PlanLimitServiceInterface for tests.
type mockPlanLimitSvc struct {
	err error
}

func (m *mockPlanLimitSvc) CheckLimit(tenantID uuid.UUID, resource string) error {
	return m.err
}

// fakeLicenseFetcher is a local test double for plugins.LicenseFetcher — per
// project convention (CLAUDE.md "Mocks em structs locais dentro de cada
// Test... sem variável global de mock"), not a package-level mock.
type fakeLicenseFetcher struct {
	info map[string]plugins.LicenseInfo
	err  error
}

func (f *fakeLicenseFetcher) GetLicense(pluginSlug string) (plugins.LicenseInfo, error) {
	if f.err != nil {
		return plugins.LicenseInfo{}, f.err
	}
	info, ok := f.info[pluginSlug]
	if !ok {
		return plugins.LicenseInfo{}, errors.New("plugin not found")
	}
	return info, nil
}

// newTestContext builds a Gin test context with the given tenant/db already
// injected, matching what middleware.IsAuth + TenantMiddleware do in
// production (see auth.GetScoped / auth.GetDB).
func newTestPluginContext(method, path string, body *strings.Reader, db *gorm.DB, tenantID uuid.UUID) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var req *http.Request
	if body != nil {
		req, _ = http.NewRequest(method, path, body)
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, _ = http.NewRequest(method, path, nil)
	}
	c.Request = req
	c.Set("tenantId", tenantID)
	c.Set("db", db)
	return c, w
}

// fakePMProxy is a local test double for PluginManagerProxy — per project
// convention (CLAUDE.md "Mocks em structs locais dentro de cada Test..."),
// not a package-level mock. err takes precedence over the canned responses so
// a single struct can exercise both the happy path and the fail-safe.
// checkoutErr is kept separate from err so tests can exercise
// Activate()'s Checkout() branch without disturbing Catalog/Instance
// fail-safe behaviour.
type fakePMProxy struct {
	catalog     pluginlicense.CatalogResponse
	instance    pluginlicense.InstanceResponse
	err         error
	checkoutErr error
}

func (f *fakePMProxy) GetCatalog() (pluginlicense.CatalogResponse, error) {
	if f.err != nil {
		return pluginlicense.CatalogResponse{}, f.err
	}
	return f.catalog, nil
}

func (f *fakePMProxy) GetInstance() (pluginlicense.InstanceResponse, error) {
	if f.err != nil {
		return pluginlicense.InstanceResponse{}, f.err
	}
	return f.instance, nil
}

func (f *fakePMProxy) Checkout(_, _ string) (pluginlicense.CheckoutOrderResponse, error) {
	if f.checkoutErr != nil {
		return pluginlicense.CheckoutOrderResponse{}, f.checkoutErr
	}
	return pluginlicense.CheckoutOrderResponse{OrderID: 1, AmountCents: 100, CheckoutURL: "https://mp/x"}, nil
}

func TestPluginController_Instance_NilProxy_ReturnsEmpty(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// nil proxy -> fail-safe: empty instanceId, still 200.
	ctrl := NewPluginController(&mockPlanLimitSvc{}, nil, nil, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/plugins/instance", nil)
	c.Request = req

	ctrl.Instance(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "", resp["instanceId"])
}

func TestPluginController_Instance_Proxy_ReturnsRealID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	proxy := &fakePMProxy{instance: pluginlicense.InstanceResponse{InstanceID: "INST-123-abc"}}
	ctrl := NewPluginController(&mockPlanLimitSvc{}, nil, nil, nil, proxy)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/plugins/instance", nil)
	c.Request = req

	ctrl.Instance(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "INST-123-abc", resp["instanceId"])
}

func TestPluginController_Instance_ProxyError_FailSafe(t *testing.T) {
	gin.SetMode(gin.TestMode)
	proxy := &fakePMProxy{err: errors.New("plugin-manager down")}
	ctrl := NewPluginController(&mockPlanLimitSvc{}, nil, nil, nil, proxy)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/plugins/instance", nil)
	c.Request = req

	ctrl.Instance(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "", resp["instanceId"])
}

func TestPluginController_Catalog_Proxy_RepassesShape(t *testing.T) {
	gin.SetMode(gin.TestMode)
	proxy := &fakePMProxy{catalog: pluginlicense.CatalogResponse{
		Offline: false,
		Plugins: []pluginlicense.CatalogPlugin{
			{ID: "1", Slug: "helpdesk", Name: "Helpdesk", Type: "pro", Category: "support", Price: 49.9, IconURL: "http://x/i.png"},
			{ID: "2", Slug: "webchat", Name: "Web Chat", Type: "free", Category: "channels", Price: 0},
		},
	}}
	ctrl := NewPluginController(&mockPlanLimitSvc{}, nil, nil, nil, proxy)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/plugins/catalog", nil)
	c.Request = req

	ctrl.Catalog(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp pluginlicense.CatalogResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.False(t, resp.Offline)
	require.Len(t, resp.Plugins, 2)
	assert.Equal(t, "helpdesk", resp.Plugins[0].Slug)
	assert.Equal(t, 49.9, resp.Plugins[0].Price)
	assert.Equal(t, "webchat", resp.Plugins[1].Slug)
	assert.Equal(t, float64(0), resp.Plugins[1].Price)
}

func TestPluginController_Catalog_ProxyError_FailSafeOffline(t *testing.T) {
	gin.SetMode(gin.TestMode)
	proxy := &fakePMProxy{err: errors.New("plugin-manager down")}
	ctrl := NewPluginController(&mockPlanLimitSvc{}, nil, nil, nil, proxy)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/plugins/catalog", nil)
	c.Request = req

	ctrl.Catalog(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp pluginlicense.CatalogResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Offline)
	assert.NotNil(t, resp.Plugins)
	assert.Len(t, resp.Plugins, 0)
}

func TestPluginController_Catalog_NilProxy_FailSafeOffline(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctrl := NewPluginController(&mockPlanLimitSvc{}, nil, nil, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/plugins/catalog", nil)
	c.Request = req

	ctrl.Catalog(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp pluginlicense.CatalogResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Offline)
	assert.NotNil(t, resp.Plugins)
	assert.Len(t, resp.Plugins, 0)
}

func TestPluginController_Checkout_Returns503(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctrl := NewPluginController(&mockPlanLimitSvc{}, nil, nil, nil, nil)

	tenantID := uuid.New()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := strings.NewReader(`{"slug":"some-plugin"}`)
	req, _ := http.NewRequest("POST", "/plugins/checkout", body)
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("tenantId", tenantID)

	ctrl.Checkout(c)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	_, ok := resp["error"]
	assert.True(t, ok, "response must contain error key")
}

func TestLegacyPluginStubs(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		name    string
		handler gin.HandlerFunc
	}{
		{"PluginsCatalog", PluginsCatalog},
		{"PluginsInstalled", PluginsInstalled},
		{"PluginsCheckout", PluginsCheckout},
		{"PluginsInstance", PluginsInstance},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			req, _ := http.NewRequest("GET", "/", nil)
			c.Request = req
			tc.handler(c)
			assert.Equal(t, http.StatusServiceUnavailable, w.Code)
		})
	}
}

func TestPluginController_Activate_LicensedGrantsAllocation(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	fetcher := &fakeLicenseFetcher{info: map[string]plugins.LicenseInfo{
		"helpdesk": {Status: "active", TenantCap: 0},
	}}
	registry := plugins.NewPluginRegistry(db, fetcher)
	ctrl := NewPluginController(&mockPlanLimitSvc{}, db, registry, fetcher, nil)

	c, w := newTestPluginContext("POST", "/plugins/helpdesk/activate", nil, db, tenantID)
	c.Params = gin.Params{{Key: "slug", Value: "helpdesk"}}

	ctrl.Activate(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var inst models.PluginInstallation
	require.NoError(t, db.Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, "helpdesk").First(&inst).Error)
	assert.True(t, inst.Active)
	require.NotNil(t, inst.ActivatedAt)
}

func TestPluginController_Activate_Unlicensed_NilProxy_Returns402(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	fetcher := &fakeLicenseFetcher{info: map[string]plugins.LicenseInfo{
		"helpdesk": {Status: "unlicensed"},
	}}
	registry := plugins.NewPluginRegistry(db, fetcher)
	// pmProxy nil -- preserves the old behaviour: no checkout attempt at all.
	ctrl := NewPluginController(&mockPlanLimitSvc{}, db, registry, fetcher, nil)

	c, w := newTestPluginContext("POST", "/plugins/helpdesk/activate", nil, db, tenantID)
	c.Params = gin.Params{{Key: "slug", Value: "helpdesk"}}

	ctrl.Activate(c)

	assert.Equal(t, http.StatusPaymentRequired, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "plugin_unlicensed", resp["error"])
	assert.Equal(t, false, resp["checkoutRequested"])
	_, hasCheckoutURL := resp["checkoutUrl"]
	assert.False(t, hasCheckoutURL, "legacy checkoutUrl field must be removed")

	var count int64
	db.Model(&models.PluginInstallation{}).Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, "helpdesk").Count(&count)
	assert.Equal(t, int64(0), count, "no allocation should be created without a valid license")
}

func TestPluginController_Activate_Unlicensed_ChecksOutSuccessfully_Returns402WithRequestedTrue(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	fetcher := &fakeLicenseFetcher{info: map[string]plugins.LicenseInfo{
		"helpdesk": {Status: "unlicensed"},
	}}
	registry := plugins.NewPluginRegistry(db, fetcher)
	proxy := &fakePMProxy{} // checkoutErr nil -> Checkout succeeds
	ctrl := NewPluginController(&mockPlanLimitSvc{}, db, registry, fetcher, proxy)

	c, w := newTestPluginContext("POST", "/plugins/helpdesk/activate", nil, db, tenantID)
	c.Params = gin.Params{{Key: "slug", Value: "helpdesk"}}

	ctrl.Activate(c)

	// Still 402 -- the Hub only creates the license record; the token only
	// lands on the plugin-manager on the next heartbeat, so this request
	// never grants activation synchronously.
	assert.Equal(t, http.StatusPaymentRequired, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "plugin_unlicensed", resp["error"])
	assert.Equal(t, true, resp["checkoutRequested"])
	assert.NotEmpty(t, resp["message"])

	var count int64
	db.Model(&models.PluginInstallation{}).Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, "helpdesk").Count(&count)
	assert.Equal(t, int64(0), count, "no allocation should be created without a valid license, even after a successful checkout request")
}

func TestPluginController_Activate_Unlicensed_CheckoutFails_Returns402WithRequestedFalse(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	fetcher := &fakeLicenseFetcher{info: map[string]plugins.LicenseInfo{
		"helpdesk": {Status: "unlicensed"},
	}}
	registry := plugins.NewPluginRegistry(db, fetcher)
	proxy := &fakePMProxy{checkoutErr: errors.New("plugin-manager indisponível")}
	ctrl := NewPluginController(&mockPlanLimitSvc{}, db, registry, fetcher, proxy)

	c, w := newTestPluginContext("POST", "/plugins/helpdesk/activate", nil, db, tenantID)
	c.Params = gin.Params{{Key: "slug", Value: "helpdesk"}}

	ctrl.Activate(c)

	assert.Equal(t, http.StatusPaymentRequired, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "plugin_unlicensed", resp["error"])
	assert.Equal(t, false, resp["checkoutRequested"])
	assert.NotEmpty(t, resp["message"])

	var count int64
	db.Model(&models.PluginInstallation{}).Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, "helpdesk").Count(&count)
	assert.Equal(t, int64(0), count, "no allocation should be created without a valid license")
}

func TestPluginController_Activate_TenantCapReached_Returns402(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()

	// tenantA already occupies the single slot allowed by tenantCap=1.
	now := gin.H{}
	_ = now
	require.NoError(t, db.Exec(
		`INSERT INTO "PluginInstallations" ("id","tenantId","pluginId","active","createdAt","updatedAt") VALUES (gen_random_uuid(), ?, ?, true, now(), now())`,
		tenantA, "helpdesk",
	).Error)

	fetcher := &fakeLicenseFetcher{info: map[string]plugins.LicenseInfo{
		"helpdesk": {Status: "active", TenantCap: 1},
	}}
	registry := plugins.NewPluginRegistry(db, fetcher)
	ctrl := NewPluginController(&mockPlanLimitSvc{}, db, registry, fetcher, nil)

	c, w := newTestPluginContext("POST", "/plugins/helpdesk/activate", nil, db, tenantB)
	c.Params = gin.Params{{Key: "slug", Value: "helpdesk"}}

	ctrl.Activate(c)

	assert.Equal(t, http.StatusPaymentRequired, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "plugin_tenant_cap_reached", resp["error"])
}

func TestPluginController_Activate_Idempotent_ReactivatesWithoutDuplicating(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	// Seed an existing, inactive row for this tenant (e.g. previously
	// deactivated) — activating again must reuse the row, never violate the
	// UNIQUE(tenantId, pluginId) constraint.
	require.NoError(t, db.Exec(
		`INSERT INTO "PluginInstallations" ("id","tenantId","pluginId","active","createdAt","updatedAt") VALUES (gen_random_uuid(), ?, ?, false, now(), now())`,
		tenantID, "helpdesk",
	).Error)

	fetcher := &fakeLicenseFetcher{info: map[string]plugins.LicenseInfo{
		"helpdesk": {Status: "active", TenantCap: 1},
	}}
	registry := plugins.NewPluginRegistry(db, fetcher)
	ctrl := NewPluginController(&mockPlanLimitSvc{}, db, registry, fetcher, nil)

	c, w := newTestPluginContext("POST", "/plugins/helpdesk/activate", nil, db, tenantID)
	c.Params = gin.Params{{Key: "slug", Value: "helpdesk"}}

	ctrl.Activate(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var count int64
	require.NoError(t, db.Model(&models.PluginInstallation{}).
		Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, "helpdesk").
		Count(&count).Error)
	assert.Equal(t, int64(1), count, "reactivation must not duplicate the row")

	var inst models.PluginInstallation
	require.NoError(t, db.Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, "helpdesk").First(&inst).Error)
	assert.True(t, inst.Active)
}

func TestPluginController_Deactivate_MarksInactive(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	require.NoError(t, db.Exec(
		`INSERT INTO "PluginInstallations" ("id","tenantId","pluginId","active","createdAt","updatedAt") VALUES (gen_random_uuid(), ?, ?, true, now(), now())`,
		tenantID, "webchat",
	).Error)

	ctrl := NewPluginController(&mockPlanLimitSvc{}, db, nil, nil, nil)

	c, w := newTestPluginContext("POST", "/plugins/webchat/deactivate", nil, db, tenantID)
	c.Params = gin.Params{{Key: "slug", Value: "webchat"}}

	ctrl.Deactivate(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var inst models.PluginInstallation
	require.NoError(t, db.Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, "webchat").First(&inst).Error)
	assert.False(t, inst.Active)
}

func TestPluginController_Installed_ReturnsAllocatedWithRealStatus(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	require.NoError(t, db.Exec(
		`INSERT INTO "PluginInstallations" ("id","tenantId","pluginId","active","createdAt","updatedAt") VALUES (gen_random_uuid(), ?, 'helpdesk', true, now(), now())`,
		tenantID,
	).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO "PluginInstallations" ("id","tenantId","pluginId","active","createdAt","updatedAt") VALUES (gen_random_uuid(), ?, 'webchat', true, now(), now())`,
		tenantID,
	).Error)

	fetcher := &fakeLicenseFetcher{info: map[string]plugins.LicenseInfo{
		"helpdesk": {Status: "active"},
		"webchat":  {Status: "blocked"},
	}}
	registry := plugins.NewPluginRegistry(db, fetcher)
	ctrl := NewPluginController(&mockPlanLimitSvc{}, db, registry, fetcher, nil)

	c, w := newTestPluginContext("GET", "/plugins/installed", nil, db, tenantID)

	ctrl.Installed(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Active   []string          `json:"active"`
		Statuses map[string]string `json:"statuses"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.ElementsMatch(t, []string{"helpdesk", "webchat"}, resp.Active)
	assert.Equal(t, "active", resp.Statuses["helpdesk"])
	assert.Equal(t, "blocked", resp.Statuses["webchat"])
}
