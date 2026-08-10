package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// fakeSaaSTokenReader implements SaaSTokenReader for tests, without touching
// Postgres — the same role services.SaaSContractService plays in production.
type fakeSaaSTokenReader struct {
	token string
	ok    bool
	err   error
}

func (f fakeSaaSTokenReader) Token() (string, bool, error) {
	return f.token, f.ok, f.err
}

func serveWithCache(t *testing.T, cache *SaaSTokenCache, headerTok string) (int, bool) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	nextCalled := false
	r := gin.New()
	r.GET("/internal/saas/ping", InternalSaaSOnly(cache), func(c *gin.Context) {
		nextCalled = true
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/internal/saas/ping", nil)
	if headerTok != "" {
		req.Header.Set("X-Internal-Token", headerTok)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code, nextCalled
}

func TestInternalSaaSOnly_ViaEnv(t *testing.T) {
	const token = "s3cr3t-per-instance-token"

	cases := []struct {
		name       string
		envToken   string
		headerTok  string
		wantStatus int
		wantNext   bool
	}{
		{name: "fail-closed sem env", envToken: "", headerTok: token, wantStatus: http.StatusServiceUnavailable, wantNext: false},
		{name: "sem header", envToken: token, headerTok: "", wantStatus: http.StatusUnauthorized, wantNext: false},
		{name: "token errado", envToken: token, headerTok: "wrong", wantStatus: http.StatusUnauthorized, wantNext: false},
		{name: "token certo", envToken: token, headerTok: token, wantStatus: http.StatusOK, wantNext: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("SAAS_INTERNAL_TOKEN", tc.envToken)

			// cache=nil replica uma instalação que nunca ativou o Modo SaaS
			// pela UI — resolução cai inteiramente para a env, comportamento
			// idêntico ao pré-existente.
			status, next := serveWithCache(t, nil, tc.headerTok)
			if status != tc.wantStatus {
				t.Fatalf("status = %d, quer %d", status, tc.wantStatus)
			}
			if next != tc.wantNext {
				t.Fatalf("nextCalled = %v, quer %v", next, tc.wantNext)
			}
		})
	}
}

func TestInternalSaaSOnly_ViaBanco_SemEnv(t *testing.T) {
	t.Setenv("SAAS_INTERNAL_TOKEN", "")

	cache := NewSaaSTokenCache(fakeSaaSTokenReader{token: "db-token", ok: true})

	status, next := serveWithCache(t, cache, "db-token")
	if status != http.StatusOK || !next {
		t.Fatalf("esperava 200 autenticando só com o token do banco, got status=%d next=%v", status, next)
	}

	status, next = serveWithCache(t, cache, "wrong")
	if status != http.StatusUnauthorized || next {
		t.Fatalf("esperava 401 com token errado, got status=%d next=%v", status, next)
	}
}

func TestInternalSaaSOnly_NemBancoNemEnv_FailClosed(t *testing.T) {
	t.Setenv("SAAS_INTERNAL_TOKEN", "")

	cache := NewSaaSTokenCache(fakeSaaSTokenReader{ok: false})

	status, next := serveWithCache(t, cache, "qualquer-coisa")
	if status != http.StatusServiceUnavailable || next {
		t.Fatalf("esperava 503 fail-closed, got status=%d next=%v", status, next)
	}
}

func TestInternalSaaSOnly_ErroDeLeitura_DegradaParaEnv(t *testing.T) {
	t.Setenv("SAAS_INTERNAL_TOKEN", "env-token")

	cache := NewSaaSTokenCache(fakeSaaSTokenReader{err: errors.New("boom")})

	status, next := serveWithCache(t, cache, "env-token")
	if status != http.StatusOK || !next {
		t.Fatalf("erro transitório de leitura deveria degradar para a env, got status=%d next=%v", status, next)
	}
}

func TestSaaSTokenCache_RespeitaTTL(t *testing.T) {
	reader := &countingReader{token: "first", ok: true}
	cache := NewSaaSTokenCache(reader)

	tok, ok := cache.Token()
	if !ok || tok != "first" || reader.calls != 1 {
		t.Fatalf("primeira chamada deveria ler do reader: tok=%q ok=%v calls=%d", tok, ok, reader.calls)
	}

	reader.token = "second"
	tok, ok = cache.Token()
	if !ok || tok != "first" || reader.calls != 1 {
		t.Fatalf("dentro do TTL não deveria reconsultar o reader: tok=%q ok=%v calls=%d", tok, ok, reader.calls)
	}

	cache.Invalidate()
	tok, ok = cache.Token()
	if !ok || tok != "second" || reader.calls != 2 {
		t.Fatalf("após Invalidate deveria reconsultar o reader: tok=%q ok=%v calls=%d", tok, ok, reader.calls)
	}
}

type countingReader struct {
	token string
	ok    bool
	calls int
}

func (r *countingReader) Token() (string, bool, error) {
	r.calls++
	return r.token, r.ok, nil
}
