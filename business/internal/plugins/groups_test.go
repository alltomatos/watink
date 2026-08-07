package plugins

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// fakeGroupEngine implements domain.GroupEngine (and, via the embedded
// nonGroupEngine, the base domain.WhatsAppEngine it must also satisfy to be
// returned by a resolver) entirely in-memory — the point of the interface
// boundary: full handler-level HTTP testing without a real izapia/enginego
// provider.
type fakeGroupEngine struct {
	nonGroupEngine
	groups    []domain.GroupInfo
	group     *domain.GroupInfo
	err       error
	community *domain.CommunityInfo
	results   []domain.ParticipantResult
}

func (f *fakeGroupEngine) ListGroups(ctx context.Context, w models.Whatsapp) ([]domain.GroupInfo, error) {
	return f.groups, f.err
}
func (f *fakeGroupEngine) GetGroup(ctx context.Context, w models.Whatsapp, groupJID string) (*domain.GroupInfo, error) {
	return f.group, f.err
}
func (f *fakeGroupEngine) CreateGroup(ctx context.Context, w models.Whatsapp, subject string, participants []string) (*domain.GroupInfo, error) {
	return f.group, f.err
}
func (f *fakeGroupEngine) UpdateParticipants(ctx context.Context, w models.Whatsapp, groupJID, action string, participants []string) ([]domain.ParticipantResult, error) {
	return f.results, f.err
}
func (f *fakeGroupEngine) UpdateGroupSettings(ctx context.Context, w models.Whatsapp, groupJID string, patch domain.GroupSettingsPatch) error {
	return f.err
}
func (f *fakeGroupEngine) GetInviteLink(ctx context.Context, w models.Whatsapp, groupJID string) (string, error) {
	return "https://chat.whatsapp.com/fake", f.err
}
func (f *fakeGroupEngine) RevokeInviteLink(ctx context.Context, w models.Whatsapp, groupJID string) (string, error) {
	return "https://chat.whatsapp.com/fake2", f.err
}
func (f *fakeGroupEngine) LeaveGroup(ctx context.Context, w models.Whatsapp, groupJID string) error {
	return f.err
}
func (f *fakeGroupEngine) SetJoinApprovalMode(ctx context.Context, w models.Whatsapp, groupJID string, enabled bool) error {
	return f.err
}
func (f *fakeGroupEngine) ListJoinRequests(ctx context.Context, w models.Whatsapp, groupJID string) ([]domain.JoinRequest, error) {
	return nil, f.err
}
func (f *fakeGroupEngine) ResolveJoinRequests(ctx context.Context, w models.Whatsapp, groupJID, action string, participants []string) ([]domain.ParticipantResult, error) {
	return f.results, f.err
}
func (f *fakeGroupEngine) CreateCommunity(ctx context.Context, w models.Whatsapp, name string) (*domain.CommunityInfo, error) {
	return f.community, f.err
}
func (f *fakeGroupEngine) GetCommunity(ctx context.Context, w models.Whatsapp, communityJID string) (*domain.CommunityInfo, error) {
	return f.community, f.err
}
func (f *fakeGroupEngine) LinkGroupToCommunity(ctx context.Context, w models.Whatsapp, communityJID, groupJID string) error {
	return f.err
}
func (f *fakeGroupEngine) UnlinkGroupFromCommunity(ctx context.Context, w models.Whatsapp, communityJID, groupJID string) error {
	return f.err
}

// nonGroupEngine implements domain.WhatsAppEngine but NOT domain.GroupEngine
// — exercises the 501 path (plan's "devolve 501 claro" requirement).
type nonGroupEngine struct{}

func (nonGroupEngine) StartSession(ctx context.Context, w models.Whatsapp, usePairingCode bool, phoneNumber string, force bool) error {
	return nil
}
func (nonGroupEngine) StopSession(ctx context.Context, w models.Whatsapp) error   { return nil }
func (nonGroupEngine) DeleteSession(ctx context.Context, w models.Whatsapp) error { return nil }
func (nonGroupEngine) SendText(ctx context.Context, w models.Whatsapp, to, messageID, body string) error {
	return nil
}
func (nonGroupEngine) SendMedia(ctx context.Context, w models.Whatsapp, to, messageID, mediaType, mediaURL, mimeType string) error {
	return nil
}

var _ domain.WhatsAppEngine = nonGroupEngine{}
var _ domain.GroupEngine = (*fakeGroupEngine)(nil)

// fakeResolver implements domain.WhatsAppEngineResolver, returning whatever
// engine was configured — lets tests exercise both the happy path
// (fakeGroupEngine) and the 501 path (nonGroupEngine) without a real
// WhatsAppSessionService.
type fakeResolver struct {
	engine domain.WhatsAppEngine
	err    error
}

func (f *fakeResolver) EngineFor(w models.Whatsapp) (domain.WhatsAppEngine, error) {
	return f.engine, f.err
}

func TestGroupsPlugin_GetManifest(t *testing.T) {
	p := &GroupsPlugin{}
	m := p.GetManifest()
	assert.Equal(t, "groups", m.Slug)
	assert.Equal(t, "pro", m.Type)
}

func TestGroupsPlugin_OnActivate_RegistersAllRoutes(t *testing.T) {
	db := setupPluginTestDB(t)
	mockCore := new(MockWatinkCore)
	mockCore.On("GetDB").Return(db)
	mockCore.On("RegisterRoute", mock.Anything, mock.Anything, mock.Anything).Return()

	p := &GroupsPlugin{Resolver: &fakeResolver{engine: &fakeGroupEngine{}}}
	err := p.OnActivate(mockCore)
	require.NoError(t, err)

	expected := []registeredRoute{
		{Method: "GET", Path: "/groups"},
		{Method: "POST", Path: "/groups"},
		{Method: "GET", Path: "/groups/:id"},
		{Method: "PUT", Path: "/groups/:id"},
		{Method: "POST", Path: "/groups/:id/participants"},
		{Method: "GET", Path: "/groups/:id/invite-link"},
		{Method: "POST", Path: "/groups/:id/invite-link/revoke"},
		{Method: "GET", Path: "/groups/:id/join-requests"},
		{Method: "POST", Path: "/groups/:id/join-requests"},
		{Method: "POST", Path: "/groups/:id/leave"},
		{Method: "GET", Path: "/communities"},
		{Method: "POST", Path: "/communities"},
		{Method: "GET", Path: "/communities/:id"},
		{Method: "POST", Path: "/communities/:id/groups/:groupId"},
		{Method: "DELETE", Path: "/communities/:id/groups/:groupId"},
		{Method: "GET", Path: "/groups/watch-tags"},
		{Method: "POST", Path: "/groups/watch-tags"},
		{Method: "PUT", Path: "/groups/watch-tags/:id"},
		{Method: "DELETE", Path: "/groups/watch-tags/:id"},
		{Method: "GET", Path: "/groups/watch-matches"},
		{Method: "GET", Path: "/group-campaigns"},
		{Method: "GET", Path: "/group-campaigns/:campaignId"},
		{Method: "POST", Path: "/group-campaigns"},
		{Method: "PUT", Path: "/group-campaigns/:campaignId"},
		{Method: "DELETE", Path: "/group-campaigns/:campaignId"},
		{Method: "GET", Path: "/group-campaigns/:campaignId/runs"},
		{Method: "GET", Path: "/group-campaigns/:campaignId/runs/:runId/sends"},
		{Method: "GET", Path: "/group-campaigns/:campaignId/replies"},
		{Method: "POST", Path: "/group-campaigns/:campaignId/start"},
		{Method: "POST", Path: "/group-campaigns/:campaignId/test"},
		{Method: "POST", Path: "/group-campaigns/:campaignId/pause"},
		{Method: "POST", Path: "/group-campaigns/:campaignId/resume"},
		{Method: "POST", Path: "/group-campaigns/:campaignId/cancel"},
	}
	assert.Len(t, mockCore.registeredRoutes, len(expected))
	for _, want := range expected {
		found := false
		for _, r := range mockCore.registeredRoutes {
			if r.Method == want.Method && r.Path == want.Path {
				found = true
				break
			}
		}
		assert.True(t, found, "expected %s %s to be registered", want.Method, want.Path)
	}
}

// The tests below set c.Set("tenantId"/"alcance"/"db") directly — the same
// context values middleware.IsAuth would have set — and call the raw
// handler (not the withPermission-wrapped route), so they exercise
// resolveConnection's own guards (invalid input/404/501), not the RBAC
// layer (that's auth.RequirePermission's own test suite).

func TestGroupsPlugin_ListGroups_501WhenEngineIsNotGroupEngine(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	whatsapp := models.Whatsapp{TenantID: tenantID, Name: "conn-1"}
	require.NoError(t, db.Create(&whatsapp).Error)

	svc := &groupsService{db: db, resolver: &fakeResolver{engine: nonGroupEngine{}}, throttle: newGroupsThrottle()}

	r := gin.New()
	r.GET("/groups", func(c *gin.Context) {
		c.Set("tenantId", tenantID.String())
		c.Set("alcance", "tenant")
		c.Set("db", db)
		handleListGroups(svc)(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/groups?whatsappId="+itoaTest(whatsapp.ID), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotImplemented, w.Code)
}

func TestConnectionIsGroupAdmin(t *testing.T) {
	participants := []domain.Participant{
		{JID: "5511999990000:1@s.whatsapp.net", IsAdmin: true},
		{JID: "5511988880000@s.whatsapp.net", IsAdmin: false},
	}

	assert.True(t, connectionIsGroupAdmin(participants, "5511999990000"), "número admin com sufixo :device deve casar")
	assert.False(t, connectionIsGroupAdmin(participants, "5511988880000"), "participante não-admin não vira admin")
	assert.False(t, connectionIsGroupAdmin(participants, "5511977770000"), "número fora dos participantes é fail-safe false")
	assert.False(t, connectionIsGroupAdmin(nil, "5511999990000"), "sem participantes é fail-safe false")
}

// TestConnectionIsGroupAdmin_LIDPrivacy reproduz o bug real de produção
// (zap-0991, 164 grupos, 0 detectados como admin): grupo com privacidade
// LID da Meta ativada reporta o próprio participante com JID = "@lid"
// opaco, não o número -- só o PhoneNumber (quando o whatsmeow consegue
// resolver) carrega o número de verdade.
func TestConnectionIsGroupAdmin_LIDPrivacy(t *testing.T) {
	participants := []domain.Participant{
		{JID: "184627193847562@lid", PhoneNumber: "5511999990000", IsAdmin: true},
		{JID: "298374652918273@lid", PhoneNumber: "5511988880000", IsAdmin: false},
	}

	assert.True(t, connectionIsGroupAdmin(participants, "5511999990000"), "admin com JID @lid deve casar via PhoneNumber")
	assert.False(t, connectionIsGroupAdmin(participants, "5511988880000"), "não-admin com JID @lid não vira admin")
	assert.False(t, connectionIsGroupAdmin(participants, "5511977770000"), "número fora dos participantes é fail-safe false mesmo com @lid")
}

func TestGroupsPlugin_ListGroups_HappyPath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	whatsapp := models.Whatsapp{TenantID: tenantID, Name: "conn-1"}
	require.NoError(t, db.Create(&whatsapp).Error)

	engine := &fakeGroupEngine{groups: []domain.GroupInfo{{JID: "120363xxx@g.us", Subject: "Test"}}}
	svc := &groupsService{db: db, resolver: &fakeResolver{engine: engine}, throttle: newGroupsThrottle()}

	r := gin.New()
	r.GET("/groups", func(c *gin.Context) {
		c.Set("tenantId", tenantID.String())
		c.Set("alcance", "tenant")
		c.Set("db", db)
		handleListGroups(svc)(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/groups?whatsappId="+itoaTest(whatsapp.ID), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestGroupsPlugin_ListGroups_404ForOtherTenantsConnection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPluginTestDB(t)
	ownerTenant := uuid.New()
	callerTenant := uuid.New()
	whatsapp := models.Whatsapp{TenantID: ownerTenant, Name: "conn-1"}
	require.NoError(t, db.Create(&whatsapp).Error)

	svc := &groupsService{db: db, resolver: &fakeResolver{engine: &fakeGroupEngine{}}, throttle: newGroupsThrottle()}

	r := gin.New()
	r.GET("/groups", func(c *gin.Context) {
		c.Set("tenantId", callerTenant.String())
		c.Set("alcance", "tenant")
		c.Set("db", db)
		handleListGroups(svc)(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/groups?whatsappId="+itoaTest(whatsapp.ID), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code, "a connection scoped to a different tenant must never resolve")
}

func itoaTest(n int) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
