package controllers

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// activityProtocolClientDTO/activityProtocolDTO/activityDetailDTO achatam o
// join transitivo Protocol.Contact.Client → protocol.client, o contrato que
// DetailsTab.tsx já espera (activity.protocol?.client?.name). Nunca
// desnormalizar ClientID em Activity — resolvido aqui, na borda de leitura,
// mesmo princípio do ADR 0023.
type activityProtocolClientDTO struct {
	Name string `json:"name"`
}

type activityProtocolDTO struct {
	ID      int                        `json:"id"`
	Subject string                     `json:"subject"`
	Client  *activityProtocolClientDTO `json:"client,omitempty"`
}

// activityDetailDTO embute models.Activity mas REDEFINE Protocol no mesmo
// nome — em encoding/json, o campo declarado na profundidade 0 (aqui) vence
// sobre o promovido do embutido (profundidade 1, models.Activity.Protocol),
// então a serialização usa este achatado, nunca o Protocol cru do model.
type activityDetailDTO struct {
	models.Activity
	Protocol *activityProtocolDTO `json:"protocol,omitempty"`
}

// toActivityDetailDTO monta o DTO de detalhe e RESSIGNA (presigned URL,
// TTL curto) todo valor de evidência armazenado como chave de objeto —
// fotos de item (inputType=photo) e assinaturas. O que fica gravado no
// banco é sempre a chave (ver normalizeActivityPhotoValue); a URL servida
// ao cliente é sempre gerada na hora da leitura, nunca cacheada além do
// TTL. Sem s3Store configurado (nil), os valores voltam como a chave crua —
// leitura nunca quebra por falta de object store, só não resolve a imagem.
func (ac *ActivityController) toActivityDetailDTO(ctx context.Context, activity models.Activity) activityDetailDTO {
	dto := activityDetailDTO{Activity: activity}
	if activity.Protocol != nil {
		p := &activityProtocolDTO{ID: activity.Protocol.ID, Subject: activity.Protocol.Subject}
		if activity.Protocol.Contact.Client != nil {
			p.Client = &activityProtocolClientDTO{Name: activity.Protocol.Contact.Client.Name}
		}
		dto.Protocol = p
	}

	if ac.s3Store != nil {
		for i := range dto.Items {
			item := &dto.Items[i]
			if item.InputType == "photo" && item.Value != "" {
				item.Value = ac.presignOrKey(ctx, item.Value)
			}
		}
		if dto.ClientSignatureUrl != "" {
			dto.ClientSignatureUrl = ac.presignOrKey(ctx, dto.ClientSignatureUrl)
		}
		if dto.TechnicianSignatureUrl != "" {
			dto.TechnicianSignatureUrl = ac.presignOrKey(ctx, dto.TechnicianSignatureUrl)
		}
	}
	return dto
}

// presignOrKey devolve a URL assinada pra key; em caso de erro (ex.: object
// store fora do ar), loga e devolve a própria key — leitura nunca quebra
// por indisponibilidade do S3, só degrada pra um link não-clicável.
func (ac *ActivityController) presignOrKey(ctx context.Context, key string) string {
	url, err := ac.s3Store.PresignedGetURL(ctx, key, activityPresignTTL)
	if err != nil {
		slog.Warn("activity: falha ao gerar URL assinada", "key", key, "error", err.Error())
		return key
	}
	return url
}

// MyActivities — GET /my-activities. Filtro por assignee é INCONDICIONAL —
// diferente de List (GET /activities, tenant-wide), aqui vale mesmo para
// alcance=tenant/plataforma: GetScopedDB retorna cedo pra esses alcances
// (antes do switch por tabela), então sem este WHERE explícito um
// Administrador veria o tenant inteiro em vez de só as suas atividades.
// @Summary      Minhas Atividades (atribuídas ao usuário logado)
// @Tags         activities
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /my-activities [get]
func (ac *ActivityController) MyActivities(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "usuário não identificado"})
		return
	}

	var activities []models.Activity
	err := db.Where(`"tenantId" = ? AND id IN (SELECT "activityId" FROM "ActivityAssignees" WHERE "userId" = ?)`, tenantID, userID).
		Order(`
			CASE WHEN "slaDueAt" IS NOT NULL AND "slaDueAt" < NOW() AND status IN ('pending','in_progress') THEN 0 ELSE 1 END,
			"slaDueAt" ASC NULLS LAST
		`).Find(&activities).Error
	if err != nil {
		utils.RespondWithInternalError(c, err, "MyActivities")
		return
	}

	staleThreshold := loadActivityStaleThresholdMinutes(db, tenantID)
	c.JSON(http.StatusOK, gin.H{"activities": attachComputedActivityFields(db, tenantID, activities, staleThreshold)})
}

// Show — GET /activities/:id. Detalhe completo com items/materials/
// occurrences + protocol.client achatado por transitividade.
// @Summary      Detalhar Atividade
// @Tags         activities
// @Produce      json
// @Param        id  path  int  true  "ID da Atividade"
// @Success      200  {object}  activityDetailDTO
// @Security     BearerAuth
// @Router       /activities/{id} [get]
func (ac *ActivityController) Show(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	id, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}

	var activity models.Activity
	err := db.Session(&gorm.Session{NewDB: true}).
		Preload("Protocol.Contact.Client").
		Preload("Assignees.User").
		Preload("Items", func(tx *gorm.DB) *gorm.DB { return tx.Order("position ASC") }).
		Preload("Materials").
		Preload("Occurrences").
		Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&activity).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "atividade não encontrada"})
		return
	}

	c.JSON(http.StatusOK, ac.toActivityDetailDTO(c.Request.Context(), activity))
}

// touchActivityLastActivity atualiza lastActivityAt — chamado por TODA
// mutação de execução (item/material/ocorrência), base do alerta de
// "atividade parada" (staleSince, issue de KPIs). Best-effort: falha aqui
// não desfaz a mutação principal, só loga via o Error do Exec (ignorado
// deliberadamente — não é crítico o suficiente pra abortar a resposta).
func touchActivityLastActivity(db *gorm.DB, tenantID interface{}, activityID int) {
	db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
		Where(`id = ? AND "tenantId" = ?`, activityID, tenantID).
		Update("lastActivityAt", time.Now())
}

// Start — PUT /activities/:id/start. Idempotente: só marca
// status=in_progress/startedAt na PRIMEIRA chamada.
// @Summary      Iniciar execução da Atividade
// @Tags         activities
// @Produce      json
// @Param        id  path  int  true  "ID da Atividade"
// @Success      200  {object}  models.Activity
// @Security     BearerAuth
// @Router       /activities/{id}/start [put]
func (ac *ActivityController) Start(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	id, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}
	activity, ok := findScopedActivity(c, db, tenantID, id)
	if !ok {
		return
	}

	if activity.Status == "pending" {
		now := time.Now()
		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
			Where(`id = ? AND "tenantId" = ?`, id, tenantID).
			Updates(map[string]interface{}{"status": "in_progress", "startedAt": now, "lastActivityAt": now}).Error; err != nil {
			utils.RespondWithInternalError(c, err, "StartActivity")
			return
		}
	}

	var updated models.Activity
	db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&updated)
	c.JSON(http.StatusOK, updated)
}

type updateActivityItemRequest struct {
	IsDone *bool   `json:"isDone"`
	Value  *string `json:"value"`
}

// UpdateItem — PUT /activities/:id/items/:itemId. Atualiza isDone/value.
// @Summary      Atualizar item de checklist
// @Tags         activities
// @Accept       json
// @Produce      json
// @Param        id      path  int  true  "ID da Atividade"
// @Param        itemId  path  int  true  "ID do item"
// @Success      200  {object}  models.ActivityChecklistItem
// @Security     BearerAuth
// @Router       /activities/{id}/items/{itemId} [put]
func (ac *ActivityController) UpdateItem(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	activityID, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}
	itemID, ok := utils.ParseIntParam(c, "itemId")
	if !ok {
		return
	}

	var req updateActivityItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	fields := map[string]interface{}{}
	if req.IsDone != nil {
		fields["isDone"] = *req.IsDone
	}
	if req.Value != nil {
		value := *req.Value
		var existing models.ActivityChecklistItem
		if err := db.Session(&gorm.Session{NewDB: true}).
			Where(`id = ? AND "activityId" = ? AND "tenantId" = ?`, itemID, activityID, tenantID).
			First(&existing).Error; err == nil && existing.InputType == "photo" && ac.s3Store != nil {
			// O frontend, depois do upload, re-envia o photoUrl (URL
			// assinada) como value deste PUT — normaliza pra CHAVE antes de
			// persistir, senão o link grava com prazo de validade. Ver
			// normalizeActivityPhotoValue.
			bucket, _ := ac.s3Store.Describe()["bucket"].(string)
			value = normalizeActivityPhotoValue(bucket, value)
		}
		fields["value"] = value
	}

	res := db.Session(&gorm.Session{NewDB: true}).Model(&models.ActivityChecklistItem{}).
		Where(`id = ? AND "activityId" = ? AND "tenantId" = ?`, itemID, activityID, tenantID).Updates(fields)
	if res.Error != nil {
		utils.RespondWithInternalError(c, res.Error, "UpdateActivityItem")
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "item não encontrado"})
		return
	}
	touchActivityLastActivity(db, tenantID, activityID)

	var updated models.ActivityChecklistItem
	db.Session(&gorm.Session{NewDB: true}).Where("id = ?", itemID).First(&updated)
	c.JSON(http.StatusOK, updated)
}

type activityMaterialInput struct {
	MaterialName string  `json:"materialName" binding:"required"`
	Quantity     float64 `json:"quantity"`
	Unit         string  `json:"unit"`
	IsBillable   bool    `json:"isBillable"`
	Notes        string  `json:"notes"`
}

// AddMaterial — POST /activities/:id/materials.
// @Summary      Adicionar material à Atividade
// @Tags         activities
// @Accept       json
// @Produce      json
// @Param        id  path  int  true  "ID da Atividade"
// @Success      201  {object}  models.ActivityMaterial
// @Security     BearerAuth
// @Router       /activities/{id}/materials [post]
func (ac *ActivityController) AddMaterial(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	activityID, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}
	if _, ok := findScopedActivity(c, db, tenantID, activityID); !ok {
		return
	}

	var in activityMaterialInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	unit := in.Unit
	if unit == "" {
		unit = "un"
	}
	quantity := in.Quantity
	if quantity <= 0 {
		quantity = 1
	}

	material := models.ActivityMaterial{
		ActivityID: activityID, TenantID: tenantID, MaterialName: in.MaterialName,
		Quantity: quantity, Unit: unit, IsBillable: in.IsBillable, Notes: in.Notes,
	}
	if err := db.Session(&gorm.Session{NewDB: true}).Create(&material).Error; err != nil {
		utils.RespondWithInternalError(c, err, "AddActivityMaterial")
		return
	}
	touchActivityLastActivity(db, tenantID, activityID)

	c.JSON(http.StatusCreated, material)
}

// DeleteMaterial — DELETE /activities/:id/materials/:materialId.
// @Summary      Remover material da Atividade
// @Tags         activities
// @Produce      json
// @Param        id          path  int  true  "ID da Atividade"
// @Param        materialId  path  int  true  "ID do material"
// @Success      200  {object}  map[string]string
// @Security     BearerAuth
// @Router       /activities/{id}/materials/{materialId} [delete]
func (ac *ActivityController) DeleteMaterial(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	activityID, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}
	materialID, ok := utils.ParseIntParam(c, "materialId")
	if !ok {
		return
	}

	res := db.Session(&gorm.Session{NewDB: true}).
		Where(`id = ? AND "activityId" = ? AND "tenantId" = ?`, materialID, activityID, tenantID).
		Delete(&models.ActivityMaterial{})
	if res.Error != nil {
		utils.RespondWithInternalError(c, res.Error, "DeleteActivityMaterial")
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "material não encontrado"})
		return
	}
	touchActivityLastActivity(db, tenantID, activityID)
	c.JSON(http.StatusOK, gin.H{"message": "Material removido"})
}

type activityOccurrenceInput struct {
	Description string `json:"description" binding:"required"`
	Type        string `json:"type"`
	TimeImpact  *int   `json:"timeImpact"`
}

var validActivityOccurrenceTypes = map[string]bool{"info": true, "impediment": true, "delay": true}

// AddOccurrence — POST /activities/:id/occurrences.
// @Summary      Registrar ocorrência na Atividade
// @Tags         activities
// @Accept       json
// @Produce      json
// @Param        id  path  int  true  "ID da Atividade"
// @Success      201  {object}  models.ActivityOccurrence
// @Security     BearerAuth
// @Router       /activities/{id}/occurrences [post]
func (ac *ActivityController) AddOccurrence(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	activityID, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}
	if _, ok := findScopedActivity(c, db, tenantID, activityID); !ok {
		return
	}

	var in activityOccurrenceInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	occType := in.Type
	if !validActivityOccurrenceTypes[occType] {
		occType = "info"
	}

	occurrence := models.ActivityOccurrence{
		ActivityID: activityID, TenantID: tenantID, Description: in.Description,
		Type: occType, TimeImpact: in.TimeImpact,
	}
	if err := db.Session(&gorm.Session{NewDB: true}).Create(&occurrence).Error; err != nil {
		utils.RespondWithInternalError(c, err, "AddActivityOccurrence")
		return
	}
	touchActivityLastActivity(db, tenantID, activityID)

	c.JSON(http.StatusCreated, occurrence)
}

// DeleteOccurrence — DELETE /activities/:id/occurrences/:occurrenceId.
// @Summary      Remover ocorrência da Atividade
// @Tags         activities
// @Produce      json
// @Param        id            path  int  true  "ID da Atividade"
// @Param        occurrenceId  path  int  true  "ID da ocorrência"
// @Success      200  {object}  map[string]string
// @Security     BearerAuth
// @Router       /activities/{id}/occurrences/{occurrenceId} [delete]
func (ac *ActivityController) DeleteOccurrence(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}
	activityID, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}
	occurrenceID, ok := utils.ParseIntParam(c, "occurrenceId")
	if !ok {
		return
	}

	res := db.Session(&gorm.Session{NewDB: true}).
		Where(`id = ? AND "activityId" = ? AND "tenantId" = ?`, occurrenceID, activityID, tenantID).
		Delete(&models.ActivityOccurrence{})
	if res.Error != nil {
		utils.RespondWithInternalError(c, res.Error, "DeleteActivityOccurrence")
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "ocorrência não encontrada"})
		return
	}
	touchActivityLastActivity(db, tenantID, activityID)
	c.JSON(http.StatusOK, gin.H{"message": "Ocorrência removida"})
}
