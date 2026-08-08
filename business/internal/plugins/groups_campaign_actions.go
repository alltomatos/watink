package plugins

import (
	"net/http"
	"strconv"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ── /start ───────────────────────────────────────────────────────────────

// handleStartGroupCampaign is the ONLY ignition for a campaign -- POST/PUT
// (groups_campaign_handler.go) always leave it in draft. Rejects with a
// SPECIFIC message (never a generic 500) for each of the 4 preconditions
// so the UI can tell the user exactly what to fix.
func handleStartGroupCampaign() gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, groupCampaignScope)
		if !ok {
			return
		}
		campaign, err := loadGroupCampaign(db, tenantID, c.Param("campaignId"))
		if err != nil {
			respondGroupCampaignLoadError(c, err)
			return
		}

		if campaign.RiskAckAt == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "é necessário aceitar o aviso de risco antes de disparar a campanha"})
			return
		}

		// Cada query abaixo usa Session(NewDB:true) -- reusar db (já scoped por
		// auth.GetScoped) em múltiplas queries sequenciais acumula as
		// condições Where de uma na próxima (CLAUDE.md, débito conhecido em
		// outros módulos), fazendo a 2ª/3ª query casarem 0 linhas
		// silenciosamente.
		var targetCount int64
		db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignTarget{}).
			Where(`"campaignId" = ?`, campaign.ID).Count(&targetCount)
		if targetCount == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "selecione ao menos um grupo antes de disparar a campanha"})
			return
		}

		var activeVariants int64
		db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignVariant{}).
			Where(`"campaignId" = ? AND active = ?`, campaign.ID, true).Count(&activeVariants)
		if activeVariants == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "a campanha precisa de ao menos uma variante de mensagem ativa"})
			return
		}

		var whatsapp models.Whatsapp
		if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ?`, campaign.WhatsappID).First(&whatsapp).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "conexão da campanha não encontrada"})
			return
		}
		if whatsapp.Status != "CONNECTED" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "a conexão da campanha está desconectada"})
			return
		}

		writeDB := db.Session(&gorm.Session{NewDB: true})
		if campaign.ScheduleMode == models.GroupCampaignScheduleImmediate {
			if err := startImmediateGroupCampaign(writeDB, campaign); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao iniciar campanha"})
				return
			}
		} else {
			next := computeNextOccurrence(campaign, time.Now())
			if next == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "agendamento inválido — confira a data/recorrência configurada"})
				return
			}
			if err := writeDB.Model(&models.GroupCampaign{}).Where(`id = ?`, campaign.ID).Updates(map[string]interface{}{
				"status":           models.GroupCampaignStatusScheduled,
				"nextOccurrenceAt": next,
				"updatedAt":        time.Now(),
			}).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao agendar campanha"})
				return
			}
		}

		campaign, _ = loadGroupCampaign(db, tenantID, strconv.Itoa(campaign.ID))
		c.JSON(http.StatusOK, groupCampaignWithChildren(db, campaign, false))
	}
}

// startImmediateGroupCampaign materializes the single occurrence INLINE
// (same materializeRun the cron uses, issue #594) and flips the campaign to
// running -- an immediate campaign never waits for the materialize tick.
func startImmediateGroupCampaign(db *gorm.DB, campaign models.GroupCampaign) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var sequence int64
		if err := tx.Model(&models.GroupCampaignRun{}).
			Where(`"campaignId" = ?`, campaign.ID).Count(&sequence).Error; err != nil {
			return err
		}
		now := time.Now()
		occurrenceKey := "immediate-" + now.UTC().Format(time.RFC3339Nano)
		if _, err := materializeRun(tx, campaign, now, occurrenceKey, int(sequence)); err != nil {
			return err
		}
		return tx.Model(&models.GroupCampaign{}).Where(`id = ?`, campaign.ID).Updates(map[string]interface{}{
			"status":           models.GroupCampaignStatusRunning,
			"nextOccurrenceAt": nil,
			"updatedAt":        now,
		}).Error
	})
}

// ── /test ────────────────────────────────────────────────────────────────

type testGroupCampaignRequest struct {
	JID     string `json:"jid" binding:"required"`
	Subject string `json:"subject"`
}

// handleTestGroupCampaign sends the first active variant to a single ad-hoc
// group WITHOUT creating a GroupCampaignTarget/GroupCampaignRun/
// GroupCampaignSend -- a direct, synchronous dispatch via
// dispatchCampaignMessage (the same core sendOne uses), so it exercises the
// real message shape without touching the schedule at all.
func handleTestGroupCampaign(core sdk.WatinkCore, adapter *flow.WhatsAppAdapter) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, groupCampaignScope)
		if !ok {
			return
		}
		campaign, err := loadGroupCampaign(db, tenantID, c.Param("campaignId"))
		if err != nil {
			respondGroupCampaignLoadError(c, err)
			return
		}
		var req testGroupCampaignRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}

		var variant models.GroupCampaignVariant
		if err := db.Where(`"campaignId" = ? AND active = ?`, campaign.ID, true).
			Order("position").First(&variant).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "a campanha precisa de ao menos uma variante de mensagem ativa"})
			return
		}

		envID := pluginWAMessageID()
		subject := req.Subject
		if subject == "" {
			subject = "Grupo de teste"
		}
		ticket, effectiveID, err := dispatchCampaignMessage(c.Request.Context(), db.Session(&gorm.Session{NewDB: true}), core, adapter, dispatchCampaignMessageParams{
			TenantID:     tenantID,
			WhatsappID:   campaign.WhatsappID,
			JID:          req.JID,
			Subject:      subject,
			CampaignName: campaign.Name,
			EnvID:        envID,
			VariantType:  variant.Type,
			Message:      variant.Message,
			Content:      variant.Content,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao enviar mensagem de teste: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ticketId": ticket.ID, "messageId": effectiveID})
	}
}

// ── /pause, /resume, /cancel ────────────────────────────────────────────

type pauseGroupCampaignRequest struct {
	PauseReason string `json:"pauseReason"`
}

func handlePauseGroupCampaign() gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, groupCampaignScope)
		if !ok {
			return
		}
		campaign, err := loadGroupCampaign(db, tenantID, c.Param("campaignId"))
		if err != nil {
			respondGroupCampaignLoadError(c, err)
			return
		}
		if campaign.Status != models.GroupCampaignStatusRunning {
			c.JSON(http.StatusBadRequest, gin.H{"error": "só é possível pausar uma campanha em execução"})
			return
		}
		var req pauseGroupCampaignRequest
		_ = c.ShouldBindJSON(&req) // body opcional

		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaign{}).
			Where(`id = ?`, campaign.ID).
			Updates(map[string]interface{}{
				"status":      models.GroupCampaignStatusPaused,
				"pauseReason": req.PauseReason,
				"updatedAt":   time.Now(),
			}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao pausar campanha"})
			return
		}
		campaign, _ = loadGroupCampaign(db, tenantID, strconv.Itoa(campaign.ID))
		c.JSON(http.StatusOK, groupCampaignWithChildren(db, campaign, false))
	}
}

// handleResumeGroupCampaign restores the status the pause interrupted: if
// there's still a run "running" for this campaign (the common case -- a
// mid-flight run paused, e.g. by the circuit breaker), the drain (issue
// #594, now also filtering by campaign status -- see pickDueSends) simply
// resumes draining once status flips back to "running". If the run already
// closed and a future occurrence is pending (recurring), it goes back to
// "scheduled" for the materialize cron to pick up.
func handleResumeGroupCampaign() gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, groupCampaignScope)
		if !ok {
			return
		}
		campaign, err := loadGroupCampaign(db, tenantID, c.Param("campaignId"))
		if err != nil {
			respondGroupCampaignLoadError(c, err)
			return
		}
		if campaign.Status != models.GroupCampaignStatusPaused {
			c.JSON(http.StatusBadRequest, gin.H{"error": "só é possível retomar uma campanha pausada"})
			return
		}

		var openRuns int64
		db.Model(&models.GroupCampaignRun{}).
			Where(`"campaignId" = ? AND status = ?`, campaign.ID, models.GroupCampaignRunStatusRunning).
			Count(&openRuns)

		newStatus := models.GroupCampaignStatusRunning
		if openRuns == 0 && campaign.NextOccurrenceAt != nil {
			newStatus = models.GroupCampaignStatusScheduled
		}

		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaign{}).
			Where(`id = ?`, campaign.ID).
			Updates(map[string]interface{}{
				"status":      newStatus,
				"pauseReason": "",
				"updatedAt":   time.Now(),
			}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao retomar campanha"})
			return
		}
		campaign, _ = loadGroupCampaign(db, tenantID, strconv.Itoa(campaign.ID))
		c.JSON(http.StatusOK, groupCampaignWithChildren(db, campaign, false))
	}
}

// handleCancelGroupCampaign cancels pending/in-claim sends (never sends
// already sent/failed -- those already ran) and any run still marked
// running, so nothing is left dangling in an "open" state that
// closeFinishedRuns/closeFinishedCampaigns would otherwise never close.
func handleCancelGroupCampaign() gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, groupCampaignScope)
		if !ok {
			return
		}
		campaign, err := loadGroupCampaign(db, tenantID, c.Param("campaignId"))
		if err != nil {
			respondGroupCampaignLoadError(c, err)
			return
		}

		// Session(NewDB:true) FRESH PER QUERY -- reusing the same session
		// object across these 3 sequential Updates (different tables) is the
		// same accumulate-conditions footgun as reusing the scoped db
		// directly (CLAUDE.md invariant), just one level removed.
		now := time.Now()

		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignSend{}).
			Where(`"campaignId" = ? AND status IN ?`, campaign.ID,
				[]string{models.GroupCampaignSendStatusPending, models.GroupCampaignSendStatusSending}).
			Updates(map[string]interface{}{"status": models.GroupCampaignSendStatusCanceled, "updatedAt": now}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao cancelar envios pendentes"})
			return
		}
		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignRun{}).
			Where(`"campaignId" = ? AND status = ?`, campaign.ID, models.GroupCampaignRunStatusRunning).
			Updates(map[string]interface{}{"status": models.GroupCampaignRunStatusCanceled, "finishedAt": now, "updatedAt": now}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao cancelar ocorrência em execução"})
			return
		}
		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaign{}).Where(`id = ?`, campaign.ID).Updates(map[string]interface{}{
			"status":           models.GroupCampaignStatusCanceled,
			"nextOccurrenceAt": nil,
			"updatedAt":        now,
		}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao cancelar campanha"})
			return
		}

		campaign, _ = loadGroupCampaign(db, tenantID, strconv.Itoa(campaign.ID))
		c.JSON(http.StatusOK, groupCampaignWithChildren(db, campaign, false))
	}
}
