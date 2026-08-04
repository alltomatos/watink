package controllers

import (
	"net/http"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// checklistProgressDTO — "3/7 itens", exibido no card sem abrir a execução.
type checklistProgressDTO struct {
	Done  int `json:"done"`
	Total int `json:"total"`
}

// activityListItemDTO é a Activity + os campos computados no BACKEND —
// slaStatus, staleSince, checklistProgress. O frontend nunca recalcula
// prazo/threshold no client (activities.md §Alertas).
type activityListItemDTO struct {
	models.Activity
	// SlaStatus: onTime | atRisk | overdue — comparação de `now` com o
	// slaDueAt PERSISTIDO (nunca recalculado a partir da config vigente,
	// critério anti-dívida-do-Helpdesk). Vazio quando a atividade não tem
	// slaDueAt ou já saiu de pending/in_progress.
	SlaStatus string `json:"slaStatus,omitempty"`
	// StaleSince: preenchido quando status=in_progress e lastActivityAt é
	// mais antigo que activities_stale_threshold_minutes.
	StaleSince        *time.Time           `json:"staleSince,omitempty"`
	ChecklistProgress checklistProgressDTO `json:"checklistProgress"`
}

// activitySlaStatusThresholdFraction — "menos de 20% do prazo total"
// (activities.md §Alertas) vira atRisk.
const activitySlaStatusThresholdFraction = 0.20

func computeActivitySlaStatus(activity models.Activity, now time.Time) string {
	if activity.SlaDueAt == nil {
		return ""
	}
	if activity.Status != "pending" && activity.Status != "in_progress" {
		return ""
	}
	if activity.SlaDueAt.Before(now) {
		return "overdue"
	}
	// "at-risk" quando o tempo restante é menor que 20% do prazo total
	// (createdAt → slaDueAt). Sem createdAt≠slaDueAt (mesmo instante,
	// prazo zero), trata como overdue-adjacent: at-risk.
	total := activity.SlaDueAt.Sub(activity.CreatedAt)
	if total <= 0 {
		return "atRisk"
	}
	remaining := activity.SlaDueAt.Sub(now)
	if remaining <= time.Duration(float64(total)*activitySlaStatusThresholdFraction) {
		return "atRisk"
	}
	return "onTime"
}

func computeActivityStaleSince(activity models.Activity, staleThresholdMinutes int, now time.Time) *time.Time {
	if activity.Status != "in_progress" {
		return nil
	}
	threshold := time.Duration(staleThresholdMinutes) * time.Minute
	if now.Sub(activity.LastActivityAt) < threshold {
		return nil
	}
	t := activity.LastActivityAt
	return &t
}

// loadChecklistProgress agrega done/total por activityId numa ÚNICA query
// (GROUP BY) — nunca N+1 por atividade da lista (precedente: fix de N+1 em
// TagController.List, PR #219/#225).
func loadChecklistProgress(db *gorm.DB, tenantID uuid.UUID, activityIDs []int) map[int]checklistProgressDTO {
	result := make(map[int]checklistProgressDTO, len(activityIDs))
	if len(activityIDs) == 0 {
		return result
	}
	type row struct {
		ActivityID int
		Total      int
		Done       int
	}
	var rows []row
	db.Session(&gorm.Session{NewDB: true}).Model(&models.ActivityChecklistItem{}).
		Select(`"activityId" as activity_id, count(*) as total, count(*) FILTER (WHERE "isDone") as done`).
		Where(`"activityId" IN ? AND "tenantId" = ?`, activityIDs, tenantID).
		Group(`"activityId"`).Scan(&rows)
	for _, r := range rows {
		result[r.ActivityID] = checklistProgressDTO{Done: r.Done, Total: r.Total}
	}
	return result
}

// attachComputedActivityFields monta o DTO de lista com slaStatus/
// staleSince/checklistProgress — usado por MyActivities e List.
func attachComputedActivityFields(db *gorm.DB, tenantID uuid.UUID, activities []models.Activity, staleThresholdMinutes int) []activityListItemDTO {
	ids := make([]int, len(activities))
	for i, a := range activities {
		ids[i] = a.ID
	}
	progress := loadChecklistProgress(db, tenantID, ids)
	now := time.Now()

	out := make([]activityListItemDTO, len(activities))
	for i, a := range activities {
		out[i] = activityListItemDTO{
			Activity:          a,
			SlaStatus:         computeActivitySlaStatus(a, now),
			StaleSince:        computeActivityStaleSince(a, staleThresholdMinutes, now),
			ChecklistProgress: progress[a.ID], // zero value {0,0} quando a atividade não tem checklist
		}
	}
	return out
}

type activityKpisResponse struct {
	Today             int64 `json:"today"`
	InProgress        int64 `json:"inProgress"`
	Overdue           int64 `json:"overdue"`
	CompletedThisWeek int64 `json:"completedThisWeek"`
	// AvgExecutionMinutes é a média de (finishedAt - startedAt) das últimas
	// N concluídas — 0 quando não há amostra suficiente (nunca divide por
	// zero, nunca aparece como NaN no JSON).
	AvgExecutionMinutes float64 `json:"avgExecutionMinutes"`
	// Contagens por aba — mesmo payload, sem fetch adicional.
	TabCounts struct {
		All        int64 `json:"all"`
		Overdue    int64 `json:"overdue"`
		InProgress int64 `json:"inProgress"`
		Done       int64 `json:"done"`
	} `json:"tabCounts"`
}

const activityAvgExecutionSampleSize = 20

// MyActivitiesKPIs — GET /my-activities/kpis. Agregados do USUÁRIO logado
// (mesmo filtro incondicional por assignee de MyActivities) — nunca
// computado no frontend a partir da lista paginada/filtrada.
// @Summary      KPIs de Minhas Atividades
// @Tags         activities
// @Produce      json
// @Success      200  {object}  activityKpisResponse
// @Security     BearerAuth
// @Router       /my-activities/kpis [get]
func (ac *ActivityController) MyActivitiesKPIs(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "usuário não identificado"})
		return
	}

	base := db.Where(`"tenantId" = ? AND id IN (SELECT "activityId" FROM "ActivityAssignees" WHERE "userId" = ?)`, tenantID, userID)

	now := time.Now()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	dayEnd := dayStart.Add(24 * time.Hour)
	weekday := int(now.Weekday())
	weekStart := dayStart.AddDate(0, 0, -weekday)

	var resp activityKpisResponse

	db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
		Where(`"tenantId" = ? AND id IN (SELECT "activityId" FROM "ActivityAssignees" WHERE "userId" = ?)`, tenantID, userID).
		Where(`"scheduledAt" >= ? AND "scheduledAt" < ?`, dayStart, dayEnd).
		Count(&resp.Today)

	db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
		Where(`"tenantId" = ? AND id IN (SELECT "activityId" FROM "ActivityAssignees" WHERE "userId" = ?)`, tenantID, userID).
		Where(`status = ?`, "in_progress").Count(&resp.InProgress)

	db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
		Where(`"tenantId" = ? AND id IN (SELECT "activityId" FROM "ActivityAssignees" WHERE "userId" = ?)`, tenantID, userID).
		Where(`status IN ('pending','in_progress') AND "slaDueAt" < ?`, now).Count(&resp.Overdue)

	db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
		Where(`"tenantId" = ? AND id IN (SELECT "activityId" FROM "ActivityAssignees" WHERE "userId" = ?)`, tenantID, userID).
		Where(`status = 'done' AND "finishedAt" >= ?`, weekStart).Count(&resp.CompletedThisWeek)

	db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
		Where(`"tenantId" = ? AND id IN (SELECT "activityId" FROM "ActivityAssignees" WHERE "userId" = ?)`, tenantID, userID).
		Count(&resp.TabCounts.All)
	resp.TabCounts.Overdue = resp.Overdue
	resp.TabCounts.InProgress = resp.InProgress
	db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
		Where(`"tenantId" = ? AND id IN (SELECT "activityId" FROM "ActivityAssignees" WHERE "userId" = ?)`, tenantID, userID).
		Where(`status = 'done'`).Count(&resp.TabCounts.Done)

	var recentCompleted []models.Activity
	base.Session(&gorm.Session{NewDB: true}).
		Where(`status = 'done' AND "startedAt" IS NOT NULL AND "finishedAt" IS NOT NULL`).
		Order(`"finishedAt" DESC`).Limit(activityAvgExecutionSampleSize).Find(&recentCompleted)
	if len(recentCompleted) > 0 {
		var totalMinutes float64
		for _, a := range recentCompleted {
			totalMinutes += a.FinishedAt.Sub(*a.StartedAt).Minutes()
		}
		resp.AvgExecutionMinutes = totalMinutes / float64(len(recentCompleted))
	}

	c.JSON(http.StatusOK, resp)
}
