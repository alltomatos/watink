package groupsapi

import (
	"net/http"
	"testing"

	"github.com/alltomatos/watinkdev/engine-go/internal/whatsapp"
)

func TestCreateCommunity_HappyPath(t *testing.T) {
	backend := &fakeBackend{community: &whatsapp.CommunityInfo{GroupInfo: whatsapp.GroupInfo{JID: "comm-1@g.us", Subject: "Comunidade"}}}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/communities", testToken, map[string]interface{}{
		"tenantId": "tenant-1", "name": "Comunidade",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if backend.lastTenantID != "tenant-1" {
		t.Fatalf("expected tenantId propagated, got %q", backend.lastTenantID)
	}
}

func TestCreateCommunity_MissingName(t *testing.T) {
	backend := &fakeBackend{}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/communities", testToken, map[string]interface{}{
		"tenantId": "tenant-1",
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestLinkCommunityGroup_HappyPath(t *testing.T) {
	backend := &fakeBackend{}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/communities/comm-1@g.us/groups/sub-1@g.us", testToken, map[string]interface{}{
		"tenantId": "tenant-1",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestLinkCommunityGroup_AlreadyLinked_PropagatesError(t *testing.T) {
	backend := &fakeBackend{writeErr: fmtGroupNotAdmin()}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/communities/comm-1@g.us/groups/sub-1@g.us", testToken, map[string]interface{}{
		"tenantId": "tenant-1",
	})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUnlinkCommunityGroup_HappyPath(t *testing.T) {
	backend := &fakeBackend{}
	h := newTestServer(backend)
	rec := doJSONRequest(t, h, http.MethodPost, "/sessions/1/communities/comm-1@g.us/groups/sub-1@g.us/remove", testToken, map[string]interface{}{
		"tenantId": "tenant-1",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
