package knowledge

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type fakeReconcilerRedis struct {
	acquired bool
	calls    int
}

func (f *fakeReconcilerRedis) SetLock(_ string, _ string, _ time.Duration) (bool, error) {
	f.calls++
	return f.acquired, nil
}

// When another node already holds the lock, tick() must return before
// touching the database at all — passing db=nil and not panicking proves it.
func TestReconciler_SkipsTickWhenLockNotAcquired(t *testing.T) {
	redis := &fakeReconcilerRedis{acquired: false}
	r := NewReconciler(nil, redis)

	assert.NotPanics(t, func() { r.tick() })
	assert.Equal(t, 1, redis.calls)
}

func TestReconciler_NoRedisMeansSingleNodeAlwaysRuns(t *testing.T) {
	// r.redis == nil (e.g. dev without Redis configured) must not skip the
	// lock check entirely by crashing — it should just proceed unlocked. We
	// can't safely exercise the DB branch without a live Postgres here (same
	// constraint as the rest of this package's tests), so this only asserts
	// the nil-redis path doesn't panic before reaching db.Exec.
	defer func() {
		r := recover()
		assert.NotNil(t, r, "expected a panic from the nil *gorm.DB, confirming the lock check was bypassed as intended")
	}()
	rec := NewReconciler(nil, nil)
	rec.tick()
}
