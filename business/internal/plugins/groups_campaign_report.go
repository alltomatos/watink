package plugins

import (
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const groupCampaignReportPageSize = 20

// campaignReportPage mirrors the page/pageSize/count shape MessageController
// already uses (internal/controllers/message.go) -- paginates from the
// first request, never returns everything at once (issue #597 acceptance
// criteria).
func campaignReportPage(c *gin.Context) (pageNumber, offset int) {
	pageNumber = 1
	if p, err := strconv.Atoi(c.Query("pageNumber")); err == nil && p > 0 {
		pageNumber = p
	}
	return pageNumber, (pageNumber - 1) * groupCampaignReportPageSize
}

// handleListGroupCampaignRuns lists the campaign's occurrences, newest
// first, paginated.
func handleListGroupCampaignRuns() gin.HandlerFunc {
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

		pageNumber, offset := campaignReportPage(c)
		var runs []models.GroupCampaignRun
		if err := db.Session(&gorm.Session{NewDB: true}).Where(`"campaignId" = ?`, campaign.ID).
			Order(`"scheduledFor" DESC`).
			Limit(groupCampaignReportPageSize).Offset(offset).
			Find(&runs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load runs"})
			return
		}
		var count int64
		db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignRun{}).Where(`"campaignId" = ?`, campaign.ID).Count(&count)

		c.JSON(http.StatusOK, gin.H{"runs": runs, "count": count, "pageNumber": pageNumber})
	}
}

// handleListGroupCampaignSends lists one run's per-group deliveries,
// paginated -- runID is scoped to campaignID (never trust a runId path
// param alone, another campaign's run must 404 here too).
func handleListGroupCampaignSends() gin.HandlerFunc {
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
		runID, err := strconv.Atoi(c.Param("runId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "runId inválido"})
			return
		}
		var run models.GroupCampaignRun
		if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "campaignId" = ?`, runID, campaign.ID).First(&run).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "run não encontrada"})
			return
		}

		pageNumber, offset := campaignReportPage(c)
		var sends []models.GroupCampaignSend
		if err := db.Session(&gorm.Session{NewDB: true}).Where(`"runId" = ?`, run.ID).
			Order(`"scheduledAt" ASC`).
			Limit(groupCampaignReportPageSize).Offset(offset).
			Find(&sends).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sends"})
			return
		}
		var count int64
		db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignSend{}).Where(`"runId" = ?`, run.ID).Count(&count)

		c.JSON(http.StatusOK, gin.H{"sends": sends, "count": count, "pageNumber": pageNumber})
	}
}

// handleListGroupCampaignReplies lists captured replies, paginated, with
// quoted/window counts reported SEPARATELY -- ADR 0016/0030: a weak
// window-based signal must never be blended into the same number as a
// strong quoted match (see models.GroupCampaignReply doc).
func handleListGroupCampaignReplies() gin.HandlerFunc {
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

		pageNumber, offset := campaignReportPage(c)
		var replies []models.GroupCampaignReply
		if err := db.Session(&gorm.Session{NewDB: true}).Where(`"campaignId" = ?`, campaign.ID).
			Order(`"repliedAt" DESC`).
			Limit(groupCampaignReportPageSize).Offset(offset).
			Find(&replies).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load replies"})
			return
		}

		var quotedCount, windowCount int64
		db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignReply{}).
			Where(`"campaignId" = ? AND "matchType" = ?`, campaign.ID, models.GroupCampaignReplyMatchQuoted).
			Count(&quotedCount)
		db.Session(&gorm.Session{NewDB: true}).Model(&models.GroupCampaignReply{}).
			Where(`"campaignId" = ? AND "matchType" = ?`, campaign.ID, models.GroupCampaignReplyMatchWindow).
			Count(&windowCount)

		c.JSON(http.StatusOK, gin.H{
			"replies":     replies,
			"pageNumber":  pageNumber,
			"quotedCount": quotedCount,
			"windowCount": windowCount,
		})
	}
}
