package plugins

import (
	"mime/multipart"
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/mediastore"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// protocolTenantScoped resolve o Protocol pelo :id garantindo que pertence ao
// tenant do request — usado por todos os handlers de anexo (evita vazamento
// cross-tenant via um :id de outro tenant).
func protocolTenantScoped(db *gorm.DB, c *gin.Context, tenantID interface{}) (models.Protocol, bool) {
	var protocol models.Protocol
	if err := db.Where(`id = ? AND "tenantId" = ?`, c.Param("id"), tenantID).First(&protocol).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "protocol not found"})
		return protocol, false
	}
	return protocol, true
}

// handleListAttachments — GET /helpdesk/protocols/:id/attachments
func handleListAttachments(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := auth.TenantUUIDFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
			return
		}
		db := core.GetDB()
		protocol, ok := protocolTenantScoped(db, c, tenantID)
		if !ok {
			return
		}

		var attachments []models.ProtocolAttachment
		db.Where(`"protocolId" = ?`, protocol.ID).Order(`"createdAt" ASC`).Find(&attachments)
		c.JSON(http.StatusOK, attachments)
	}
}

// handleUploadAttachments — POST /helpdesk/protocols/:id/attachments
// (multipart/form-data, campo "files", múltiplos arquivos).
func handleUploadAttachments(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := auth.TenantUUIDFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
			return
		}
		db := core.GetDB()
		protocol, ok := protocolTenantScoped(db, c, tenantID)
		if !ok {
			return
		}

		form, err := c.MultipartForm()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid multipart form"})
			return
		}

		created := saveUploadedAttachments(db, protocol.ID, form.File["files"])
		c.JSON(http.StatusCreated, created)
	}
}

// saveUploadedAttachments persiste cada arquivo via mediastore.SaveMediaReader
// (mesmo mecanismo de mídia de mensagens — content-addressed, sob
// /public/media) e cria a linha ProtocolAttachment ligada ao Protocol. Falha
// num arquivo (ilegível) só pula aquele item, não aborta o lote inteiro.
func saveUploadedAttachments(db *gorm.DB, protocolID int, files []*multipart.FileHeader) []models.ProtocolAttachment {
	created := make([]models.ProtocolAttachment, 0, len(files))
	for _, header := range files {
		file, err := header.Open()
		if err != nil {
			continue
		}
		mimeType := header.Header.Get("Content-Type")
		url, err := mediastore.SaveMediaReader(file, mimeType)
		_ = file.Close()
		if err != nil || url == "" {
			continue
		}

		attachment := models.ProtocolAttachment{
			ProtocolID: protocolID,
			FileName:   header.Filename,
			URL:        url,
			MimeType:   mimeType,
		}
		if err := db.Create(&attachment).Error; err != nil {
			continue
		}
		created = append(created, attachment)
	}
	return created
}

// handleDeleteAttachment — DELETE /helpdesk/protocols/:id/attachments/:attachmentId
func handleDeleteAttachment(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := auth.TenantUUIDFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
			return
		}
		db := core.GetDB()
		protocol, ok := protocolTenantScoped(db, c, tenantID)
		if !ok {
			return
		}

		result := db.Where(`id = ? AND "protocolId" = ?`, c.Param("attachmentId"), protocol.ID).
			Delete(&models.ProtocolAttachment{})
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete attachment"})
			return
		}
		if result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "attachment not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"deleted": true})
	}
}
