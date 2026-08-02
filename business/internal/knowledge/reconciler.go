package knowledge

import (
	"context"
	"log"
	"time"

	"gorm.io/gorm"
)

// lockService is the narrow slice of domain.RedisService the reconciler
// needs — a local interface (rather than domain.RedisService directly) so
// tests don't have to stub the full Redis surface (Subscribe, Get, ...).
// domain.RedisServiceImpl satisfies this automatically.
type lockService interface {
	SetLock(key string, value string, expiration time.Duration) (bool, error)
}

const (
	reconcileInterval = 5 * time.Minute
	reconcileStuckTTL = 15 * time.Minute
	reconcileLockKey  = "scheduler:cron:knowledge-reconciler"
)

// Reconciler periodically sweeps KnowledgeBaseSources stuck in "pending" or
// "processing" past reconcileStuckTTL and marks them "error" — the fix for
// sources that stay "Aguardando"/"Processando" forever when a job is lost
// (broker down at publish time, worker crash mid-job, message dropped because
// no queue existed yet). Mirrors the leader-lock pattern used by
// internal/plugins/scheduler.go's cron jobs (SetNX with a TTL under the tick
// interval) so only one node acts per tick in a multi-instance deployment.
type Reconciler struct {
	db    *gorm.DB
	redis lockService
}

func NewReconciler(db *gorm.DB, redis lockService) *Reconciler {
	return &Reconciler{db: db, redis: redis}
}

// Start runs the reconcile loop until ctx is cancelled. Call in its own
// goroutine at boot.
func (r *Reconciler) Start(ctx context.Context) {
	ticker := time.NewTicker(reconcileInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.tick()
		}
	}
}

func (r *Reconciler) tick() {
	if r.redis != nil {
		acquired, err := r.redis.SetLock(reconcileLockKey, "1", reconcileInterval-time.Second)
		if err != nil {
			log.Printf("[knowledge.Reconciler] lock error: %v — skipping this tick", err)
			return
		}
		if !acquired {
			return // another node owns this tick
		}
	}

	res := r.db.Exec(
		`UPDATE "KnowledgeBaseSources"
		 SET status = 'error', "lastError" = 'timeout: ingestão não concluída a tempo'
		 WHERE status IN ('pending', 'processing') AND "updatedAt" < ?`,
		time.Now().Add(-reconcileStuckTTL),
	)
	if res.Error != nil {
		log.Printf("[knowledge.Reconciler] sweep failed: %v", res.Error)
		return
	}
	if res.RowsAffected > 0 {
		log.Printf("[knowledge.Reconciler] marked %d stuck source(s) as error", res.RowsAffected)
	}
}
