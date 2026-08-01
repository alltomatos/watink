package plugins

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
)

// cronScheduler implements the periodic-job half of sdk.WatinkCoreScheduler
// (ADR 0027). Each registered job runs on its own ticker; when redis is
// configured, a SetNX-style leader-lock (same primitive the FlowBuilder
// scheduler uses) ensures only one node in a multi-node deployment executes a
// given job name per tick. Without redis (e.g. NewPluginManager in tests),
// jobs still run — single-node semantics, no lock.
type cronScheduler struct {
	mu    sync.Mutex
	names map[string]bool
	redis domain.RedisService
}

func newCronScheduler(redis domain.RedisService) *cronScheduler {
	return &cronScheduler{names: make(map[string]bool), redis: redis}
}

func (s *cronScheduler) register(name string, interval time.Duration, fn func(ctx context.Context) error) error {
	if name == "" {
		return fmt.Errorf("cronScheduler: job name cannot be empty")
	}
	if interval <= 0 {
		return fmt.Errorf("cronScheduler: interval must be positive")
	}
	s.mu.Lock()
	if s.names[name] {
		s.mu.Unlock()
		return fmt.Errorf("cronScheduler: job %q already registered", name)
	}
	s.names[name] = true
	s.mu.Unlock()

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			s.runOnce(name, interval, fn)
		}
	}()
	return nil
}

// runOnce guards a single tick with the leader-lock (TTL just under the tick
// interval, so a missed DelLock never wedges the job past its own next tick)
// and runs fn with a context bounded by the tick interval.
func (s *cronScheduler) runOnce(name string, interval time.Duration, fn func(ctx context.Context) error) {
	lockKey := "scheduler:cron:" + name
	if s.redis != nil {
		ttl := interval - time.Second
		if ttl <= 0 {
			ttl = interval
		}
		acquired, err := s.redis.SetLock(lockKey, "1", ttl)
		if err != nil {
			log.Printf("[cronScheduler] lock error for job %q: %v — skipping this tick", name, err)
			return
		}
		if !acquired {
			return // another node already owns this tick
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), interval)
	defer cancel()
	if err := fn(ctx); err != nil {
		log.Printf("[cronScheduler] job %q failed: %v", name, err)
	}
}

// domainEventBus implements the Subscribe half of sdk.WatinkCoreScheduler —
// a minimal in-process pub/sub for internal domain events (e.g. Pipeline
// stage changes, see docs/agents/assistants.md § Eventos de Pipeline).
// Delivery is best-effort, no persistence/replay; publishers live in core
// code (e.g. DealController) and call PublishDomainEvent directly — they are
// not plugins, so they don't go through the sdk.WatinkCore interface.
type domainEventBus struct {
	mu   sync.RWMutex
	subs map[string][]func(ctx context.Context, payload map[string]any)
}

var eventBus = &domainEventBus{subs: make(map[string][]func(ctx context.Context, payload map[string]any))}

func (b *domainEventBus) subscribe(eventType string, fn func(ctx context.Context, payload map[string]any)) error {
	if eventType == "" {
		return fmt.Errorf("domainEventBus: eventType cannot be empty")
	}
	if fn == nil {
		return fmt.Errorf("domainEventBus: fn cannot be nil")
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subs[eventType] = append(b.subs[eventType], fn)
	return nil
}

func (b *domainEventBus) publish(ctx context.Context, eventType string, payload map[string]any) {
	b.mu.RLock()
	handlers := append([]func(ctx context.Context, payload map[string]any){}, b.subs[eventType]...)
	b.mu.RUnlock()
	for _, fn := range handlers {
		fn(ctx, payload)
	}
}

// PublishDomainEvent is the entry point for core code (outside the plugins
// package, e.g. controllers.DealController) to publish an internal domain
// event to any plugin subscribed via sdk.WatinkCoreScheduler.Subscribe.
func PublishDomainEvent(ctx context.Context, eventType string, payload map[string]any) {
	eventBus.publish(ctx, eventType, payload)
}
