package plugins

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"gorm.io/gorm"
)

// groupCampaignMaterializeBatchLimit bounds how many due campaigns one
// materialize tick processes -- the cron's own context is bounded to its
// own interval (cronScheduler.runOnce), so a very large backlog must not
// try to do everything in one tick; the next tick picks up what's left.
const groupCampaignMaterializeBatchLimit = 200

// materializeDueCampaigns is the "group-campaigns-materialize" cron body
// (registered by registerGroupCampaignCrons, groups_campaign_cron.go).
// Only ever touches campaigns with ScheduleMode once/recurring that
// reached their NextOccurrenceAt -- immediate campaigns are materialized
// inline by the /start handler (issue #597), never by this cron.
func materializeDueCampaigns(ctx context.Context, db *gorm.DB) {
	var due []models.GroupCampaign
	if err := db.WithContext(ctx).
		Where(`status = ? AND "nextOccurrenceAt" IS NOT NULL AND "nextOccurrenceAt" <= ?`,
			models.GroupCampaignStatusScheduled, time.Now()).
		Limit(groupCampaignMaterializeBatchLimit).
		Find(&due).Error; err != nil {
		log.Printf("[groups] campaign materialize: falha ao listar campanhas vencidas: %v", err)
		return
	}

	for _, c := range due {
		if ctx.Err() != nil {
			log.Printf("[groups] campaign materialize: contexto expirado, encerrando tick cedo")
			return
		}
		materializeOneCampaign(db, c)
	}
}

// materializeOneCampaign handles one due campaign's occurrence inside a
// single transaction -- either a full run (targets + sends) or a canceled
// "skipped" run when the previous occurrence is still in flight. Either
// way it always recomputes and persists NextOccurrenceAt so a skip never
// wedges the campaign on the same occurrence forever.
func materializeOneCampaign(db *gorm.DB, c models.GroupCampaign) {
	occurrenceFor := *c.NextOccurrenceAt
	occurrenceKey := occurrenceFor.UTC().Format(time.RFC3339)

	err := db.Transaction(func(tx *gorm.DB) error {
		var stillRunning int64
		if err := tx.Model(&models.GroupCampaignRun{}).
			Where(`"campaignId" = ? AND status = ?`, c.ID, models.GroupCampaignRunStatusRunning).
			Count(&stillRunning).Error; err != nil {
			return err
		}

		var sequence int64
		if err := tx.Model(&models.GroupCampaignRun{}).
			Where(`"campaignId" = ?`, c.ID).
			Count(&sequence).Error; err != nil {
			return err
		}

		if stillRunning > 0 {
			skipped := models.GroupCampaignRun{
				TenantID:      c.TenantID,
				CampaignID:    c.ID,
				OccurrenceKey: occurrenceKey,
				Status:        models.GroupCampaignRunStatusCanceled,
				SkipReason:    "ocorrência anterior ainda em execução",
				ScheduledFor:  occurrenceFor,
				Sequence:      int(sequence),
			}
			if err := tx.Create(&skipped).Error; err != nil && !isUniqueViolation(err) {
				return err
			}
		} else {
			if _, err := materializeRun(tx, c, occurrenceFor, occurrenceKey, int(sequence)); err != nil {
				if isUniqueViolation(err) {
					// Outro nó já materializou esta ocorrência (mesma
					// campaignId+occurrenceKey) -- engole, não é erro.
				} else {
					return err
				}
			}
		}

		next := computeNextOccurrence(c, occurrenceFor)
		updates := map[string]interface{}{
			"nextOccurrenceAt": next,
			"status":           models.GroupCampaignStatusRunning,
			"updatedAt":        time.Now(),
		}
		return tx.Model(&models.GroupCampaign{}).
			Where(`id = ?`, c.ID).
			Updates(updates).Error
	})
	if err != nil {
		log.Printf("[groups] campaign materialize: falha na campanha %d (tenant %s): %v", c.ID, c.TenantID, err)
	}
}

// variantSnapshotEntry is the JSON shape frozen into
// GroupCampaignRun.VariantsSnapshot -- just enough for sendOne (issue #595)
// to build the outbound message without a second query against
// group_campaign_variants (which may have changed since this run started).
type variantSnapshotEntry struct {
	ID      int    `json:"id"`
	Type    string `json:"type"`
	Message string `json:"message"`
	Content string `json:"content"`
}

// materializeRun creates ONE run + its sends for a campaign occurrence --
// shared by the materialize cron (once/recurring) and, in a later issue,
// the /start handler's inline path for scheduleMode=immediate. Returns the
// created run, or a duplicate-key error (via isUniqueViolation) when
// another node already materialized this exact (campaignId, occurrenceKey)
// -- callers must check that, never treat it as a generic failure.
func materializeRun(tx *gorm.DB, c models.GroupCampaign, scheduledFor time.Time, occurrenceKey string, sequence int) (*models.GroupCampaignRun, error) {
	var targets []models.GroupCampaignTarget
	if err := tx.Where(`"campaignId" = ?`, c.ID).Find(&targets).Error; err != nil {
		return nil, err
	}

	var variants []models.GroupCampaignVariant
	if err := tx.Where(`"campaignId" = ? AND active = ?`, c.ID, true).Order("position").Find(&variants).Error; err != nil {
		return nil, err
	}

	if len(targets) > campaignMaxTargetsPerRun {
		targets = targets[:campaignMaxTargetsPerRun]
	}

	snapshotEntries := make([]variantSnapshotEntry, 0, len(variants))
	for _, v := range variants {
		snapshotEntries = append(snapshotEntries, variantSnapshotEntry{ID: v.ID, Type: v.Type, Message: v.Message, Content: v.Content})
	}
	snapshotJSON, err := json.Marshal(snapshotEntries)
	if err != nil {
		return nil, err
	}

	run := models.GroupCampaignRun{
		TenantID:         c.TenantID,
		CampaignID:       c.ID,
		OccurrenceKey:    occurrenceKey,
		Status:           models.GroupCampaignRunStatusRunning,
		ScheduledFor:     scheduledFor,
		StartedAt:        timePtr(time.Now()),
		VariantsSnapshot: snapshotJSON,
		Sequence:         sequence,
	}
	if err := tx.Create(&run).Error; err != nil {
		return nil, err // duplicate occurrenceKey surfaces here -- caller checks isUniqueViolation
	}

	if len(targets) == 0 || len(variants) == 0 {
		// Nada pra materializar (campanha sem alvo/variante ativa no
		// momento da ocorrência) -- a run existe pra registro, mas fecha
		// já como completed com zero sends, nunca fica presa "running".
		return &run, tx.Model(&run).Updates(map[string]interface{}{
			"status":     models.GroupCampaignRunStatusCompleted,
			"finishedAt": time.Now(),
		}).Error
	}

	planned := buildSendSchedule(scheduledFor, targets, len(variants), sequence, pacing{
		IntervalSeconds:   c.IntervalSeconds,
		JitterSeconds:     c.JitterSeconds,
		BatchSize:         c.BatchSize,
		BatchPauseSeconds: c.BatchPauseSeconds,
	}, rand.New(rand.NewSource(time.Now().UnixNano())))

	sends := make([]models.GroupCampaignSend, 0, len(planned))
	for _, p := range planned {
		variant := variants[p.VariantIndex]
		// pluginWAMessageID (manager.go) -- mesmo gerador que o resto do
		// pacote plugins usa pra id de mensagem WhatsApp (3EB0+hex, cripto-
		// aleatório). EnvID==MessageID por construção: sendOne (issue #595)
		// entrega esse valor ao engine como o id da mensagem, o que faz o
		// id do WhatsApp bater com a chave da nossa linha -- é isso que
		// habilita a correlação de resposta citada (issue #598) sem uma
		// segunda tabela de lookup.
		envID := pluginWAMessageID()
		sends = append(sends, models.GroupCampaignSend{
			TenantID:     c.TenantID,
			CampaignID:   c.ID,
			RunID:        run.ID,
			WhatsappID:   c.WhatsappID,
			JID:          p.JID,
			Subject:      p.Subject,
			VariantID:    &variant.ID,
			VariantIndex: p.VariantIndex,
			Status:       models.GroupCampaignSendStatusPending,
			ScheduledAt:  p.ScheduledAt,
			EnvID:        envID,
		})
	}
	if err := tx.CreateInBatches(sends, 200).Error; err != nil {
		return nil, err
	}

	if err := tx.Model(&run).Update("totalSends", len(sends)).Error; err != nil {
		return nil, err
	}
	return &run, nil
}

func timePtr(t time.Time) *time.Time { return &t }
