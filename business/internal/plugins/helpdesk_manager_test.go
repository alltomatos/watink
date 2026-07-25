package plugins

import (
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// ---- HelpdeskPlugin Tests ----

func TestHelpdeskPlugin_GetManifest(t *testing.T) {
	hp := &HelpdeskPlugin{}
	manifest := hp.GetManifest()
	assert.Equal(t, "helpdesk", manifest.Slug)
	assert.NotEmpty(t, manifest.Name)
	assert.NotEmpty(t, manifest.Version)
}

func TestHelpdeskPlugin_OnActivate_RegistersAllProtocolRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPluginTestDB(t)

	hp := &HelpdeskPlugin{}
	mc := new(MockWatinkCore)
	mc.On("GetDB").Return(db)
	mc.On("RegisterRoute", mock.Anything, mock.Anything, mock.Anything).Return()
	mc.On("RegisterPublicRoute", mock.Anything, mock.Anything, mock.Anything).Return()

	err := hp.OnActivate(mc)
	assert.NoError(t, err)

	expected := []registeredRoute{
		{Method: "GET", Path: "/protocols"},
		{Method: "GET", Path: "/protocols/kanban"},
		{Method: "GET", Path: "/protocols/dashboard"},
		{Method: "POST", Path: "/protocols"},
		{Method: "GET", Path: "/protocols/:id"},
		{Method: "PUT", Path: "/protocols/:id"},
		{Method: "GET", Path: "/protocols/:id/attachments"},
		{Method: "POST", Path: "/protocols/:id/attachments"},
		{Method: "DELETE", Path: "/protocols/:id/attachments/:attachmentId"},
		{Method: "GET", Path: "/public/protocols/:token"},
	}
	assert.Len(t, mc.registeredRoutes, len(expected), "unexpected number of routes registered (authenticated + public)")
	for _, want := range expected {
		found := false
		for _, r := range mc.registeredRoutes {
			if r.Method == want.Method && r.Path == want.Path {
				found = true
				break
			}
		}
		assert.True(t, found, "expected %s %s to be registered", want.Method, want.Path)
	}
}

func TestHelpdeskPlugin_OnActivate_PublicRouteIsUnauthenticated(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPluginTestDB(t)

	hp := &HelpdeskPlugin{}
	mc := new(MockWatinkCore)
	mc.On("GetDB").Return(db)
	mc.On("RegisterRoute", mock.Anything, mock.Anything, mock.Anything).Return()
	mc.On("RegisterPublicRoute", "GET", "/public/protocols/:token", mock.Anything).Return()

	err := hp.OnActivate(mc)
	assert.NoError(t, err)
	mc.AssertCalled(t, "RegisterPublicRoute", "GET", "/public/protocols/:token", mock.Anything)
}

func TestHelpdeskPlugin_OnInstall_AutoMigrate(t *testing.T) {
	db := setupPluginTestDB(t)
	hp := &HelpdeskPlugin{}
	mc := new(MockWatinkCore)
	mc.On("GetDB").Return(db)
	err := hp.OnInstall(mc)
	assert.NoError(t, err)
	assert.True(t, db.Migrator().HasTable(&models.Protocol{}))
	assert.True(t, db.Migrator().HasTable(&models.ProtocolLog{}))
	assert.True(t, db.Migrator().HasTable(&models.ProtocolAttachment{}))
}

func TestHelpdeskPlugin_OnDeactivate(t *testing.T) {
	hp := &HelpdeskPlugin{}
	mc := new(MockWatinkCore)
	err := hp.OnDeactivate(mc)
	assert.NoError(t, err)
}

// ---- PluginManager Tests ----

func TestNewPluginManager_NotNil(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	group := r.Group("/api")
	pm := NewPluginManager(nil, group)
	assert.NotNil(t, pm)
	assert.NotNil(t, pm.plugins)
}

func TestPluginManager_GetInstalled_Empty(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	group := r.Group("/api")
	pm := NewPluginManager(nil, group)
	installed := pm.GetInstalled()
	assert.NotNil(t, installed)
	assert.Len(t, installed, 0)
}

func TestPluginManager_Register_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	group := r.Group("/api")
	pm := NewPluginManager(nil, group)

	// Use HelpdeskPlugin as a real plugin (OnActivate just registers a route on coreImpl)
	hp := &HelpdeskPlugin{}
	pm.Register(hp)

	installed := pm.GetInstalled()
	assert.Len(t, installed, 1)
	assert.Equal(t, "helpdesk", installed[0].Slug)
}

// NOTE: registering the same plugin twice panics in gin (duplicate route).
// This is a known limitation — PluginManager.Register has no guard against re-registration.
// A future fix should check pm.plugins[slug] before calling OnActivate.
func TestPluginManager_Register_MultipleDistinctPlugins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	group := r.Group("/api")
	pm := NewPluginManager(nil, group)

	// Register two distinct plugins
	pm.Register(&HelpdeskPlugin{})
	pm.Register(&WebchatPlugin{})

	installed := pm.GetInstalled()
	assert.Len(t, installed, 2)
}

func TestCoreImpl_GetStatus_AlwaysActive(t *testing.T) {
	c := &coreImpl{}
	assert.Equal(t, sdk.StatusActive, c.GetStatus())
}

func TestCoreImpl_GetDB_ReturnsNil(t *testing.T) {
	c := &coreImpl{db: nil}
	assert.Nil(t, c.GetDB())
}

func TestCoreImpl_EmitSocketEvent_NoOp(t *testing.T) {
	c := &coreImpl{}
	// Should not panic
	c.EmitSocketEvent("room", "event", nil)
}
