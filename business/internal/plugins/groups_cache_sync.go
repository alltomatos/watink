package plugins

import (
	"context"
	"log"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Anti-ban batching: never call WhatsApp for every connection in the
// instance at once when the cron ticks. groupsCacheSyncBatchSize
// connections are synced, then the run pauses groupsCacheSyncBatchPause
// before the next batch -- spreads the ListGroups load over time instead
// of a thundering herd, same spirit as groups_throttle.go's per-connection
// rate limiter but across connections instead of within one.
const (
	groupsCacheSyncInterval  = 15 * time.Minute
	groupsCacheSyncBatchSize = 5
	groupsCacheSyncBatchGap  = 10 * time.Second
)

// registerGroupsCacheSync wires the periodic background refresh of
// GroupCache (groups_cache.go) via sdk.WatinkCoreScheduler.RegisterCron
// (ADR 0027, leader-locked so exactly one node runs it in a multi-node
// deployment). This is the ONLY path that fetches groups live from
// WhatsApp in bulk -- GET /groups (handleListGroups) only ever reads the
// cache, falling back to a one-time bootstrap fetch on first-ever access
// per connection.
func registerGroupsCacheSync(core sdk.WatinkCore, resolver domain.WhatsAppEngineResolver) {
	scheduler, ok := core.(sdk.WatinkCoreScheduler)
	if !ok {
		log.Printf("[groups] WatinkCoreScheduler não disponível — sync de cache de grupos desabilitado")
		return
	}
	db := core.GetDB()
	if err := scheduler.RegisterCron("groups-cache-sync", groupsCacheSyncInterval, func(ctx context.Context) error {
		syncAllGroupsCaches(ctx, db, resolver)
		return nil
	}); err != nil {
		log.Printf("[groups] RegisterCron groups-cache-sync falhou: %v", err)
	}
}

type groupsCacheSyncTarget struct {
	TenantID   uuid.UUID `gorm:"column:tenant_id"`
	WhatsappID int       `gorm:"column:whatsapp_id"`
}

// syncAllGroupsCaches walks every WhatsApp connection with the "groups"
// plugin allocated (PluginInstallations, not license -- a stale cache
// write for an expired license is harmless, degradeMode only gates reads)
// and status CONNECTED.
func syncAllGroupsCaches(ctx context.Context, db *gorm.DB, resolver domain.WhatsAppEngineResolver) {
	var targets []groupsCacheSyncTarget
	if err := db.WithContext(ctx).
		Table(`"PluginInstallations" AS pi`).
		Select(`pi."tenantId" AS tenant_id, w.id AS whatsapp_id`).
		Joins(`JOIN "Whatsapps" AS w ON w."tenantId" = pi."tenantId"`).
		Where(`pi."pluginId" = ? AND pi.active = ? AND w.status = ?`, "groups", true, "CONNECTED").
		Find(&targets).Error; err != nil {
		log.Printf("[groups] cache sync: falha ao listar conexões: %v", err)
		return
	}

	for i := 0; i < len(targets); i += groupsCacheSyncBatchSize {
		if ctx.Err() != nil {
			log.Printf("[groups] cache sync: contexto expirado, %d/%d conexões sincronizadas", i, len(targets))
			return
		}
		end := i + groupsCacheSyncBatchSize
		if end > len(targets) {
			end = len(targets)
		}
		for _, t := range targets[i:end] {
			syncOneGroupsCache(ctx, db, resolver, t)
		}
		if end < len(targets) {
			select {
			case <-time.After(groupsCacheSyncBatchGap):
			case <-ctx.Done():
				log.Printf("[groups] cache sync: contexto expirado durante pausa, %d/%d conexões sincronizadas", end, len(targets))
				return
			}
		}
	}
}

func syncOneGroupsCache(ctx context.Context, db *gorm.DB, resolver domain.WhatsAppEngineResolver, t groupsCacheSyncTarget) {
	var w models.Whatsapp
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`id = ? AND "tenantId" = ?`, t.WhatsappID, t.TenantID).
		First(&w).Error; err != nil {
		return
	}
	engine, err := resolver.EngineFor(w)
	if err != nil {
		return
	}
	groupEngine, ok := engine.(domain.GroupEngine)
	if !ok {
		return
	}
	groups, err := groupEngine.ListGroups(ctx, w)
	if err != nil {
		log.Printf("[groups] cache sync: ListGroups falhou (tenant %s, conexão %d): %v", t.TenantID, t.WhatsappID, err)
		return
	}
	if err := saveGroupsToCache(db, t.TenantID, w, groups); err != nil {
		log.Printf("[groups] cache sync: saveGroupsToCache falhou (tenant %s, conexão %d): %v", t.TenantID, t.WhatsappID, err)
		return
	}
	enrichContactsFromGroups(db, t.TenantID, groups)
}
