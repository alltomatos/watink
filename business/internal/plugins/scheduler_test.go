package plugins

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// fakeSchedulerRedis is a local mock implementing the full domain.RedisService
// interface, mirroring the pattern already used by
// flow/whatsapp_adapter_test.go's fakeRedis — only SetLock/DelLock matter for
// cronScheduler, the rest are no-ops to satisfy the interface.
type fakeSchedulerRedis struct {
	mu      sync.Mutex
	locked  map[string]bool
	failAll bool
}

func newFakeSchedulerRedis() *fakeSchedulerRedis {
	return &fakeSchedulerRedis{locked: make(map[string]bool)}
}

func (r *fakeSchedulerRedis) SetLock(key, _ string, _ time.Duration) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.failAll {
		return false, nil
	}
	if r.locked[key] {
		return false, nil
	}
	r.locked[key] = true
	return true, nil
}

func (r *fakeSchedulerRedis) DelLock(key string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.locked, key)
	return nil
}

func (r *fakeSchedulerRedis) Subscribe(context.Context, string) *redis.PubSub    { return nil }
func (r *fakeSchedulerRedis) Publish(context.Context, string, interface{}) error { return nil }
func (r *fakeSchedulerRedis) Ping(context.Context) error                         { return nil }
func (r *fakeSchedulerRedis) Get(context.Context, string) (string, error)        { return "", nil }

func TestCronScheduler_RejectsDuplicateName(t *testing.T) {
	s := newCronScheduler(nil)
	if err := s.register("job-a", time.Hour, func(ctx context.Context) error { return nil }); err != nil {
		t.Fatalf("first register should succeed: %v", err)
	}
	if err := s.register("job-a", time.Hour, func(ctx context.Context) error { return nil }); err == nil {
		t.Fatal("expected error registering the same job name twice")
	}
}

func TestCronScheduler_RunOnce_WithoutRedis_AlwaysRuns(t *testing.T) {
	s := newCronScheduler(nil)
	var calls int32
	s.runOnce("no-redis-job", time.Second, func(ctx context.Context) error {
		atomic.AddInt32(&calls, 1)
		return nil
	})
	s.runOnce("no-redis-job", time.Second, func(ctx context.Context) error {
		atomic.AddInt32(&calls, 1)
		return nil
	})
	if got := atomic.LoadInt32(&calls); got != 2 {
		t.Fatalf("expected 2 calls without redis (no lock), got %d", got)
	}
}

func TestCronScheduler_RunOnce_WithRedis_LeaderLockPreventsDoubleRun(t *testing.T) {
	redis := newFakeSchedulerRedis()
	s := newCronScheduler(redis)
	var calls int32
	fn := func(ctx context.Context) error {
		atomic.AddInt32(&calls, 1)
		return nil
	}
	// Simulate two nodes racing for the same tick — same job name, same
	// (unreleased) lock key. Second call must be skipped.
	s.runOnce("idle-sweep", 5*time.Minute, fn)
	s.runOnce("idle-sweep", 5*time.Minute, fn)
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Fatalf("expected exactly 1 call under leader-lock, got %d", got)
	}
}

func TestCronScheduler_RunOnce_LockErrorSkipsRun(t *testing.T) {
	redis := newFakeSchedulerRedis()
	redis.failAll = true
	s := newCronScheduler(redis)
	var calls int32
	s.runOnce("job", time.Minute, func(ctx context.Context) error {
		atomic.AddInt32(&calls, 1)
		return nil
	})
	if got := atomic.LoadInt32(&calls); got != 0 {
		t.Fatalf("expected 0 calls when lock is never acquired, got %d", got)
	}
}

func TestDomainEventBus_DeliversToSubscriber(t *testing.T) {
	b := &domainEventBus{subs: make(map[string][]func(ctx context.Context, payload map[string]any))}
	received := make(chan map[string]any, 1)
	if err := b.subscribe("pipeline.deal.stage_changed", func(ctx context.Context, payload map[string]any) {
		received <- payload
	}); err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}
	b.publish(context.Background(), "pipeline.deal.stage_changed", map[string]any{"dealId": 42})

	select {
	case p := <-received:
		if p["dealId"] != 42 {
			t.Fatalf("unexpected payload: %v", p)
		}
	case <-time.After(time.Second):
		t.Fatal("subscriber did not receive the published event")
	}
}

func TestDomainEventBus_PublishWithNoSubscribersIsNoop(t *testing.T) {
	b := &domainEventBus{subs: make(map[string][]func(ctx context.Context, payload map[string]any))}
	// Must not panic or block.
	b.publish(context.Background(), "nobody.listens", map[string]any{})
}

func TestDomainEventBus_RejectsEmptyEventType(t *testing.T) {
	b := &domainEventBus{subs: make(map[string][]func(ctx context.Context, payload map[string]any))}
	if err := b.subscribe("", func(ctx context.Context, payload map[string]any) {}); err == nil {
		t.Fatal("expected error for empty eventType")
	}
}

func TestCoreImpl_RegisterCron_FailsClosedWithoutScheduler(t *testing.T) {
	c := &coreImpl{}
	err := c.RegisterCron("job", time.Minute, func(ctx context.Context) error { return nil })
	if err == nil {
		t.Fatal("expected RegisterCron to fail closed when scheduler is nil")
	}
}
