package knowledge

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func embedResponse(dim int, n int) map[string]any {
	data := make([]map[string]any, n)
	for i := 0; i < n; i++ {
		vec := make([]float64, dim)
		for j := range vec {
			vec[j] = 0.1
		}
		data[i] = map[string]any{"embedding": vec, "index": i}
	}
	return map[string]any{"data": data}
}

func TestEmbedTexts_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Input []string `json:"input"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_ = json.NewEncoder(w).Encode(embedResponse(4, len(body.Input)))
	}))
	defer srv.Close()

	c := newEmbedClient()
	cfg := EmbedConfig{BaseURL: srv.URL, APIKey: "k", Model: "m", Dim: 4}
	vecs, err := c.EmbedTexts(context.Background(), cfg, []string{"a", "b", "c"})
	require.NoError(t, err)
	assert.Len(t, vecs, 3)
	assert.Len(t, vecs[0], 4)
}

func TestEmbedTexts_RetriesOn5xxThenSucceeds(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) == 1 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		var body struct {
			Input []string `json:"input"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_ = json.NewEncoder(w).Encode(embedResponse(4, len(body.Input)))
	}))
	defer srv.Close()

	c := newEmbedClient()
	cfg := EmbedConfig{BaseURL: srv.URL, APIKey: "k", Model: "m", Dim: 4}
	vecs, err := c.EmbedTexts(context.Background(), cfg, []string{"a"})
	require.NoError(t, err)
	assert.Len(t, vecs, 1)
	assert.GreaterOrEqual(t, atomic.LoadInt32(&calls), int32(2))
}

func TestEmbedTexts_PartialBatchFailurePreservesProgress(t *testing.T) {
	var batch int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&batch, 1)
		if n > 1 {
			// Second batch always fails (non-retryable 400) so the test
			// doesn't wait through the retry backoff.
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		var body struct {
			Input []string `json:"input"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_ = json.NewEncoder(w).Encode(embedResponse(4, len(body.Input)))
	}))
	defer srv.Close()

	c := newEmbedClient()
	cfg := EmbedConfig{BaseURL: srv.URL, APIKey: "k", Model: "m", Dim: 4}
	texts := make([]string, embedBatchSize+1) // forces 2 batches
	for i := range texts {
		texts[i] = "t"
	}

	vecs, err := c.EmbedTexts(context.Background(), cfg, texts)
	require.Error(t, err)
	// First batch (embedBatchSize items) succeeded and must be preserved.
	assert.Len(t, vecs, embedBatchSize)
}

func TestEmbedTexts_MissingConfig(t *testing.T) {
	c := newEmbedClient()
	_, err := c.EmbedTexts(context.Background(), EmbedConfig{}, []string{"a"})
	assert.Error(t, err)
}
