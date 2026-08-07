package plugins

import (
	"context"
	"log"
	"time"

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
// NOT yet called from GroupsPlugin.OnActivate as of this issue (#594) --
// the drain's sendOne is still a stub (groups_campaign_send.go); wiring
// this into OnActivate lands in issue #595 alongside the real send path,
// so the crons never run against a stub in production.
func registerGroupCampaignCrons(core sdk.WatinkCore, db *gorm.DB) {
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
		drainDueSends(ctx, core, db)
		return nil
	}); err != nil {
		log.Printf("[groups] RegisterCron(group-campaigns-drain) falhou: %v", err)
	}
}
