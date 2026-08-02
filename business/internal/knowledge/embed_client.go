package knowledge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"
)

// EmbedConfig is the tenant's embedding gateway configuration, read from the
// Settings table (aiEmbeddingModel/aiEmbeddingBaseURL/aiEmbeddingApiKey, with
// aiCustomBaseURL/aiApiKey as fallback when no dedicated embedding gateway is
// configured — same fallback the Python service used).
type EmbedConfig struct {
	BaseURL string
	APIKey  string
	Model   string
	// Dim is the embedding dimension expected for Model. It is validated
	// against what the gateway actually returns — unlike the old service,
	// it is NOT a global fixed constant, so tenants on a 1536-dim model
	// (e.g. text-embedding-3-small) work instead of failing 100% of the time.
	Dim int
}

const (
	embedBatchSize = 16
	embedTimeout   = 120 * time.Second
	embedMaxTries  = 4
)

// embedClient calls a tenant's OpenAI-compatible embeddings endpoint
// (POST {baseURL}/embeddings), mirroring pkg/aiclient's callOpenAICompatible.
type embedClient struct {
	httpClient *http.Client
}

func newEmbedClient() *embedClient {
	return &embedClient{httpClient: &http.Client{Timeout: embedTimeout}}
}

// EmbedTexts embeds all texts in batches of embedBatchSize, retrying transient
// failures (429, 5xx, timeouts, connection errors — unlike the old service,
// which only retried 429) with exponential backoff + jitter. A batch that
// fails after all retries returns the vectors embedded so far alongside the
// error, so a caller can persist partial progress instead of discarding
// everything already embedded (the old service's failure mode).
func (c *embedClient) EmbedTexts(ctx context.Context, cfg EmbedConfig, texts []string) ([][]float32, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("ERR_NO_EMBEDDING_API_KEY")
	}
	if cfg.BaseURL == "" {
		return nil, fmt.Errorf("ERR_NO_EMBEDDING_BASE_URL")
	}

	out := make([][]float32, 0, len(texts))
	for start := 0; start < len(texts); start += embedBatchSize {
		end := start + embedBatchSize
		if end > len(texts) {
			end = len(texts)
		}
		batch := texts[start:end]

		vectors, err := c.embedBatchWithRetry(ctx, cfg, batch)
		if err != nil {
			// Partial progress preserved: everything embedded before this
			// batch failed is still returned to the caller.
			return out, fmt.Errorf("embed batch [%d:%d]: %w", start, end, err)
		}
		out = append(out, vectors...)
	}
	return out, nil
}

func (c *embedClient) embedBatchWithRetry(ctx context.Context, cfg EmbedConfig, batch []string) ([][]float32, error) {
	var lastErr error
	for attempt := 0; attempt < embedMaxTries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			jitter := time.Duration(rand.Int63n(int64(backoff / 2)))
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff + jitter):
			}
		}

		vectors, retryable, err := c.embedBatch(ctx, cfg, batch)
		if err == nil {
			return vectors, nil
		}
		lastErr = err
		if !retryable {
			return nil, err
		}
	}
	return nil, fmt.Errorf("exhausted retries: %w", lastErr)
}

// embedBatch performs one HTTP call. retryable reports whether the caller
// should retry: true for 429/5xx/timeout/connection errors, false for 4xx
// (other than 429) and decode failures, which won't succeed on retry.
func (c *embedClient) embedBatch(ctx context.Context, cfg EmbedConfig, batch []string) (vectors [][]float32, retryable bool, err error) {
	payload := map[string]any{
		"model": cfg.Model,
		"input": batch,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(cfg.BaseURL, "/")+"/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, false, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Transport-level failure (timeout, connection refused, DNS) — retry.
		return nil, true, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
		b, _ := io.ReadAll(resp.Body)
		return nil, true, fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, false, fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
			Index     int       `json:"index"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, false, err
	}
	if len(result.Data) != len(batch) {
		return nil, false, fmt.Errorf("expected %d embeddings, got %d", len(batch), len(result.Data))
	}

	vectors = make([][]float32, len(result.Data))
	for _, d := range result.Data {
		if d.Index < 0 || d.Index >= len(vectors) {
			return nil, false, fmt.Errorf("embedding index %d out of range", d.Index)
		}
		if cfg.Dim > 0 && len(d.Embedding) != cfg.Dim {
			return nil, false, fmt.Errorf("ERR_EMBEDDING_DIM_MISMATCH: expected %d, got %d", cfg.Dim, len(d.Embedding))
		}
		vectors[d.Index] = d.Embedding
	}
	return vectors, false, nil
}
