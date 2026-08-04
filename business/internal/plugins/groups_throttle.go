package plugins

import (
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
)

// groupsThrottle is the PRIMARY rate limiter for group write actions
// (invariant 4, plan §2.2) — the engine-go-side limiter (T1.4) only ever
// sees traffic from enginego connections; izapia connections talk straight
// to api.izapia.com and never touch engine-go at all. This is the one
// limiter that sees every write regardless of provider.
//
// KNOWN LIMITATION (documented, not silently shipped): this bucket is
// in-memory and per-process. In a multi-node business deployment the
// effective cap is `nodes × limit`, since the plugin SDK (pkg/sdk) doesn't
// expose Redis to plugins today (only WatinkCoreScheduler's cron/event
// bus). Tracked as follow-up hardening work (T5.1) — extending the SDK is
// out of scope for this plugin.
type groupsThrottle struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	// limit/window are conservative defaults — T5.1 revisits these against
	// real anti-ban data before production go-live.
	limit  int
	window time.Duration
}

type bucket struct {
	count      int
	windowFrom time.Time
}

func newGroupsThrottle() *groupsThrottle {
	return &groupsThrottle{
		buckets: make(map[string]*bucket),
		limit:   20,
		window:  time.Minute,
	}
}

// Allow reports whether one more write action is permitted for
// (tenantID, whatsappID) right now, consuming one slot from the bucket if
// so. Sliding-window-by-reset (not a true sliding window) — simple and
// sufficient for a conservative default; upgrade if T5.1's real data calls
// for smoother throttling.
func (t *groupsThrottle) Allow(tenantID uuid.UUID, whatsappID int) bool {
	key := tenantID.String() + ":" + strconv.Itoa(whatsappID)

	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	b, ok := t.buckets[key]
	if !ok || now.Sub(b.windowFrom) >= t.window {
		t.buckets[key] = &bucket{count: 1, windowFrom: now}
		return true
	}
	if b.count >= t.limit {
		return false
	}
	b.count++
	return true
}
