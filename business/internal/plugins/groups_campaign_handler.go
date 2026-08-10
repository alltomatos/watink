package plugins

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// groupCampaignScope is the auth.GetScoped table label for this feature --
// distinct from "Whatsapps" (used by groups_watch.go) so a future Alcance
// rule specific to campaigns has somewhere to hook without touching
// unrelated routes.
const groupCampaignScope = "GroupCampaigns"

var errGroupCampaignInvalidID = errors.New("groups: campaignId inválido")

// ── request/response DTOs ───────────────────────────────────────────────

type groupCampaignVariantInput struct {
	Label   string `json:"label"`
	Type    string `json:"type" binding:"required"`
	Message string `json:"message"`
	Content string `json:"content"` // raw JSON string, stored as-is (jsonb column)
	Active  bool   `json:"active"`
}

type groupCampaignTargetInput struct {
	WhatsappID        int    `json:"whatsappId" binding:"required"`
	JID               string `json:"jid" binding:"required"`
	Subject           string `json:"subject"`
	IsConnectionAdmin bool   `json:"isConnectionAdmin"`
}

type upsertGroupCampaignRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	WhatsappID  int    `json:"whatsappId" binding:"required"`

	ScheduleMode    string     `json:"scheduleMode" binding:"omitempty,oneof=immediate once recurring"`
	StartAt         *time.Time `json:"startAt"`
	RecurrenceRule  string     `json:"recurrenceRule" binding:"omitempty,oneof=weekly monthly"`
	RecurrenceDays  string     `json:"recurrenceDays"`
	RecurrenceTime  string     `json:"recurrenceTime"`
	Timezone        string     `json:"timezone"`
	RecurrenceEndAt *time.Time `json:"recurrenceEndAt"`

	IntervalSeconds   int `json:"intervalSeconds"`
	JitterSeconds     int `json:"jitterSeconds"`
	BatchSize         int `json:"batchSize"`
	BatchPauseSeconds int `json:"batchPauseSeconds"`

	CaptureMode          string `json:"captureMode" binding:"omitempty,oneof=quoted quoted_and_window"`
	CaptureWindowMinutes int    `json:"captureWindowMinutes"`

	// RiskAckAt: required (ADR 0016/0030) -- the UI forces the checkbox, but
	// the backend never trusts the client alone (issue #596 acceptance
	// criteria: "Rejeita sem riskAckAt").
	RiskAckAt *time.Time `json:"riskAckAt" binding:"required"`

	Variants []groupCampaignVariantInput `json:"variants"`
	Targets  []groupCampaignTargetInput  `json:"targets"`
}

type groupCampaignResponse struct {
	models.GroupCampaign
	Variants       []models.GroupCampaignVariant `json:"variants"`
	Targets        []models.GroupCampaignTarget  `json:"targets"`
	PacingAdjusted bool                          `json:"pacingAdjusted"`
}

// ── handlers ─────────────────────────────────────────────────────────────

func handleListGroupCampaigns() gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, groupCampaignScope)
		if !ok {
			return
		}
		var campaigns []models.GroupCampaign
		if err := db.Session(&gorm.Session{NewDB: true}).
			Where(`"tenantId" = ?`, tenantID).
			Order(`"createdAt" DESC`).
			Find(&campaigns).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load campaigns"})
			return
		}
		c.JSON(http.StatusOK, campaigns)
	}
}

func handleGetGroupCampaign() gin.HandlerFunc {
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
		c.JSON(http.StatusOK, groupCampaignWithChildren(db, campaign, false))
	}
}

func handleCreateGroupCampaign() gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, groupCampaignScope)
		if !ok {
			return
		}
		var req upsertGroupCampaignRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}

		campaign := models.GroupCampaign{
			TenantID:    tenantID,
			Name:        req.Name,
			Description: req.Description,
			WhatsappID:  req.WhatsappID,
			// POST always creates in draft, even with scheduleMode=immediate --
			// /start is the only ignition (issue #597 acceptance criteria).
			Status: models.GroupCampaignStatusDraft,
		}
		applyGroupCampaignFields(&campaign, req)
		adjusted := clampPacing(&campaign)

		writeDB := db.Session(&gorm.Session{NewDB: true})
		if err := writeDB.Create(&campaign).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create campaign"})
			return
		}
		if err := replaceGroupCampaignVariants(writeDB, tenantID, campaign.ID, req.Variants); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save variants"})
			return
		}
		if err := replaceGroupCampaignTargets(writeDB, tenantID, campaign.ID, req.Targets); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save targets"})
			return
		}

		c.JSON(http.StatusCreated, groupCampaignWithChildren(writeDB, campaign, adjusted))
	}
}

func handleUpdateGroupCampaign() gin.HandlerFunc {
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
		var req upsertGroupCampaignRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}

		campaign.Name = req.Name
		campaign.Description = req.Description
		campaign.WhatsappID = req.WhatsappID
		applyGroupCampaignFields(&campaign, req)
		adjusted := clampPacing(&campaign)

		writeDB := db.Session(&gorm.Session{NewDB: true})
		if err := writeDB.Save(&campaign).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update campaign"})
			return
		}
		if err := replaceGroupCampaignVariants(writeDB, tenantID, campaign.ID, req.Variants); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save variants"})
			return
		}
		if err := replaceGroupCampaignTargets(writeDB, tenantID, campaign.ID, req.Targets); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save targets"})
			return
		}

		c.JSON(http.StatusOK, groupCampaignWithChildren(writeDB, campaign, adjusted))
	}
}

func handleDeleteGroupCampaign() gin.HandlerFunc {
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
		if err := db.Session(&gorm.Session{NewDB: true}).
			Where(`id = ? AND "tenantId" = ?`, campaign.ID, tenantID).
			Delete(&models.GroupCampaign{}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete campaign"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// ── shared helpers ───────────────────────────────────────────────────────

// applyGroupCampaignFields copies every field of upsertGroupCampaignRequest
// EXCEPT Name/Description/WhatsappID (set directly at each call site,
// update never touches Status) and Variants/Targets (own delete-then-insert
// helpers below).
func applyGroupCampaignFields(campaign *models.GroupCampaign, req upsertGroupCampaignRequest) {
	campaign.ScheduleMode = req.ScheduleMode
	if campaign.ScheduleMode == "" {
		campaign.ScheduleMode = models.GroupCampaignScheduleImmediate
	}
	campaign.StartAt = req.StartAt
	campaign.RecurrenceRule = req.RecurrenceRule
	campaign.RecurrenceDays = req.RecurrenceDays
	campaign.RecurrenceTime = req.RecurrenceTime
	campaign.Timezone = req.Timezone
	if campaign.Timezone == "" {
		campaign.Timezone = "America/Sao_Paulo"
	}
	campaign.RecurrenceEndAt = req.RecurrenceEndAt
	campaign.IntervalSeconds = req.IntervalSeconds
	campaign.JitterSeconds = req.JitterSeconds
	campaign.BatchSize = req.BatchSize
	campaign.BatchPauseSeconds = req.BatchPauseSeconds
	campaign.CaptureMode = req.CaptureMode
	if campaign.CaptureMode == "" {
		campaign.CaptureMode = models.GroupCampaignCaptureQuoted
	}
	campaign.CaptureWindowMinutes = req.CaptureWindowMinutes
	campaign.RiskAckAt = req.RiskAckAt
}

// loadGroupCampaign 404s (never 403) on a bad id or another tenant's
// campaign -- deliberately never leaking existence across tenants.
func loadGroupCampaign(db *gorm.DB, tenantID uuid.UUID, campaignIDRaw string) (models.GroupCampaign, error) {
	var campaign models.GroupCampaign
	id, err := strconv.Atoi(campaignIDRaw)
	if err != nil {
		return campaign, errGroupCampaignInvalidID
	}
	err = db.Session(&gorm.Session{NewDB: true}).
		Where(`id = ? AND "tenantId" = ?`, id, tenantID).
		First(&campaign).Error
	return campaign, err
}

func respondGroupCampaignLoadError(c *gin.Context, err error) {
	if errors.Is(err, errGroupCampaignInvalidID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "campaignId inválido"})
		return
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "campanha não encontrada"})
}

func replaceGroupCampaignVariants(db *gorm.DB, tenantID uuid.UUID, campaignID int, inputs []groupCampaignVariantInput) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where(`"campaignId" = ?`, campaignID).Delete(&models.GroupCampaignVariant{}).Error; err != nil {
			return err
		}
		for i, in := range inputs {
			content := in.Content
			if content == "" {
				content = "null"
			}
			v := models.GroupCampaignVariant{
				TenantID:   tenantID,
				CampaignID: campaignID,
				Position:   i,
				Label:      in.Label,
				Type:       in.Type,
				Message:    in.Message,
				Content:    content,
				Active:     in.Active,
			}
			if err := tx.Create(&v).Error; err != nil {
				return err
			}
			// GORM's `default:true` tag on Active makes Create SILENTLY
			// skip the column when the Go zero value (false) is set --
			// the DB default then overrides it back to true, even with
			// Select("*"). An explicit follow-up Update forces the exact
			// value regardless of the zero-value-skip heuristic.
			if err := tx.Model(&v).Update("active", in.Active).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// replaceGroupCampaignTargets is delete-then-insert, same pattern as
// saveGroupsToCache (groups_cache.go) -- avoids hand-rolling a diff against
// UNIQUE(campaignId, jid) on every edit.
func replaceGroupCampaignTargets(db *gorm.DB, tenantID uuid.UUID, campaignID int, inputs []groupCampaignTargetInput) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where(`"campaignId" = ?`, campaignID).Delete(&models.GroupCampaignTarget{}).Error; err != nil {
			return err
		}
		for _, in := range inputs {
			t := models.GroupCampaignTarget{
				TenantID:          tenantID,
				CampaignID:        campaignID,
				WhatsappID:        in.WhatsappID,
				JID:               in.JID,
				Subject:           in.Subject,
				IsConnectionAdmin: in.IsConnectionAdmin,
			}
			if err := tx.Create(&t).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func groupCampaignWithChildren(db *gorm.DB, campaign models.GroupCampaign, pacingAdjusted bool) groupCampaignResponse {
	var variants []models.GroupCampaignVariant
	db.Session(&gorm.Session{NewDB: true}).
		Where(`"campaignId" = ?`, campaign.ID).Order("position").Find(&variants)
	var targets []models.GroupCampaignTarget
	db.Session(&gorm.Session{NewDB: true}).
		Where(`"campaignId" = ?`, campaign.ID).Find(&targets)
	return groupCampaignResponse{
		GroupCampaign:  campaign,
		Variants:       variants,
		Targets:        targets,
		PacingAdjusted: pacingAdjusted,
	}
}
