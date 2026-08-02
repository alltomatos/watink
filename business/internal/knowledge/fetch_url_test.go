package knowledge

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func longArticleHTML() string {
	var b strings.Builder
	b.WriteString("<html><head><title>Teste</title></head><body><article><h1>Teste</h1>")
	for i := 0; i < 40; i++ {
		b.WriteString("<p>Este é um parágrafo de teste com bastante conteúdo textual para passar do limiar mínimo de extração configurado no fetcher.</p>")
	}
	b.WriteString("</article></body></html>")
	return b.String()
}

// withPlainDialer swaps out the SSRF-guarded dialer for a plain one so tests
// can hit an httptest server (loopback), which the guard would otherwise
// correctly refuse in production. Restored via t.Cleanup.
func withPlainDialer(t *testing.T) {
	t.Helper()
	orig := dialContextFunc
	dialContextFunc = (&net.Dialer{Timeout: 10 * time.Second}).DialContext
	t.Cleanup(func() { dialContextFunc = orig })
}

func TestFetchURL_Success(t *testing.T) {
	withPlainDialer(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(longArticleHTML()))
	}))
	defer srv.Close()

	doc, err := FetchURL(context.Background(), srv.URL)
	require.NoError(t, err)
	assert.Contains(t, doc.Text, "parágrafo de teste")
}

func TestFetchURL_RetriesOn5xx(t *testing.T) {
	withPlainDialer(t)
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write([]byte(longArticleHTML()))
	}))
	defer srv.Close()

	doc, err := FetchURL(context.Background(), srv.URL)
	require.NoError(t, err)
	assert.NotEmpty(t, doc.Text)
	assert.GreaterOrEqual(t, atomic.LoadInt32(&calls), int32(2))
}

func TestFetchURL_EmptyContentFails(t *testing.T) {
	withPlainDialer(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("<html><body><div>oi</div></body></html>"))
	}))
	defer srv.Close()

	_, err := FetchURL(context.Background(), srv.URL)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ERR_EMPTY_CONTENT")
}

func TestFetchURL_RejectsUnsupportedScheme(t *testing.T) {
	_, err := FetchURL(context.Background(), "ftp://example.com/file")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ERR_UNSUPPORTED_SCHEME")
}

func TestFetchURL_SSRFBlocksLoopback(t *testing.T) {
	// A server bound to loopback is a stand-in for an internal service — the
	// dialer must refuse it regardless of what the URL host resolves to.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer func() { _ = ln.Close() }()

	go func() {
		_ = http.Serve(ln, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(longArticleHTML()))
		}))
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = FetchURL(ctx, "http://"+ln.Addr().String())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ERR_SSRF")
}

func TestIsPublicIP(t *testing.T) {
	assert.False(t, isPublicIP(net.ParseIP("127.0.0.1")))
	assert.False(t, isPublicIP(net.ParseIP("10.0.0.1")))
	assert.False(t, isPublicIP(net.ParseIP("169.254.169.254")))
	assert.False(t, isPublicIP(net.ParseIP("::1")))
	assert.True(t, isPublicIP(net.ParseIP("8.8.8.8")))
}
