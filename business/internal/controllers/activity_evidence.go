package controllers

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// activityPhotoUploadMaxBytes/activityFinalizeMaxBytes — uma foto de campo
// não é um PDF de 50MB (precedente do Knowledge Base); 10MB é o teto
// honesto aqui. O mecanismo (http.MaxBytesReader ANTES de qualquer
// FormFile/PostForm/ShouldBindJSON) é o mesmo de
// knowledge_base_mutation.go:158-186 — a ordem importa, senão o corpo é
// lido sem limite antes do cap ter qualquer efeito.
const (
	activityPhotoUploadMaxBytes = 10 << 20
	activityFinalizeMaxBytes    = 10 << 20
	// activityPresignTTL cobre um turno de trabalho — presign é regenerado a
	// cada leitura (Show), nunca cacheado além disso.
	activityPresignTTL = 24 * time.Hour
)

// buildActivityObjectKey monta a chave do objeto — sempre prefixada por
// tenantId, o que impede leitura cruzada entre tenants mesmo se alguém
// adivinhar um objectKey de outro tenant.
func buildActivityObjectKey(tenantID fmt.Stringer, activityID int, subpath, filename string) string {
	if subpath != "" {
		return fmt.Sprintf("%s/activities/%d/%s/%s", tenantID.String(), activityID, subpath, filename)
	}
	return fmt.Sprintf("%s/activities/%d/%s", tenantID.String(), activityID, filename)
}

// normalizeActivityPhotoValue reduz um valor recebido no PUT
// /activities/:id/items/:itemId a uma CHAVE de objeto, nunca a uma URL
// assinada crua. O frontend, depois de fazer upload, sempre re-envia o
// `photoUrl` retornado como `value` do item (useActivityExecution.ts —
// handleFileUpload chama handleItemChange(item, "value", data.photoUrl)).
// Persistir esse valor sem normalizar gravaria uma URL PRESIGNED (com
// assinatura + expiração) como valor permanente — funcionaria só até o TTL
// vencer, e todo GET /activities/:id posterior devolveria uma <img> quebrada.
// Guardando sempre a chave, e regenerando a URL assinada em toda leitura
// (Show), o link nunca expira de fato.
func normalizeActivityPhotoValue(bucket, raw string) string {
	if raw == "" {
		return raw
	}
	u, err := url.Parse(raw)
	if err != nil || u.Path == "" {
		// Não é uma URL — já é uma chave crua (upload feito nesta mesma
		// revisão do backend, ou valor de teste/API direta).
		return raw
	}
	key := strings.TrimPrefix(u.Path, "/")
	key = strings.TrimPrefix(key, bucket+"/")
	return key
}

// UploadItemPhoto — POST /activities/:id/items/:itemId/photo (multipart,
// campo "photo"). Grava a foto no S3 Storage Driver com chave determinística
// (tenantId/activities/activityId/items/itemId/nome), persiste a CHAVE (não
// a URL assinada) no item, e devolve uma URL assinada de curta duração pro
// preview imediato no frontend.
// @Summary      Upload de foto de item de checklist
// @Tags         activities
// @Accept       multipart/form-data
// @Produce      json
// @Param        id      path  int   true  "ID da Atividade"
// @Param        itemId  path  int   true  "ID do item"
// @Param        photo   formData  file  true  "Arquivo de imagem"
// @Success      200  {object}  map[string]string
// @Security     BearerAuth
// @Router       /activities/{id}/items/{itemId}/photo [post]
func (ac *ActivityController) UploadItemPhoto(c *gin.Context) {
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
	if _, ok := findScopedActivity(c, db, tenantID, activityID); !ok {
		return
	}

	// MaxBytesReader ANTES de FormFile e ANTES da checagem de s3Store —
	// senão o corpo é lido sem limite antes do cap ter qualquer efeito
	// (mesma ordem de knowledge_base_mutation.go:171-177), e um upload
	// grande só falharia por causa da config do store, não do próprio cap.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, activityPhotoUploadMaxBytes)

	fileHeader, err := c.FormFile("photo")
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "foto excede o limite de 10MB"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "arquivo 'photo' é obrigatório"})
		return
	}

	if ac.s3Store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "object store não configurado"})
		return
	}

	f, err := fileHeader.Open()
	if err != nil {
		utils.RespondWithInternalError(c, err, "UploadItemPhoto-Open")
		return
	}
	defer func() { _ = f.Close() }()

	objectKey := buildActivityObjectKey(tenantID, activityID, fmt.Sprintf("items/%d", itemID), filepath.Base(fileHeader.Filename))
	if err := ac.s3Store.Upload(c.Request.Context(), objectKey, f, fileHeader.Size, fileHeader.Header.Get("Content-Type")); err != nil {
		utils.RespondWithInternalError(c, err, "UploadItemPhoto-Upload")
		return
	}

	res := db.Session(&gorm.Session{NewDB: true}).Model(&models.ActivityChecklistItem{}).
		Where(`id = ? AND "activityId" = ? AND "tenantId" = ?`, itemID, activityID, tenantID).
		Update("value", objectKey)
	if res.Error != nil {
		utils.RespondWithInternalError(c, res.Error, "UploadItemPhoto-Persist")
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "item não encontrado"})
		return
	}
	touchActivityLastActivity(db, tenantID, activityID)

	presigned, err := ac.s3Store.PresignedGetURL(c.Request.Context(), objectKey, activityPresignTTL)
	if err != nil {
		utils.RespondWithInternalError(c, err, "UploadItemPhoto-Presign")
		return
	}
	c.JSON(http.StatusOK, gin.H{"photoUrl": presigned})
}

type finalizeActivityRequest struct {
	ClientSignature string `json:"clientSignature" binding:"required"`
}

// Finalize — POST /activities/:id/finalize. Recebe a assinatura do cliente
// como dataURL PNG (base64), grava no S3 (nunca base64 no banco — invariante
// do módulo), e marca status=done + finishedAt.
// @Summary      Finalizar Atividade com assinatura do cliente
// @Tags         activities
// @Accept       json
// @Produce      json
// @Param        id    path  int                       true  "ID da Atividade"
// @Param        body  body  finalizeActivityRequest    true  "Assinatura (dataURL PNG)"
// @Success      200  {object}  models.Activity
// @Security     BearerAuth
// @Router       /activities/{id}/finalize [post]
func (ac *ActivityController) Finalize(c *gin.Context) {
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

	// Corpo é um dataURL base64 dentro de JSON — MaxBytesReader ANTES do
	// bind e ANTES da checagem de s3Store, mesmo raciocínio de
	// UploadItemPhoto: o cap não pode depender da config do store.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, activityFinalizeMaxBytes)

	var req finalizeActivityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "assinatura excede o limite de 10MB"})
			return
		}
		utils.RespondWithBindError(c, err)
		return
	}

	if ac.s3Store == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "object store não configurado"})
		return
	}

	payload := req.ClientSignature
	if idx := strings.Index(payload, ","); idx != -1 && strings.HasPrefix(payload, "data:") {
		payload = payload[idx+1:]
	}
	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "assinatura inválida — esperado dataURL base64"})
		return
	}

	objectKey := buildActivityObjectKey(tenantID, activityID, "", "signature.png")
	if err := ac.s3Store.Upload(c.Request.Context(), objectKey, strings.NewReader(string(decoded)), int64(len(decoded)), "image/png"); err != nil {
		utils.RespondWithInternalError(c, err, "Finalize-Upload")
		return
	}

	now := time.Now()
	if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.Activity{}).
		Where(`id = ? AND "tenantId" = ?`, activityID, tenantID).
		Updates(map[string]interface{}{
			"clientSignatureUrl": objectKey,
			"finishedAt":         now,
			"status":             "done",
			"lastActivityAt":     now,
		}).Error; err != nil {
		utils.RespondWithInternalError(c, err, "Finalize-Update")
		return
	}

	var updated models.Activity
	db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, activityID, tenantID).First(&updated)
	c.JSON(http.StatusOK, updated)
}
