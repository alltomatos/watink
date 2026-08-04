package enginego

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// realGroupResponse mirrors engine-go's own DTO exactly (same JSON tags as
// domain.GroupInfo — the whole point of the code-mirror design documented
// in groups.go).
const realGroupResponse = `{
  "jid": "120363xxx@g.us",
  "subject": "Watink plugins",
  "description": "",
  "owner": "5511999999999@s.whatsapp.net",
  "isCommunity": false,
  "isSubGroup": false,
  "announce": true,
  "locked": false,
  "memberAddMode": "admin_add",
  "joinApprovalMode": false,
  "createdAt": 1785463827,
  "participants": [
    {"jid": "5511999999999@s.whatsapp.net", "isAdmin": true, "isSuperAdmin": true}
  ]
}`

func setupGroupsTestServer(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	t.Setenv("GROUPS_API_URL", srv.URL)
	t.Setenv("GROUPS_API_TOKEN", "test-internal-token")
}

func TestGroupsAPIConfig_MissingEnv_ReturnsFriendlyError(t *testing.T) {
	t.Setenv("GROUPS_API_URL", "")
	t.Setenv("GROUPS_API_TOKEN", "")
	_, _, err := groupsAPIConfig()
	require.Error(t, err)
}

func TestProvider_ListGroups_SendsTokenAndHappyPath(t *testing.T) {
	var gotToken string
	setupGroupsTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotToken = r.Header.Get("X-Internal-Token")
		assert.Equal(t, "/sessions/42/groups", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":[` + realGroupResponse + `]}`))
	})

	p := New(nil, nil)
	groups, err := p.ListGroups(context.Background(), models.Whatsapp{ID: 42})
	require.NoError(t, err)
	assert.Equal(t, "test-internal-token", gotToken)
	require.Len(t, groups, 1)
	assert.Equal(t, "120363xxx@g.us", groups[0].JID)
	assert.True(t, groups[0].Announce)
	assert.Equal(t, "admin_add", groups[0].MemberAddMode)
}

func TestProvider_GetGroup_NotFound(t *testing.T) {
	setupGroupsTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":false,"error":{"code":"NOT_FOUND","message":"group not found"}}`))
	})

	p := New(nil, nil)
	_, err := p.GetGroup(context.Background(), models.Whatsapp{ID: 42}, "120363xxx@g.us")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "group not found")
}

func TestProvider_CreateGroup_SendsBody(t *testing.T) {
	var gotBody map[string]interface{}
	setupGroupsTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":` + realGroupResponse + `}`))
	})

	p := New(nil, nil)
	g, err := p.CreateGroup(context.Background(), models.Whatsapp{ID: 42}, "Novo grupo", []string{"5511999999999@s.whatsapp.net"})
	require.NoError(t, err)
	assert.Equal(t, "Novo grupo", gotBody["subject"])
	assert.Equal(t, "120363xxx@g.us", g.JID)
}

func TestProvider_UpdateGroupSettings_OnlySendsChangedFields(t *testing.T) {
	var gotBody map[string]interface{}
	setupGroupsTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPut, r.Method)
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	p := New(nil, nil)
	subject := "novo nome"
	announce := true
	err := p.UpdateGroupSettings(context.Background(), models.Whatsapp{ID: 42}, "120363xxx@g.us", domain.GroupSettingsPatch{Subject: &subject, Announce: &announce})
	require.NoError(t, err)
	assert.Equal(t, "novo nome", gotBody["subject"])
	assert.Equal(t, true, gotBody["announce"])
	_, hasLocked := gotBody["locked"]
	assert.False(t, hasLocked, "unset fields must not be sent")
}

func TestProvider_UpdateParticipants_PartialResults(t *testing.T) {
	setupGroupsTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/sessions/42/groups/120363xxx@g.us/participants", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":{"participants":[
			{"jid":"a@s.whatsapp.net","status":"ok"},
			{"jid":"b@s.whatsapp.net","status":"error","error":"not-on-whatsapp"}
		]}}`))
	})

	p := New(nil, nil)
	results, err := p.UpdateParticipants(context.Background(), models.Whatsapp{ID: 42}, "120363xxx@g.us", "add", []string{"a@s.whatsapp.net", "b@s.whatsapp.net"})
	require.NoError(t, err)
	require.Len(t, results, 2)
	assert.Equal(t, "ok", results[0].Status)
	assert.Equal(t, "not-on-whatsapp", results[1].Error)
}

func TestProvider_5xxPropagatesAsError(t *testing.T) {
	setupGroupsTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":false,"error":{"code":"PROVIDER_ERROR","message":"whatsmeow failure"}}`))
	})

	p := New(nil, nil)
	_, err := p.GetGroup(context.Background(), models.Whatsapp{ID: 42}, "120363xxx@g.us")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "whatsmeow failure")
}

func TestProvider_Timeout_PropagatesAndNoRetry(t *testing.T) {
	callCount := 0
	setupGroupsTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		callCount++
		time.Sleep(20 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":` + realGroupResponse + `}`))
	})

	p := New(nil, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()
	_, err := p.GetGroup(ctx, models.Whatsapp{ID: 42}, "120363xxx@g.us")
	require.Error(t, err)
	// Give the (already-failed) request time to have retried, if it were
	// going to — it must not, a retried write would duplicate the action.
	time.Sleep(50 * time.Millisecond)
	assert.LessOrEqual(t, callCount, 1, "write/read calls must never auto-retry")
}

func TestProvider_LinkGroupToCommunity_PathIncludesBothJIDs(t *testing.T) {
	setupGroupsTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/sessions/42/communities/comm-1@g.us/groups/sub-1@g.us", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	p := New(nil, nil)
	err := p.LinkGroupToCommunity(context.Background(), models.Whatsapp{ID: 42}, "comm-1@g.us", "sub-1@g.us")
	require.NoError(t, err)
}
