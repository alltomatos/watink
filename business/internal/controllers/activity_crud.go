package controllers

import (
	"net/http"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// activityItemInput é o DTO de um item de checklist recebido no create — não
// aceita isDone/value do payload (o item nasce sempre pendente).
type activityItemInput struct {
	Label      string `json:"label" binding:"required"`
	IsRequired bool   `json:"isRequired"`
	InputType  string `json:"inputType"`
	Position   int    `json:"position"`
}

// activityInput é o DTO de escrita — deliberadamente NÃO models.Activity,
// para um caller nunca conseguir contrabandear tenantId/slaDueAt/deletedAt
// pelo Bind (mesmo padrão de clientInput em client.go).
type activityInput struct {
	Title       string              `json:"title" binding:"required"`
	Description string              `json:"description"`
	Priority    string              `json:"priority"`
	ScheduledAt *time.Time          `json:"scheduledAt"`
	AssigneeIDs []int               `json:"assigneeIds"`
	Items       []activityItemInput `json:"items"`
}

var validActivityPriorities = map[string]bool{"low": true, "medium": true, "high": true, "urgent": true}

func normalizeActivityPriority(p string) string {
	if validActivityPriorities[p] {
		return p
	}
	return "medium"
}

// List — GET /activities (tenant-wide, visão de gestão). Distinto de
// GET /my-activities (issue #530), que filtra por assignee — aqui é
// deliberadamente todo o tenant, para quem tem activities:read gerenciar.
// @Summary      Listar Atividades (gestão, tenant inteiro)
// @Tags         activities
// @Produce      json
// @Param        searchParam  query  string  false  "Busca por título"
// @Param        status       query  string  false  "Filtro por status"
// @Param        priority     query  string  false  "Filtro por prioridade"
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /activities [get]
func (ac *ActivityController) List(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}

	query := db.Where(`"tenantId" = ?`, tenantID).Preload("Assignees.User")
	if search := strings.TrimSpace(c.Query("searchParam")); search != "" {
		query = query.Where("title ILIKE ?", "%"+search+"%")
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if priority := c.Query("priority"); priority != "" {
		query = query.Where("priority = ?", priority)
	}

	var activities []models.Activity
	// Ordenação por urgência: overdue primeiro (slaDueAt já vencido e ainda
	// aberto), depois por slaDueAt mais próximo, atividades sem prazo por
	// último.
	if err := query.Order(`
		CASE WHEN "slaDueAt" IS NOT NULL AND "slaDueAt" < NOW() AND status IN ('pending','in_progress') THEN 0 ELSE 1 END,
		"slaDueAt" ASC NULLS LAST
	`).Find(&activities).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListActivities")
		return
	}

	staleThreshold := loadActivityStaleThresholdMinutes(db, tenantID)
	c.JSON(http.StatusOK, gin.H{"activities": attachComputedActivityFields(db, tenantID, activities, staleThreshold)})
}

// Create — POST /activities. slaDueAt vem SEMPRE da calculadora de #528
// (CalculateSLADueAt) — nunca reimplementado aqui. Assignees e items, se
// enviados, são criados na mesma transação.
// @Summary      Criar Atividade
// @Tags         activities
// @Accept       json
// @Produce      json
// @Success      201  {object}  models.Activity
// @Security     BearerAuth
// @Router       /activities [post]
func (ac *ActivityController) Create(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	var in activityInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	priority := normalizeActivityPriority(in.Priority)
	now := time.Now()
	slaCfg := loadActivitySLAConfig(db, tenantID)

	activity := models.Activity{
		TenantID:       tenantID,
		Title:          in.Title,
		Description:    in.Description,
		Status:         "pending",
		Priority:       priority,
		ScheduledAt:    in.ScheduledAt,
		LastActivityAt: now,
		SlaDueAt:       CalculateSLADueAt(slaCfg, priority, now),
	}

	err := db.Session(&gorm.Session{NewDB: true}).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&activity).Error; err != nil {
			return err
		}

		if len(in.AssigneeIDs) > 0 {
			assignees, err := buildValidAssigneeRows(tx, tenantID, activity.ID, in.AssigneeIDs)
			if err != nil {
				return err
			}
			if len(assignees) > 0 {
				if err := tx.Create(&assignees).Error; err != nil {
					return err
				}
			}
		}

		if len(in.Items) > 0 {
			items := make([]models.ActivityChecklistItem, 0, len(in.Items))
			for _, item := range in.Items {
				inputType := item.InputType
				if inputType != "text" && inputType != "number" && inputType != "photo" {
					inputType = "text"
				}
				items = append(items, models.ActivityChecklistItem{
					ActivityID: activity.ID,
					TenantID:   tenantID,
					Label:      item.Label,
					IsRequired: item.IsRequired,
					InputType:  inputType,
					Position:   item.Position,
				})
			}
			if err := tx.Create(&items).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		utils.RespondWithInternalError(c, err, "CreateActivity")
		return
	}

	reloadActivityWithRelations(db, tenantID, activity.ID, &activity)
	c.JSON(http.StatusCreated, activity)
}

// buildValidAssigneeRows filtra assigneeIds para apenas Users do MESMO
// tenant — um userId de outro tenant é silenciosamente descartado, nunca
// vira um vínculo cross-tenant.
func buildValidAssigneeRows(tx *gorm.DB, tenantID interface{}, activityID int, userIDs []int) ([]models.ActivityAssignee, error) {
	var validUsers []models.User
	if err := tx.Where(`id IN ? AND "tenantId" = ?`, userIDs, tenantID).Find(&validUsers).Error; err != nil {
		return nil, err
	}
	rows := make([]models.ActivityAssignee, 0, len(validUsers))
	for _, u := range validUsers {
		rows = append(rows, models.ActivityAssignee{
			ActivityID: activityID,
			UserID:     u.ID,
			TenantID:   u.TenantID,
		})
	}
	return rows, nil
}

// reloadActivityWithRelations recarrega a Activity com Assignees.User e
// Items — best-effort de leitura pós-escrita (erro aqui não desfaz a
// criação, só deixa a resposta com relations vazias).
func reloadActivityWithRelations(db *gorm.DB, tenantID interface{}, id int, out *models.Activity) {
	db.Session(&gorm.Session{NewDB: true}).
		Preload("Assignees.User").Preload("Items").
		Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(out)
}

// findScopedActivity resolve uma Activity pelo par (id, tenantId) — dupla
// checagem sempre, nunca só o id (mesmo padrão de findScopedClient em
// client_address.go).
func findScopedActivity(c *gin.Context, db *gorm.DB, tenantID interface{}, id int) (models.Activity, bool) {
	var activity models.Activity
	if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&activity).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "atividade não encontrada"})
		return activity, false
	}
	return activity, true
}

// Update — PUT /activities/:id. slaDueAt é recalculado quando a prioridade
// muda ENQUANTO status=pending; a partir de in_progress fica congelado —
// alterar a config de SLA depois não pode mover o prazo de uma atividade já
// em execução (ADR 0029, o oposto da dívida do Helpdesk).
// @Summary      Atualizar Atividade
// @Tags         activities
// @Accept       json
// @Produce      json
// @Param        id  path  int  true  "ID da Atividade"
// @Success      200  {object}  models.Activity
// @Security     BearerAuth
// @Router       /activities/{id} [put]
func (ac *ActivityController) Update(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	id, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}
	existing, ok := findScopedActivity(c, db, tenantID, id)
	if !ok {
		return
	}

	var in activityInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	priority := normalizeActivityPriority(in.Priority)

	fields := map[string]interface{}{
		"title":       in.Title,
		"description": in.Description,
		"priority":    priority,
		"scheduledAt": in.ScheduledAt,
	}
	if existing.Status == "pending" && priority != existing.Priority {
		slaCfg := loadActivitySLAConfig(db, tenantID)
		fields["slaDueAt"] = CalculateSLADueAt(slaCfg, priority, time.Now())
	}

	if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
		Where(`id = ? AND "tenantId" = ?`, id, tenantID).Updates(fields).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateActivity")
		return
	}

	var updated models.Activity
	reloadActivityWithRelations(db, tenantID, id, &updated)
	c.JSON(http.StatusOK, updated)
}

// Delete — DELETE /activities/:id. Activity embeds gorm.DeletedAt — soft
// delete, mesmo padrão de Client (ADR 0023).
// @Summary      Remover Atividade
// @Tags         activities
// @Produce      json
// @Param        id  path  int  true  "ID da Atividade"
// @Success      200  {object}  map[string]string
// @Security     BearerAuth
// @Router       /activities/{id} [delete]
func (ac *ActivityController) Delete(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	id, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}

	res := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).Delete(&models.Activity{})
	if res.Error != nil {
		utils.RespondWithInternalError(c, res.Error, "DeleteActivity")
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "atividade não encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Atividade removida"})
}

type updateActivityAssigneesRequest struct {
	UserIDs []int `json:"userIds"`
}

// UpdateAssignees — PUT /activities/:id/assignees. Upsert por diferença
// (nunca delete+recreate cego): remove quem saiu da lista, insere quem é
// novo, mantém quem já estava — evita um DELETE+INSERT gerar uma janela sem
// nenhum assignee em caso de falha no meio.
// @Summary      Atribuir responsáveis à Atividade
// @Tags         activities
// @Accept       json
// @Produce      json
// @Param        id    path  int                              true  "ID da Atividade"
// @Param        body  body  updateActivityAssigneesRequest  true  "Lista completa de userIds"
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /activities/{id}/assignees [put]
func (ac *ActivityController) UpdateAssignees(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	id, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}
	if _, ok := findScopedActivity(c, db, tenantID, id); !ok {
		return
	}

	var req updateActivityAssigneesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	err := db.Session(&gorm.Session{NewDB: true}).Transaction(func(tx *gorm.DB) error {
		var current []models.ActivityAssignee
		if err := tx.Where(`"activityId" = ? AND "tenantId" = ?`, id, tenantID).Find(&current).Error; err != nil {
			return err
		}
		currentByUser := make(map[int]bool, len(current))
		for _, a := range current {
			currentByUser[a.UserID] = true
		}

		wantedByUser := make(map[int]bool, len(req.UserIDs))
		for _, uid := range req.UserIDs {
			wantedByUser[uid] = true
		}

		toRemove := make([]int, 0)
		for uid := range currentByUser {
			if !wantedByUser[uid] {
				toRemove = append(toRemove, uid)
			}
		}
		if len(toRemove) > 0 {
			if err := tx.Where(`"activityId" = ? AND "tenantId" = ? AND "userId" IN ?`, id, tenantID, toRemove).
				Delete(&models.ActivityAssignee{}).Error; err != nil {
				return err
			}
		}

		toAdd := make([]int, 0)
		for uid := range wantedByUser {
			if !currentByUser[uid] {
				toAdd = append(toAdd, uid)
			}
		}
		if len(toAdd) > 0 {
			rows, err := buildValidAssigneeRows(tx, tenantID, id, toAdd)
			if err != nil {
				return err
			}
			if len(rows) > 0 {
				if err := tx.Create(&rows).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		utils.RespondWithInternalError(c, err, "UpdateActivityAssignees")
		return
	}

	var assignees []models.ActivityAssignee
	db.Session(&gorm.Session{NewDB: true}).Preload("User").
		Where(`"activityId" = ? AND "tenantId" = ?`, id, tenantID).Find(&assignees)
	c.JSON(http.StatusOK, gin.H{"assignees": assignees})
}
