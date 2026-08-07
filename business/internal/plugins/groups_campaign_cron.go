package plugins

import (
	"context"
	"log"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"gorm.io/gorm"
)

// Two independent crons, two independent leader-locks (cronScheduler.runOnce
// takes a lock per job name) -- a slow materialize tick must never starve
// the drain, and vice-versa.
const (
	groupCampaignMaterializeInterval = 60 * time.Second
	groupCampaignDrainInterval       = 30 * time.Second
)

// registerGroupCampaignCrons wires the campaign scheduler -- mirrors
// registerGroupsCacheSync (groups_cache_sync.go) exactly: type-assert
// sdk.WatinkCoreScheduler, log-and-return when the core doesn't support
// it, log (never panic OnActivate) if RegisterCron itself errors.
//
// adapter is nil-safe at the call site (sendOne fails closed on a nil
// adapter, see groups_campaign_send.go) -- OnActivate only builds a real
// one when Publisher/Redis were injected (groups.go), so an incomplete
// wiring degrades to "every send fails and retries" rather than a panic.
func registerGroupCampaignCrons(core sdk.WatinkCore, db *gorm.DB, adapter *flow.WhatsAppAdapter) {
	scheduler, ok := core.(sdk.WatinkCoreScheduler)
	if !ok {
		log.Printf("[groups] WatinkCoreScheduler não disponível — scheduler de campanhas desabilitado")
		return
	}

	if err := scheduler.RegisterCron("group-campaigns-materialize", groupCampaignMaterializeInterval, func(ctx context.Context) error {
		materializeDueCampaigns(ctx, db)
		return nil
	}); err != nil {
		log.Printf("[groups] RegisterCron(group-campaigns-materialize) falhou: %v", err)
	}

	if err := scheduler.RegisterCron("group-campaigns-drain", groupCampaignDrainInterval, func(ctx context.Context) error {
		drainDueSends(ctx, core, db, adapter)
		return nil
	}); err != nil {
		log.Printf("[groups] RegisterCron(group-campaigns-drain) falhou: %v", err)
	}
}
