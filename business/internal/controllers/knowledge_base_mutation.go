package controllers

import (
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createKnowledgeBaseInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// @Summary      Criar base de conhecimento
// @Tags         knowledge-base
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados da base"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /knowledge-bases [post]
func (kbc *KnowledgeBaseController) Create(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "KnowledgeBases")
	if !ok {
		return
	}

	var input createKnowledgeBaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	name, err := utils.ValidateStringField(input.Name, "name", 255)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	description, err := utils.ValidateStringField(input.Description, "description", 1000)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	kb := models.KnowledgeBase{
		Name:        name,
		Description: description,
		TenantID:    tenantID,
	}
	if err := db.Create(&kb).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreateKnowledgeBase")
		return
	}

	c.JSON(http.StatusOK, kb)
}

type updateKnowledgeBaseInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// @Summary      Atualizar base de conhecimento
// @Tags         knowledge-base
// @Accept       json
// @Produce      json
// @Param        knowledgeBaseId  path      int                     true  "ID da base"
// @Param        body             body      map[string]interface{}  true  "Campos a atualizar"
// @Success      200              {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /knowledge-bases/{knowledgeBaseId} [put]
func (kbc *KnowledgeBaseController) Update(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "KnowledgeBases")
	if !ok {
		return
	}
	id := c.Param("knowledgeBaseId")

	var kb models.KnowledgeBase
	if err := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).First(&kb).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Knowledge base not found"})
		return
	}

	var input updateKnowledgeBaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	updName, err := utils.ValidateStringField(input.Name, "name", 255)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updDesc, err := utils.ValidateStringField(input.Description, "description", 1000)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	kb.Name = updName
	kb.Description = updDesc

	if err := db.Where("\"tenantId\" = ?", tenantID).Save(&kb).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateKnowledgeBase")
		return
	}

	c.JSON(http.StatusOK, kb)
}

// @Summary      Remover base de conhecimento
// @Tags         knowledge-base
// @Produce      json
// @Param        knowledgeBaseId  path      int  true  "ID da base"
// @Success      200              {object}  map[string]string
// @Security     BearerAuth
// @Router       /knowledge-bases/{knowledgeBaseId} [delete]
func (kbc *KnowledgeBaseController) Delete(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "KnowledgeBases")
	if !ok {
		return
	}
	id := c.Param("knowledgeBaseId")

	result := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).Delete(&models.KnowledgeBase{})
	if result.Error != nil {
		utils.RespondWithInternalError(c, result.Error, "DeleteKnowledgeBase")
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Knowledge base not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Knowledge base deleted"})
}

// @Summary      Adicionar fonte na base
// @Tags         knowledge-base
// @Accept       json
// @Produce      json
// @Param        knowledgeBaseId  path      int                     true  "ID da base"
// @Param        body             body      map[string]interface{}  true  "Dados da fonte"
// @Success      200              {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /knowledge-bases/{knowledgeBaseId}/sources [post]
// maxSourceUploadBytes caps a knowledge-base file upload — previously
// unbounded (no MaxBytesReader, no MaxMultipartMemory override), despite the
// docs promising a cap that was never implemented. 50MB comfortably covers a
// large PDF/DOCX/XLSX without risking memory pressure from an unbounded body.
const maxSourceUploadBytes = 50 << 20

func (kbc *KnowledgeBaseController) CreateSource(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "KnowledgeBases")
	if !ok {
		return
	}
	knowledgeBaseID := c.Param("knowledgeBaseId")

	// Must wrap the body before any PostForm/FormFile call — those trigger
	// ParseMultipartForm internally, which would otherwise read an unbounded
	// body before this limit had a chance to apply. Parsing explicitly here
	// (instead of letting the first PostForm call do it implicitly) lets us
	// return a clear 413 instead of PostForm silently returning empty fields
	// and the request failing downstream with a confusing "invalid sourceType".
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSourceUploadBytes)
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "arquivo excede o limite de 50MB"})
			return
		}
		// Not a multipart body at all (e.g. plain JSON) — let ShouldBind/
		// PostForm below produce their usual validation errors.
	}

	var kb models.KnowledgeBase
	if err := db.Where("id = ? AND \"tenantId\" = ?", knowledgeBaseID, tenantID).First(&kb).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Knowledge base not found"})
		return
	}

	sourceType := c.PostForm("type")
	urlValue := c.PostForm("url")
	sourceName := c.PostForm("name")
	content := c.PostForm("content")

	var fileHeader *multipart.FileHeader
	if file, err := c.FormFile("file"); err == nil && file != nil {
		fileHeader = file
		sourceName = filepath.Base(file.Filename)
		if sourceType == "" || sourceType == "file" {
			ext := filepath.Ext(file.Filename)
			if len(ext) > 1 {
				sourceType = strings.ToLower(strings.TrimPrefix(ext, "."))
			} else {
				sourceType = "file"
			}
		}
	}

	validSourceTypes := map[string]bool{
		"url": true, "file": true, "pdf": true, "txt": true,
		"docx": true, "csv": true, "xlsx": true, "md": true, "text": true,
	}
	if sourceType == "" {
		sourceType = "url"
	}
	if !validSourceTypes[sourceType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sourceType: must be one of url, file, pdf, txt, docx, csv, xlsx, md, text"})
		return
	}

	if _, err := utils.ValidateStringField(urlValue, "url", 2048); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(sourceName, "name", 255); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if sourceType == "text" {
		if _, err := utils.ValidateStringField(content, "content", 100000); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	// URL sources must carry a URL — without it the worker has nothing to scrape.
	// (Empty type defaults to "url" above, so this also rejects an empty payload.)
	if sourceType == "url" && strings.TrimSpace(urlValue) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "url é obrigatória para fonte do tipo url"})
		return
	}

	status := "ready"
	if sourceType == "text" || sourceType == "url" || fileHeader != nil {
		status = "pending"
	}

	source := models.KnowledgeBaseSource{
		KnowledgeBaseID: kb.ID,
		TenantID:        kb.TenantID,
		Type:            sourceType,
		URL:             urlValue,
		FileName:        sourceName,
		Status:          status,
	}

	// Use a fresh session for the write: the earlier db.Where(...).First(&kb) on
	// the scoped db leaves KnowledgeBase as the Statement.Schema, and reusing it
	// for Create(&source) would make GORM build the insert against the wrong
	// schema (auto-time CreatedAt landing on a string column → panic). NewDB
	// re-derives the KnowledgeBaseSource schema. See message_send.go for the
	// same scoped-db reuse caveat.
	if err := db.Session(&gorm.Session{NewDB: true}).Create(&source).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreateKnowledgeBaseSource")
		return
	}

	// File sources: persist the uploaded bytes to the object store and dispatch a
	// `file` ingestion job. The worker downloads the object by key, extracts text
	// (pdf/docx/xlsx/csv/txt/md), then follows the same chunk/embed/store path as
	// text. The object key is tenant-prefixed for multitenancy.
	if fileHeader != nil {
		if kbc.store == nil {
			markSourceError(db, &source, "object store não configurado")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "object store não configurado"})
			return
		}

		objectKey := fmt.Sprintf("%s/%d/%d/%s", tenantID.String(), kb.ID, source.ID, source.FileName)

		f, err := fileHeader.Open()
		if err != nil {
			markSourceError(db, &source, "falha ao abrir arquivo enviado")
			utils.RespondWithInternalError(c, err, "CreateKnowledgeBaseSource: open upload")
			return
		}
		defer func() { _ = f.Close() }()

		if err := kbc.store.Upload(c.Request.Context(), objectKey, f, fileHeader.Size, fileHeader.Header.Get("Content-Type")); err != nil {
			markSourceError(db, &source, "falha ao enviar arquivo ao object store")
			utils.RespondWithInternalError(c, err, "CreateKnowledgeBaseSource: upload")
			return
		}

		if err := db.Session(&gorm.Session{NewDB: true}).Model(&source).Update("objectKey", objectKey).Error; err != nil {
			utils.RespondWithInternalError(c, err, "CreateKnowledgeBaseSource: persist objectKey")
			return
		}
		source.ObjectKey = objectKey

		if kbc.publisher != nil {
			if err := kbc.publisher.PublishKnowledgeJob(
				fmt.Sprintf("knowledge.%s.ingest", tenantID.String()),
				map[string]interface{}{
					"tenantId": tenantID.String(), "knowledgeBaseId": kb.ID, "sourceId": source.ID,
					"type": "file", "payload": map[string]interface{}{"objectKey": objectKey, "fileName": source.FileName},
				}); err != nil {
				// Publish failed — the source must not sit in "pending" forever
				// with no job ever dispatched. Surface it immediately instead of
				// silently discarding the error (the old fire-and-forget `_ =`).
				markSourceError(db, &source, "falha ao enfileirar job de ingestão")
			}
		}

		c.JSON(http.StatusOK, source)
		return
	}

	// For text/url sources, dispatch an ingestion job to the native ingestion
	// worker (internal/knowledge), which chunks/embeds the text (or fetches the
	// URL) and reports status back via knowledge.events (handled by
	// KnowledgeStatusListener).
	if kbc.publisher != nil && (sourceType == "text" || sourceType == "url") {
		payload := map[string]interface{}{}
		if sourceType == "text" {
			payload["text"] = content
		} else {
			payload["url"] = urlValue
		}
		if err := kbc.publisher.PublishKnowledgeJob(
			fmt.Sprintf("knowledge.%s.ingest", tenantID.String()),
			map[string]interface{}{
				"tenantId": tenantID.String(), "knowledgeBaseId": kb.ID, "sourceId": source.ID,
				"type": sourceType, "payload": payload,
			}); err != nil {
			markSourceError(db, &source, "falha ao enfileirar job de ingestão")
		}
	}

	c.JSON(http.StatusOK, source)
}

// markSourceError flips a source to the error state with lastError set, using a
// fresh GORM session (the scoped db reuse caveat applies to writes here too).
func markSourceError(db *gorm.DB, source *models.KnowledgeBaseSource, msg string) {
	source.Status = "error"
	source.LastError = msg
	_ = db.Session(&gorm.Session{NewDB: true}).Model(source).
		Updates(map[string]interface{}{"status": "error", "lastError": msg}).Error
}

// @Summary      Reprocessar uma fonte (re-disparar ingestão)
// @Tags         knowledge-base
// @Produce      json
// @Param        knowledgeBaseId  path      int  true  "ID da base"
// @Param        sourceId         path      int  true  "ID da fonte"
// @Success      200              {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}/reingest [post]
func (kbc *KnowledgeBaseController) ReingestSource(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "KnowledgeBases")
	if !ok {
		return
	}
	kbID := c.Param("knowledgeBaseId")
	sourceID := c.Param("sourceId")

	var src models.KnowledgeBaseSource
	if err := db.Where(`id = ? AND "knowledgeBaseId" = ? AND "tenantId" = ?`, sourceID, kbID, tenantID).
		First(&src).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source not found"})
		return
	}

	// Reconstrói o payload de ingestão a partir do que está PERSISTIDO na fonte.
	// Fontes de texto não guardam o conteúdo (só foi publicado na criação) → não dá
	// para reprocessar aqui. URL reusa a url; arquivos reusam o objectKey no S3.
	var jobType string
	var payload map[string]interface{}
	switch src.Type {
	case "url":
		if strings.TrimSpace(src.URL) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "fonte url sem url para reprocessar"})
			return
		}
		jobType = "url"
		payload = map[string]interface{}{"url": src.URL}
	case "text":
		// RawContent is persisted by the ingestion worker on first success —
		// unlike the old Python service, text sources are now reprocessable.
		if strings.TrimSpace(src.RawContent) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "fonte de texto sem conteúdo salvo para reprocessar"})
			return
		}
		jobType = "text"
		payload = map[string]interface{}{"text": src.RawContent}
	default:
		// pdf/docx/csv/xlsx/md/file → o worker trata todos como "file" via objectKey.
		if strings.TrimSpace(src.ObjectKey) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "fonte sem arquivo armazenado para reprocessar"})
			return
		}
		jobType = "file"
		payload = map[string]interface{}{"objectKey": src.ObjectKey, "fileName": src.FileName}
	}

	if kbc.publisher == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "serviço de ingestão indisponível"})
		return
	}

	// Volta para pending + limpa o erro (sessão nova p/ a escrita — caveat do db escopado).
	if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.KnowledgeBaseSource{}).
		Where(`id = ? AND "tenantId" = ?`, src.ID, tenantID).
		Updates(map[string]interface{}{"status": "pending", "lastError": ""}).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ReingestSource")
		return
	}

	if err := kbc.publisher.PublishKnowledgeJob(
		fmt.Sprintf("knowledge.%s.ingest", tenantID.String()),
		map[string]interface{}{
			"tenantId": tenantID.String(), "knowledgeBaseId": src.KnowledgeBaseID, "sourceId": src.ID,
			"type": jobType, "payload": payload,
		}); err != nil {
		markSourceError(db, &src, "falha ao enfileirar job de reingest")
		c.JSON(http.StatusOK, src)
		return
	}

	src.Status = "pending"
	src.LastError = ""
	c.JSON(http.StatusOK, src)
}

// @Summary      Remover fonte da base
// @Tags         knowledge-base
// @Produce      json
// @Param        knowledgeBaseId  path      int  true  "ID da base"
// @Param        sourceId         path      int  true  "ID da fonte"
// @Success      200              {object}  map[string]string
// @Security     BearerAuth
// @Router       /knowledge-bases/{knowledgeBaseId}/sources/{sourceId} [delete]
func (kbc *KnowledgeBaseController) DeleteSource(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "KnowledgeBases")
	if !ok {
		return
	}
	knowledgeBaseID := c.Param("knowledgeBaseId")
	sourceID := c.Param("sourceId")

	var source models.KnowledgeBaseSource
	if err := db.Where("id = ? AND \"knowledgeBaseId\" = ? AND \"tenantId\" = ?", sourceID, knowledgeBaseID, tenantID).First(&source).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source not found"})
		return
	}

	if err := db.Delete(&source).Error; err != nil {
		utils.RespondWithInternalError(c, err, "DeleteKnowledgeBaseSource")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Source deleted"})
}
