package groupsapi

import (
	"net/http"
	"sync"
	"time"
)

// throttle is the DEFENSE-IN-DEPTH rate limiter for group write actions
// (T1.4, plan invariant 4) — keyed by sessionID only, since this API has no
// tenant concept of its own (see groups_client.go's tenantId doc comment).
// The PRIMARY limiter, which also covers izapia connections (never routed
// through this API at all), lives in business/internal/plugins/groups_throttle.go
// (#521). This one exists so a single misbehaving enginego connection can't
// hammer whatsmeow even if the business-side limiter is ever bypassed or
// misconfigured.
type throttle struct {
	mu      sync.Mutex
	buckets map[int]*throttleBucket
	limit   int
	window  time.Duration
}

type throttleBucket struct {
	count      int
	windowFrom time.Time
}

func newThrottle() *throttle {
	return &throttle{
		buckets: make(map[int]*throttleBucket),
		limit:   20,
		window:  time.Minute,
	}
}

// Allow reports whether one more write action is permitted for sessionID
// right now, consuming a slot if so. Same reset-window scheme as the
// business-side limiter — simple and sufficient for a conservative default;
// T5.1 (plan hardening phase) revisits both defaults together against real
// anti-ban data.
func (t *throttle) Allow(sessionID int) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	b, ok := t.buckets[sessionID]
	if !ok || now.Sub(b.windowFrom) >= t.window {
		t.buckets[sessionID] = &throttleBucket{count: 1, windowFrom: now}
		return true
	}
	if b.count >= t.limit {
		return false
	}
	b.count++
	return true
}

// withThrottle wraps a write handler so it never reaches whatsmeow once the
// session is over budget — rejects with 429 RATE_LIMITED before parsing the
// body or touching the Backend at all.
func withThrottle(t *throttle, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID, ok := parseSessionID(w, r)
		if !ok {
			return
		}
		if !t.Allow(sessionID) {
			writeError(w, http.StatusTooManyRequests, CodeRateLimited,
				"too many group write actions on this session — slow down to avoid a WhatsApp ban")
			return
		}
		next(w, r)
	}
}
