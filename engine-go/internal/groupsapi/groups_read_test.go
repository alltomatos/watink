package groupsapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/engine-go/internal/whatsapp"
)

// fakeBackend implements Backend entirely in-memory — this is the point of
// the Backend interface boundary (backend.go doc comment): full happy-path
// and error-path HTTP testing without a real *whatsmeow.Client.
type fakeBackend struct {
	groups       []whatsapp.GroupInfo
	group        *whatsapp.GroupInfo
	groupErr     error
	community    *whatsapp.CommunityInfo
	communityErr error

	writeErr     error
	results      []whatsapp.ParticipantResult
	joinRequests []whatsapp.JoinRequestEntry
	link         string

	// capture last write call's args, for assertions that a handler passed
	// the right tenantId/action/participants through.
	lastTenantID string
	lastAction   string
}

func (f *fakeBackend) ListGroups(sessionID int) ([]whatsapp.GroupInfo, error) {
	return f.groups, nil
}

func (f *fakeBackend) GetGroup(sessionID int, groupJID string) (*whatsapp.GroupInfo, error) {
	if f.groupErr != nil {
		return nil, f.groupErr
	}
	return f.group, nil
}

func (f *fakeBackend) GetCommunity(sessionID int, communityJID string) (*whatsapp.CommunityInfo, error) {
	if f.communityErr != nil {
		return nil, f.communityErr
	}
	return f.community, nil
}

func (f *fakeBackend) CreateGroup(sessionID int, tenantID, subject string, participants []string) (*whatsapp.GroupInfo, error) {
	f.lastTenantID = tenantID
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	return f.group, nil
}

func (f *fakeBackend) UpdateParticipants(sessionID int, tenantID, groupJID, action string, participants []string) ([]whatsapp.ParticipantResult, error) {
	f.lastTenantID = tenantID
	f.lastAction = action
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	return f.results, nil
}

func (f *fakeBackend) UpdateGroupSettings(sessionID int, tenantID, groupJID string, payload whatsapp.UpdateGroupSettingsPayload) error {
	f.lastTenantID = tenantID
	return f.writeErr
}

func (f *fakeBackend) GetInviteLink(sessionID int, groupJID string) (string, error) {
	if f.writeErr != nil {
		return "", f.writeErr
	}
	return f.link, nil
}

func (f *fakeBackend) RevokeInviteLink(sessionID int, tenantID, groupJID string) (string, error) {
	f.lastTenantID = tenantID
	if f.writeErr != nil {
		return "", f.writeErr
	}
	return f.link, nil
}

func (f *fakeBackend) LeaveGroup(sessionID int, tenantID, groupJID string) error {
	f.lastTenantID = tenantID
	return f.writeErr
}

func (f *fakeBackend) SetJoinApprovalMode(sessionID int, tenantID, groupJID string, enabled bool) error {
	f.lastTenantID = tenantID
	return f.writeErr
}

func (f *fakeBackend) ListJoinRequests(sessionID int, groupJID string) ([]whatsapp.JoinRequestEntry, error) {
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	return f.joinRequests, nil
}

func (f *fakeBackend) ResolveJoinRequests(sessionID int, tenantID, groupJID, action string, participants []string) ([]whatsapp.ParticipantResult, error) {
	f.lastTenantID = tenantID
	f.lastAction = action
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	return f.results, nil
}

func (f *fakeBackend) CreateCommunity(sessionID int, tenantID, name string) (*whatsapp.CommunityInfo, error) {
	f.lastTenantID = tenantID
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	return f.community, nil
}

func (f *fakeBackend) LinkGroupToCommunity(sessionID int, tenantID, communityJID, groupJID string) error {
	f.lastTenantID = tenantID
	return f.writeErr
}

func (f *fakeBackend) UnlinkGroupFromCommunity(sessionID int, tenantID, communityJID, groupJID string) error {
	f.lastTenantID = tenantID
	return f.writeErr
}

const testToken = "test-internal-token"

func newTestServer(backend Backend) http.Handler {
	return authMiddleware(testToken, newMux(backend, newThrottle()))
}

func newTestServerWithThrottle(backend Backend, th *throttle) http.Handler {
	return authMiddleware(testToken, newMux(backend, th))
}

func doRequest(t *testing.T, h http.Handler, method, path, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if token != "" {
		req.Header.Set("X-Internal-Token", token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestAuthMiddleware_MissingToken(t *testing.T) {
	h := newTestServer(&fakeBackend{})
	rec := doRequest(t, h, http.MethodGet, "/sessions/1/groups", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if env.OK || env.Error.Code != CodeAuthFailed {
		t.Fatalf("expected AUTH_FAILED envelope, got %+v", env)
	}
}

func TestAuthMiddleware_WrongToken(t *testing.T) {
	h := newTestServer(&fakeBackend{})
	rec := doRequest(t, h, http.MethodGet, "/sessions/1/groups", "wrong-token")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestListGroups_HappyPath(t *testing.T) {
	backend := &fakeBackend{groups: []whatsapp.GroupInfo{{JID: "120363xxx@g.us", Subject: "Test"}}}
	h := newTestServer(backend)
	rec := doRequest(t, h, http.MethodGet, "/sessions/1/groups", testToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if !env.OK {
		t.Fatalf("expected ok=true, got %+v", env)
	}
}

func TestListGroups_InvalidSessionID(t *testing.T) {
	h := newTestServer(&fakeBackend{})
	rec := doRequest(t, h, http.MethodGet, "/sessions/not-a-number/groups", testToken)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	var env envelope
	_ = json.Unmarshal(rec.Body.Bytes(), &env)
	if env.Error.Code != CodeInvalidInput {
		t.Fatalf("expected INVALID_INPUT, got %+v", env.Error)
	}
}

func TestGetGroup_NotFound(t *testing.T) {
	backend := &fakeBackend{groupErr: errors.Join(whatsapp.ErrGroupNotFound, errors.New("wa: no such group"))}
	h := newTestServer(backend)
	rec := doRequest(t, h, http.MethodGet, "/sessions/1/groups/120363xxx@g.us", testToken)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
	var env envelope
	_ = json.Unmarshal(rec.Body.Bytes(), &env)
	if env.Error.Code != CodeNotFound {
		t.Fatalf("expected NOT_FOUND, got %+v", env.Error)
	}
}

func TestGetGroup_SessionNotConnected(t *testing.T) {
	backend := &fakeBackend{groupErr: errors.Join(whatsapp.ErrSessionNotConnected, errors.New("session 1 is not connected"))}
	h := newTestServer(backend)
	rec := doRequest(t, h, http.MethodGet, "/sessions/1/groups/120363xxx@g.us", testToken)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
	var env envelope
	_ = json.Unmarshal(rec.Body.Bytes(), &env)
	if env.Error.Code != CodeSessionNotConnected {
		t.Fatalf("expected SESSION_NOT_CONNECTED, got %+v", env.Error)
	}
}

func TestGetCommunity_HappyPath(t *testing.T) {
	backend := &fakeBackend{community: &whatsapp.CommunityInfo{
		GroupInfo:    whatsapp.GroupInfo{JID: "120363yyy@g.us", Subject: "Comunidade", IsCommunity: true},
		LinkedGroups: []whatsapp.GroupInfo{{JID: "120363zzz@g.us", Subject: "Subgrupo", IsSubGroup: true}},
	}}
	h := newTestServer(backend)
	rec := doRequest(t, h, http.MethodGet, "/sessions/1/communities/120363yyy@g.us", testToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetCommunity_ProviderError(t *testing.T) {
	backend := &fakeBackend{communityErr: errors.New("whatsmeow: unclassified failure")}
	h := newTestServer(backend)
	rec := doRequest(t, h, http.MethodGet, "/sessions/1/communities/120363yyy@g.us", testToken)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d: %s", rec.Code, rec.Body.String())
	}
	var env envelope
	_ = json.Unmarshal(rec.Body.Bytes(), &env)
	if env.Error.Code != CodeProviderError {
		t.Fatalf("expected PROVIDER_ERROR, got %+v", env.Error)
	}
}
