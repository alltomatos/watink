package plugins

import (
	"net/http"
	"strconv"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/aiclient"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AiGatewayController manages the AI providers registered inside the
// "Assistentes de IA" plugin (Configurações → Agentes de IA). Distinct from
// omniroute (core, single endpoint for embeddings/RAG) — see CONTEXT.md.
//
// ApiKey is encrypted at rest via cryptobox (same primitive used by Proxy
// passwords and Client documents) and never serialized back to the client.
// Fail-closed: if the cryptobox master key is not configured, Create/Update
// refuse to persist the secret rather than falling back to plaintext.
type AiGatewayController struct{}

func NewAiGatewayController() *AiGatewayController { return &AiGatewayController{} }

func toAiGatewayResponse(g models.AiGateway) gin.H {
	return gin.H{
		"id":                 g.ID,
		"tenantId":           g.TenantID,
		"name":               g.Name,
		"provider":           g.Provider,
		"baseUrl":            g.BaseURL,
		"model":              g.Model,
		"transcriptionModel": g.TranscriptionModel,
		"speechModel":        g.SpeechModel,
		"hasApiKey":          g.HasApiKey(),
		"createdAt":          g.CreatedAt,
		"updatedAt":          g.UpdatedAt,
	}
}

// List returns the tenant's AiGateways.
func (ac *AiGatewayController) List(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "AiGateways")
	if !ok {
		return
	}
	var gateways []models.AiGateway
	if err := db.Where(`"tenantId" = ?`, tenantID).Order("id DESC").Find(&gateways).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListAiGateways")
		return
	}
	resp := make([]gin.H, len(gateways))
	for i := range gateways {
		resp[i] = toAiGatewayResponse(gateways[i])
	}
	c.JSON(http.StatusOK, resp)
}

// Get returns a single AiGateway of the tenant.
func (ac *AiGatewayController) Get(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "AiGateways")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var g models.AiGateway
	if err := db.Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&g).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "gateway de IA não encontrado"})
		return
	}
	c.JSON(http.StatusOK, toAiGatewayResponse(g))
}

type aiGatewayInput struct {
	Name               string  `json:"name"`
	Provider           string  `json:"provider"`
	ApiKey             string  `json:"apiKey"`
	BaseURL            *string `json:"baseUrl"`
	Model              string  `json:"model"`
	TranscriptionModel *string `json:"transcriptionModel"`
	SpeechModel        *string `json:"speechModel"`
}

func validateAiGatewayStrings(c *gin.Context, in aiGatewayInput) bool {
	for _, f := range []struct {
		v     string
		name  string
		limit int
	}{
		{in.Name, "name", 120},
		{in.Provider, "provider", 60},
		{in.Model, "model", 120},
		{in.ApiKey, "apiKey", 2048},
	} {
		if _, err := utils.ValidateStringField(f.v, f.name, f.limit); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return false
		}
	}
	return true
}

// Create inserts a new AiGateway. The API key, when provided, is encrypted
// at rest — fail-closed if the cryptobox master key is not configured.
func (ac *AiGatewayController) Create(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "AiGateways")
	if !ok {
		return
	}
	var in aiGatewayInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if !validateAiGatewayStrings(c, in) {
		return
	}

	enc := ""
	if in.ApiKey != "" {
		if !cryptobox.IsConfigured() {
			c.JSON(http.StatusInternalServerError, gin.H{"error": cryptobox.ErrNotConfigured.Error()})
			return
		}
		e, err := cryptobox.Encrypt(in.ApiKey)
		if err != nil {
			utils.RespondWithInternalError(c, err, "EncryptAiGatewayApiKey")
			return
		}
		enc = e
	}

	g := models.AiGateway{
		TenantID: tenantID, Name: in.Name, Provider: in.Provider,
		ApiKeyEnc: enc, BaseURL: in.BaseURL, Model: in.Model,
		TranscriptionModel: in.TranscriptionModel, SpeechModel: in.SpeechModel,
	}
	if err := db.Create(&g).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreateAiGateway")
		return
	}
	c.JSON(http.StatusOK, toAiGatewayResponse(g))
}

// Update edits an AiGateway. The API key is only re-encrypted when a new one
// is sent — an empty apiKey in the payload preserves the existing secret.
func (ac *AiGatewayController) Update(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "AiGateways")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var existing models.AiGateway
	if err := db.Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&existing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "gateway de IA não encontrado"})
		return
	}
	var in aiGatewayInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if !validateAiGatewayStrings(c, in) {
		return
	}

	fields := map[string]interface{}{
		"name":               in.Name,
		"provider":           in.Provider,
		"baseUrl":            in.BaseURL,
		"model":              in.Model,
		"transcriptionModel": in.TranscriptionModel,
		"speechModel":        in.SpeechModel,
	}
	if in.ApiKey != "" {
		if !cryptobox.IsConfigured() {
			c.JSON(http.StatusInternalServerError, gin.H{"error": cryptobox.ErrNotConfigured.Error()})
			return
		}
		enc, err := cryptobox.Encrypt(in.ApiKey)
		if err != nil {
			utils.RespondWithInternalError(c, err, "EncryptAiGatewayApiKey")
			return
		}
		fields["apiKeyEnc"] = enc
	}

	if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.AiGateway{}).
		Where(`id = ? AND "tenantId" = ?`, id, tenantID).Updates(fields).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateAiGateway")
		return
	}
	_ = db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&existing).Error
	c.JSON(http.StatusOK, toAiGatewayResponse(existing))
}

// testGatewayDefaultMessage is sent when the request body omits `message` —
// short enough to be cheap on every provider's pricing, distinctive enough
// that a wrong/truncated reply is obvious in the UI.
const testGatewayDefaultMessage = "Responda apenas com a palavra 'ok' para confirmar que a conexão está funcionando."

// Test performs a REAL completion call against the gateway's configured
// provider/model/baseURL using the stored (decrypted) API key — not a
// connectivity ping, an actual chat completion, so a wrong model name, an
// expired key or a wrong baseURL surface here exactly as they would during
// a real Assistant run. Never persists anything; safe to call repeatedly.
func (ac *AiGatewayController) Test(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "AiGateways")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var g models.AiGateway
	if err := db.Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&g).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "gateway de IA não encontrado"})
		return
	}
	if !g.HasApiKey() {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "gateway sem API Key configurada"})
		return
	}

	var body struct {
		Message string `json:"message"`
	}
	_ = c.ShouldBindJSON(&body)
	message := body.Message
	if message == "" {
		message = testGatewayDefaultMessage
	}
	if _, err := utils.ValidateStringField(message, "message", 2000); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	apiKey, err := cryptobox.Decrypt(g.ApiKeyEnc)
	if err != nil {
		utils.RespondWithInternalError(c, err, "DecryptAiGatewayApiKey")
		return
	}

	baseURL := ""
	if g.BaseURL != nil {
		baseURL = *g.BaseURL
	}
	started := time.Now()
	resp, err := aiclient.Complete(aiclient.Config{
		Provider: g.Provider,
		Model:    g.Model,
		APIKey:   apiKey,
		BaseURL:  baseURL,
	}, []aiclient.Message{{Role: "user", Content: message}})
	elapsedMs := time.Since(started).Milliseconds()
	if err != nil {
		// 200 (não 502) de propósito: resultado de teste válido, não erro de
		// transporte da nossa API — um status 5xx aqui faz o Cloudflare (na
		// frente do domínio) substituir o corpo JSON pela página de erro
		// genérica dele, escondendo a mensagem real (chave inválida, modelo
		// errado etc.). O cliente decide sucesso/falha por "success".
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"reply":     resp.Content,
		"elapsedMs": elapsedMs,
	})
}

// ListModels consulta {baseURL}/models do gateway com a chave já salva e
// devolve os IDs de modelo disponíveis — usado pela UI para popular sugestões
// reais nos campos de modelo (chat/transcrição/fala) em vez de só uma lista
// estática. Nunca persiste nada; requer API Key já configurada.
func (ac *AiGatewayController) ListModels(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "AiGateways")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var g models.AiGateway
	if err := db.Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&g).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "gateway de IA não encontrado"})
		return
	}
	if !g.HasApiKey() {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "gateway sem API Key configurada"})
		return
	}

	apiKey, err := cryptobox.Decrypt(g.ApiKeyEnc)
	if err != nil {
		utils.RespondWithInternalError(c, err, "DecryptAiGatewayApiKey")
		return
	}
	baseURL := ""
	if g.BaseURL != nil {
		baseURL = *g.BaseURL
	}
	modelsList, err := aiclient.ListModels(aiclient.Config{
		Provider: g.Provider,
		Model:    g.Model,
		APIKey:   apiKey,
		BaseURL:  baseURL,
	})
	if err != nil {
		// 200 de propósito, mesmo motivo do Test: não é erro de transporte da
		// nossa API, é resultado de uma chamada real ao gateway do tenant.
		c.JSON(http.StatusOK, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "models": modelsList})
}

// Delete removes an AiGateway of the tenant.
func (ac *AiGatewayController) Delete(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "AiGateways")
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	res := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).Delete(&models.AiGateway{})
	if res.Error != nil {
		utils.RespondWithInternalError(c, res.Error, "DeleteAiGateway")
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "gateway de IA não encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Gateway de IA removido"})
}
