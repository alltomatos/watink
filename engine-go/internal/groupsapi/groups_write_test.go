package groupsapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/engine-go/internal/whatsapp"
)

func doJSONRequest(t *testing.T, h http.Handler, method, path, token string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	if token != "" {
		req.Header.Set("X-Internal-Token", token)
	}
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func fmtGroupNotAdmin() error {
	return fmt.Errorf("%w: iq error 403", whatsapp.ErrGroupNotAdmin)
}

func fmtGroupRateLimited() error {
	return fmt.Errorf("%w: iq error 429", whatsapp.ErrGroupRateLimited)
}

func TestCreateGroup_HappyPath(t *testing.T) {
	backend := &fakeBackend{group: &whatsapp.GroupInfo{JID: "120363xxx@g.us", Subject: "Novo grupo"}}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups", testToken, map[string]interface{}{
		"tenantId": "tenant-1", "subject": "Novo grupo", "participants": []string{"5511999999999@s.whatsapp.net"},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if backend.lastTenantID != "tenant-1" {
		t.Fatalf("expected tenantId to be passed through, got %q", backend.lastTenantID)
	}
}

func TestCreateGroup_MissingSubject(t *testing.T) {
	backend := &fakeBackend{}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups", testToken, map[string]interface{}{
		"tenantId": "tenant-1", "participants": []string{},
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestUpdateParticipants_ActionPassedThrough(t *testing.T) {
	backend := &fakeBackend{results: []whatsapp.ParticipantResult{{JID: "a@s.whatsapp.net", Status: "ok"}}}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups/120363xxx@g.us/participants", testToken, map[string]interface{}{
		"tenantId": "tenant-1", "action": "promote", "participants": []string{"a@s.whatsapp.net"},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if backend.lastAction != "promote" {
		t.Fatalf("expected action=promote, got %q", backend.lastAction)
	}
}

func TestUpdateParticipants_EmptyParticipants(t *testing.T) {
	backend := &fakeBackend{}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups/120363xxx@g.us/participants", testToken, map[string]interface{}{
		"tenantId": "tenant-1", "action": "add", "participants": []string{},
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestUpdateGroupSettings_NotAdmin_Returns403(t *testing.T) {
	backend := &fakeBackend{writeErr: fmtGroupNotAdmin()}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPut, "/sessions/1/groups/120363xxx@g.us", testToken, map[string]interface{}{
		"tenantId": "tenant-1", "subject": "novo nome",
	})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", rec.Code, rec.Body.String())
	}
	var env envelope
	_ = json.Unmarshal(rec.Body.Bytes(), &env)
	if env.Error.Code != CodeNotAdmin {
		t.Fatalf("expected NOT_ADMIN, got %+v", env.Error)
	}
}

func TestUpdateGroupSettings_RateLimited_Returns429(t *testing.T) {
	backend := &fakeBackend{writeErr: fmtGroupRateLimited()}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPut, "/sessions/1/groups/120363xxx@g.us", testToken, map[string]interface{}{
		"tenantId": "tenant-1", "locked": true,
	})
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d: %s", rec.Code, rec.Body.String())
	}
	var env envelope
	_ = json.Unmarshal(rec.Body.Bytes(), &env)
	if env.Error.Code != CodeRateLimited {
		t.Fatalf("expected RATE_LIMITED, got %+v", env.Error)
	}
}

func TestRevokeInviteLink_HappyPath(t *testing.T) {
	backend := &fakeBackend{link: "https://chat.whatsapp.com/new"}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups/120363xxx@g.us/invite/revoke", testToken, map[string]interface{}{
		"tenantId": "tenant-1",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestLeaveGroup_HappyPath(t *testing.T) {
	backend := &fakeBackend{}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups/120363xxx@g.us/leave", testToken, map[string]interface{}{
		"tenantId": "tenant-1",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestResolveJoinRequests_EmptyParticipants(t *testing.T) {
	backend := &fakeBackend{}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/groups/120363xxx@g.us/join-requests", testToken, map[string]interface{}{
		"tenantId": "tenant-1", "action": "approve", "participants": []string{},
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestListJoinRequests_HappyPath(t *testing.T) {
	backend := &fakeBackend{joinRequests: []whatsapp.JoinRequestEntry{{JID: "a@s.whatsapp.net", RequestedAt: 123}}}
	h := newTestServer(backend)
	rec := doRequest(t, h, http.MethodGet, "/sessions/1/groups/120363xxx@g.us/join-requests", testToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
