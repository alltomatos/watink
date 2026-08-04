package izapia

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// realGroupResponse is the exact JSON shape captured live against the
// izapia API (session b474aeb3-16fb-4607-a8d6-8e8185c78d67, 2026-08-04),
// documented in engine-go/docs/groups-api.md "Probe real contra a izapia".
const realGroupResponse = `{
  "created": 1785463827,
  "description": "",
  "group_id": "120363410762725180@g.us",
  "owner": "61852109279407@lid",
  "participants": [
    { "is_admin": true,  "is_super_admin": true,  "jid": "61852109279407@lid" },
    { "is_admin": false, "is_super_admin": false, "jid": "54439448715448@lid" }
  ],
  "subject": "Watink plugins"
}`

func TestClient_ListGroups_HappyPath_RealShape(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/sessions/sess-1/groups", r.URL.Path)
		assert.Equal(t, http.MethodGet, r.Method)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":[` + realGroupResponse + `]}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	groups, err := client.ListGroups(context.Background(), "sess-1")
	require.NoError(t, err)
	require.Len(t, groups, 1)
	assert.Equal(t, "120363410762725180@g.us", groups[0].GroupID)
	assert.Equal(t, "Watink plugins", groups[0].Subject)
	require.Len(t, groups[0].Participants, 2)
	assert.True(t, groups[0].Participants[0].IsAdmin)
	assert.True(t, groups[0].Participants[0].IsSuperAdmin)
	assert.False(t, groups[0].Participants[1].IsAdmin)
}

func TestClient_GetGroup_NotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":false,"error":{"code":"NOT_FOUND","message":"group not found"}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	_, err := client.GetGroup(context.Background(), "sess-1", "999@g.us")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "group not found")
}

func TestClient_CreateGroup_SendsCorrectBody(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		assert.Equal(t, http.MethodPost, r.Method)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":` + realGroupResponse + `}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	g, err := client.CreateGroup(context.Background(), "sess-1", "Novo grupo", []string{"5511999999999@s.whatsapp.net"})
	require.NoError(t, err)
	assert.Equal(t, "/api/v1/sessions/sess-1/groups", gotPath)
	assert.Equal(t, "120363410762725180@g.us", g.GroupID)
}

func TestClient_UpdateGroupParticipants_PartialResults(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/sessions/sess-1/groups/120363xxx@g.us/participants", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":{"participants":[
			{"jid":"a@s.whatsapp.net","status":"ok"},
			{"jid":"b@s.whatsapp.net","status":"error","error":"not-on-whatsapp"}
		]}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	results, err := client.UpdateGroupParticipants(context.Background(), "sess-1", "120363xxx@g.us", "add", []string{"a@s.whatsapp.net", "b@s.whatsapp.net"})
	require.NoError(t, err)
	require.Len(t, results, 2)
	assert.Equal(t, "ok", results[0].Status)
	assert.Equal(t, "error", results[1].Status)
	assert.Equal(t, "not-on-whatsapp", results[1].Error)
}

// TestClient_GroupJIDRoundTripsThroughPathEscape verifies the JID reaches
// the server unmangled (url.PathEscape leaves "@" as-is — it's a valid
// path-segment character per RFC 3986 — but a slash or space inside a JID
// would break routing if unescaped, hence still going through PathEscape).
func TestClient_GroupJIDRoundTripsThroughPathEscape(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/sessions/sess-1/groups/120363xxx@g.us", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":` + realGroupResponse + `}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	_, err := client.GetGroup(context.Background(), "sess-1", "120363xxx@g.us")
	require.NoError(t, err)
}

func TestClient_Timeout_Propagates(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":[]}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()
	_, err := client.ListGroups(ctx, "sess-1")
	require.Error(t, err)
}

// realCommunityDetailResponse and realCommunityCreateResponse are the EXACT
// shapes captured live against the izapia API (session
// b474aeb3-16fb-4607-a8d6-8e8185c78d67, 2026-08-04) — the OpenAPI schema for
// these endpoints is description-only, and the original T0.1 draft's
// assumed shape (mirroring the group list response, with a "linkedGroups"
// field) turned out to be wrong. See engine-go/docs/groups-api.md.
const realCommunityDetailResponse = `{
  "groups": [
    { "group_id": "120363426723543087@g.us", "is_default_sub_group": true, "subject": "Watink QA - probe temporario" }
  ],
  "participant_count": 1,
  "participants": ["54439448715448@lid"]
}`

const realCommunityCreateResponse = `{
  "community_id": "120363428629289471@g.us",
  "created": 1785847047,
  "description": "",
  "owner": "54439448715448@lid",
  "participants": [{ "is_admin": true, "is_super_admin": true, "jid": "54439448715448@lid" }],
  "subject": "Watink QA - probe temporario"
}`

func TestClient_CreateCommunity_RealShape(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/sessions/sess-1/communities", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":` + realCommunityCreateResponse + `}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	community, err := client.CreateCommunity(context.Background(), "sess-1", "Watink QA - probe temporario")
	require.NoError(t, err)
	assert.Equal(t, "120363428629289471@g.us", community.CommunityID)
	assert.Equal(t, "Watink QA - probe temporario", community.Subject)
	require.Len(t, community.Participants, 1)
	assert.True(t, community.Participants[0].IsSuperAdmin)
}

func TestClient_GetCommunity_RealShape(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/sessions/sess-1/communities/comm-1@g.us", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":` + realCommunityDetailResponse + `}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	community, err := client.GetCommunity(context.Background(), "sess-1", "comm-1@g.us")
	require.NoError(t, err)
	assert.Equal(t, 1, community.ParticipantCount)
	require.Len(t, community.Participants, 1)
	assert.Equal(t, "54439448715448@lid", community.Participants[0])
	require.Len(t, community.Groups, 1)
	assert.Equal(t, "120363426723543087@g.us", community.Groups[0].GroupID)
	assert.True(t, community.Groups[0].IsDefaultSubGroup)
}

func TestClient_LinkCommunityGroup_5xxPropagates(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":false,"error":{"code":"PROVIDER_ERROR","message":"internal failure"}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	err := client.LinkCommunityGroup(context.Background(), "sess-1", "comm-1@g.us", "sub-1@g.us")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "internal failure")
}
