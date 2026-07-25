package pluginlicense

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func newTestClient(baseURL string, ttl time.Duration) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultTimeout},
		ttl:        ttl,
		cache:      make(map[string]LicenseInfo),
	}
}

func TestGetLicense_NormalResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(licensesResponse{
			Licenses: map[string]LicenseInfo{
				"helpdesk": {Status: "active", TenantCap: 0, Exp: 0},
			},
		})
	}))
	defer srv.Close()

	c := newTestClient(srv.URL, 60*time.Second)

	info, err := c.GetLicense("helpdesk")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Status != "active" {
		t.Errorf("expected status active, got %s", info.Status)
	}
}

func TestGetLicense_MultiplePlugins(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(licensesResponse{
			Licenses: map[string]LicenseInfo{
				"helpdesk": {Status: "active", TenantCap: 0, Exp: 0},
				"webchat":  {Status: "blocked", TenantCap: 5, Exp: 123456},
			},
		})
	}))
	defer srv.Close()

	c := newTestClient(srv.URL, 60*time.Second)

	helpdesk, err := c.GetLicense("helpdesk")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if helpdesk.Status != "active" {
		t.Errorf("expected helpdesk active, got %s", helpdesk.Status)
	}

	webchat, err := c.GetLicense("webchat")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if webchat.Status != "blocked" || webchat.TenantCap != 5 || webchat.Exp != 123456 {
		t.Errorf("unexpected webchat info: %+v", webchat)
	}
}

func TestGetLicense_CacheServedWithinTTL(t *testing.T) {
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(licensesResponse{
			Licenses: map[string]LicenseInfo{
				"helpdesk": {Status: "active"},
			},
		})
	}))
	defer srv.Close()

	c := newTestClient(srv.URL, 60*time.Second)

	if _, err := c.GetLicense("helpdesk"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := c.GetLicense("helpdesk"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := atomic.LoadInt32(&hits); got != 1 {
		t.Errorf("expected 1 hit to plugin-manager (cache should serve second call), got %d", got)
	}
}

func TestGetLicense_TTLExpiresAndRefetches(t *testing.T) {
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&hits, 1)
		status := "active"
		if n > 1 {
			status = "readonly"
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(licensesResponse{
			Licenses: map[string]LicenseInfo{
				"helpdesk": {Status: status},
			},
		})
	}))
	defer srv.Close()

	c := newTestClient(srv.URL, 10*time.Millisecond)

	info, err := c.GetLicense("helpdesk")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Status != "active" {
		t.Errorf("expected active on first fetch, got %s", info.Status)
	}

	time.Sleep(30 * time.Millisecond)

	info, err = c.GetLicense("helpdesk")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Status != "readonly" {
		t.Errorf("expected readonly after TTL expiry refetch, got %s", info.Status)
	}
	if got := atomic.LoadInt32(&hits); got != 2 {
		t.Errorf("expected 2 hits to plugin-manager after TTL expiry, got %d", got)
	}
}

func TestGetLicense_FallbackToStaleCacheWhenUnavailable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(licensesResponse{
			Licenses: map[string]LicenseInfo{
				"helpdesk": {Status: "active"},
			},
		})
	}))

	c := newTestClient(srv.URL, 10*time.Millisecond)

	// Primeira chamada popula o cache com o servidor no ar.
	info, err := c.GetLicense("helpdesk")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Status != "active" {
		t.Errorf("expected active, got %s", info.Status)
	}

	// Derruba o servidor e deixa o TTL vencer — deve servir do cache velho.
	srv.Close()
	time.Sleep(30 * time.Millisecond)

	info, err = c.GetLicense("helpdesk")
	if err != nil {
		t.Fatalf("expected fallback to stale cache, got error: %v", err)
	}
	if info.Status != "active" {
		t.Errorf("expected stale cached status active as fallback, got %s", info.Status)
	}
}

func TestGetLicense_ErrorWhenUnavailableAndNoCache(t *testing.T) {
	// Nenhum servidor real escutando nesta porta improvável.
	c := newTestClient("http://127.0.0.1:1", 60*time.Second)

	_, err := c.GetLicense("helpdesk")
	if err == nil {
		t.Fatal("expected error when plugin-manager is unavailable and no cache exists")
	}
}

func TestGetLicense_UnknownSlugInResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(licensesResponse{
			Licenses: map[string]LicenseInfo{
				"helpdesk": {Status: "active"},
			},
		})
	}))
	defer srv.Close()

	c := newTestClient(srv.URL, 60*time.Second)

	_, err := c.GetLicense("nonexistent")
	if err == nil {
		t.Fatal("expected error for a slug not present in the plugin-manager response")
	}
}

// TestNewClient_BaseURLIsHardcoded trava a propriedade de segurança central
// desta mudança: a URL do plugin-manager é FIXA em código, imune a
// PLUGIN_MANAGER_URL no ambiente. Um operador self-hosted não pode
// redirecionar essa URL via .env para um servidor falso e contornar o
// licenciamento (ADR 0024).
func TestNewClient_BaseURLIsHardcoded(t *testing.T) {
	t.Setenv("PLUGIN_MANAGER_URL", "http://attacker-controlled:9999")

	c := NewClient()
	if c.baseURL != pluginManagerBaseURL {
		t.Errorf("expected hardcoded base URL %s (immune to env), got %s", pluginManagerBaseURL, c.baseURL)
	}
	if c.ttl != defaultTTLSecs*time.Second {
		t.Errorf("expected default TTL %v, got %v", defaultTTLSecs*time.Second, c.ttl)
	}
}
