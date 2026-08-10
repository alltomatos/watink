package middleware

import (
	"sync"
	"time"
)

// SaaSTokenReader is the read surface InternalSaaSOnly needs to resolve the
// per-instance internal token from the database (Modo SaaS contract,
// services.SaaSContractService.Token). Kept as a narrow interface so
// middleware tests can fake it without touching Postgres.
type SaaSTokenReader interface {
	// Token returns the current internal token and whether the instance is
	// paired at all. "not paired" is an expected outcome (ok=false, err=nil)
	// — only a genuine read failure returns a non-nil err.
	Token() (token string, ok bool, err error)
}

const defaultSaaSTokenCacheTTL = 60 * time.Second

// SaaSTokenCache caches the DB-backed internal token with a short TTL
// (mirrors services.TenantStatusService) so InternalSaaSOnly never runs a
// SELECT per request — only on cache miss/expiry or after Invalidate().
type SaaSTokenCache struct {
	reader SaaSTokenReader
	ttl    time.Duration

	mu        sync.Mutex
	token     string
	ok        bool
	hasFetch  bool
	fetchedAt time.Time
}

func NewSaaSTokenCache(reader SaaSTokenReader) *SaaSTokenCache {
	return &SaaSTokenCache{reader: reader, ttl: defaultSaaSTokenCacheTTL}
}

// Token resolves the current token, refreshing from the reader when the
// cache is empty or stale. A read error degrades to ok=false (never a stale
// positive) so the caller falls back to the env var instead of blocking the
// request on a transient DB hiccup.
func (c *SaaSTokenCache) Token() (string, bool) {
	c.mu.Lock()
	if c.hasFetch && time.Since(c.fetchedAt) < c.ttl {
		token, ok := c.token, c.ok
		c.mu.Unlock()
		return token, ok
	}
	c.mu.Unlock()

	token, ok, err := c.reader.Token()
	if err != nil {
		token, ok = "", false
	}

	c.mu.Lock()
	c.token, c.ok, c.hasFetch, c.fetchedAt = token, ok, true, time.Now()
	c.mu.Unlock()

	return token, ok
}

// Invalidate forces the next Token() call to re-read from the database —
// call it right after the contract is (re)written
// (services.SaaSContractService.Set) so a token rotation doesn't wait up to
// the TTL to take effect.
func (c *SaaSTokenCache) Invalidate() {
	c.mu.Lock()
	c.hasFetch = false
	c.mu.Unlock()
}
