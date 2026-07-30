package controllers

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/aiclient"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PipelineController encapsulates pipeline operations with RLS-scoped DB from auth middleware.
// All queries are automatically tenant-scoped via auth.GetScoped.
type PipelineController struct{}

func NewPipelineController() *PipelineController {
	return &PipelineController{}
}

// @Summary      Listar pipelines
// @Tags         pipelines
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Security     BearerAuth
// @Router       /pipelines [get]
func (pc *PipelineController) List(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Pipelines")
	if !ok {
		return
	}

	var pipelines []models.Pipeline
	if err := db.Where("\"tenantId\" = ?", tenantID).Preload("Stages").Find(&pipelines).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListPipelines")
		return
	}

	if err := attachDealMetrics(db, tenantID, pipelines); err != nil {
		utils.RespondWithInternalError(c, err, "ListPipelines")
		return
	}

	c.JSON(200, pipelines)
}

// attachDealMetrics populates DealsCount/DealsValue on each pipeline with a
// single GROUP BY query (never one query per pipeline) so the listing card
// can show quick metrics without an N+1.
func attachDealMetrics(db *gorm.DB, tenantID uuid.UUID, pipelines []models.Pipeline) error {
	if len(pipelines) == 0 {
		return nil
	}

	var rows []struct {
		PipelineID int
		Count      int64
		Total      float64
	}
	err := db.Raw(`
		SELECT ps."pipelineId" AS pipeline_id,
		       COUNT(d.id)     AS count,
		       COALESCE(SUM(d.value), 0) AS total
		FROM "Deals" d
		JOIN "PipelineStages" ps ON ps.id = d."stageId"
		JOIN "Pipelines" p ON p.id = ps."pipelineId"
		WHERE p."tenantId" = ?
		GROUP BY ps."pipelineId"
	`, tenantID).Scan(&rows).Error
	if err != nil {
		return err
	}

	metrics := make(map[int]struct {
		count int64
		total float64
	}, len(rows))
	for _, r := range rows {
		metrics[r.PipelineID] = struct {
			count int64
			total float64
		}{r.Count, r.Total}
	}

	for i := range pipelines {
		if m, ok := metrics[pipelines[i].ID]; ok {
			pipelines[i].DealsCount = m.count
			pipelines[i].DealsValue = m.total
		}
	}
	return nil
}

// @Summary      Importar pipeline
// @Tags         pipelines
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados do pipeline"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /pipelines/import [post]
func (pc *PipelineController) Import(c *gin.Context) {
	pc.Create(c)
}

// @Summary      Exportar pipeline
// @Tags         pipelines
// @Produce      json
// @Param        pipelineId  path      int  true  "ID do pipeline"
// @Success      200         {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /pipelines/export/{pipelineId} [get]
func (pc *PipelineController) Export(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Pipelines")
	if !ok {
		return
	}
	id := c.Param("pipelineId")

	var pipeline models.Pipeline
	if err := db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).Preload("Stages").First(&pipeline).Error; err != nil {
		c.JSON(404, gin.H{"error": "Pipeline not found"})
		return
	}

	c.JSON(200, pipeline)
}

// @Summary      Sugestão IA de pipeline
// @Description  Gera sugestão de pipeline com IA baseada em contexto de atendimento
// @Tags         pipelines
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Mensagens de contexto"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /pipelines/ai-suggest [post]
// pipelineAIFormatRule instrui o LLM a responder em JSON com etapas CURTAS (nomes
// de coluna de kanban) e as dicas no campo message — evita os nomes de etapa
// verbosos (o LLM tende a despejar a descrição inteira no nome da etapa).
const pipelineAIFormatRule = `As etapas (stages) são NOMES CURTOS de coluna de kanban (1 a 4 palavras, ex.: "Atração", "Qualificação", "Proposta", "Fechamento", "Pós-venda") — NUNCA coloque descrições ou frases no nome da etapa; toda a explicação e as dicas vão no campo "message". Sugira entre 3 e 7 etapas. Responda SEMPRE em JSON válido, sem nenhum texto fora do JSON, no formato: {"message": "explicação e dicas em português", "stages": ["Atração", "Qualificação", "Proposta", "Fechamento"]}.`

func (pc *PipelineController) AISuggest(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Settings")
	if !ok {
		return
	}

	var req struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	// Load AI settings for this tenant
	var settings []models.Setting
	db.Where("\"tenantId\" = ? AND key IN ?", tenantID,
		[]string{"aiEnabled", "aiPipelineEnabled", "aiProvider", "aiModel", "aiApiKey", "aiCustomBaseURL", "aiGuidePrompt"},
	).Find(&settings)

	settingMap := make(map[string]string, len(settings))
	for _, s := range settings {
		settingMap[s.Key] = s.Value
	}

	if settingMap["aiEnabled"] != "true" || settingMap["aiPipelineEnabled"] != "true" {
		c.JSON(400, gin.H{"error": "ERR_AI_DISABLED"})
		return
	}

	apiKey := settingMap["aiApiKey"]
	if strings.TrimSpace(apiKey) == "" {
		c.JSON(400, gin.H{"error": "ERR_NO_AI_API_KEY"})
		return
	}

	provider := settingMap["aiProvider"]
	if provider == "" {
		provider = "openai"
	}
	if provider == "custom" && strings.TrimSpace(settingMap["aiCustomBaseURL"]) == "" {
		c.JSON(400, gin.H{"error": "ERR_NO_AI_BASE_URL"})
		return
	}

	// Build system prompt
	systemPrompt := settingMap["aiGuidePrompt"]
	if systemPrompt == "" {
		systemPrompt = "Voce e um assistente especializado em fluxos de negocio. " +
			"Quando o usuario descrever um fluxo ou contexto, sugira etapas de pipeline adequadas e de dicas no campo message. " +
			pipelineAIFormatRule
	} else {
		systemPrompt += "\n\n" + pipelineAIFormatRule
	}

	// Convert messages
	var msgs []aiclient.Message
	if provider != "anthropic" {
		msgs = append(msgs, aiclient.Message{Role: "system", Content: systemPrompt})
	}
	for _, m := range req.Messages {
		role := m.Role
		if role == "ai" {
			role = "assistant"
		}
		msgs = append(msgs, aiclient.Message{Role: role, Content: m.Content})
	}

	cfg := aiclient.Config{
		Provider: provider,
		Model:    settingMap["aiModel"],
		APIKey:   apiKey,
		BaseURL:  settingMap["aiCustomBaseURL"],
		System:   systemPrompt,
	}

	result, err := aiclient.Complete(cfg, msgs)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "ERR_NO_AI_API_KEY") {
			c.JSON(400, gin.H{"error": "ERR_NO_AI_API_KEY"})
		} else {
			c.JSON(502, gin.H{"error": fmt.Sprintf("ERR_AI_SERVICE_FAILED: %s", errMsg)})
		}
		return
	}

	// Parse JSON response from LLM
	var parsed struct {
		Message string   `json:"message"`
		Stages  []string `json:"stages"`
	}
	content := strings.TrimSpace(result.Content)
	// Strip markdown code fences if present
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	if err := json.Unmarshal([]byte(content), &parsed); err != nil || len(parsed.Stages) == 0 {
		// Fallback: return raw content as message, no stages
		c.JSON(200, gin.H{
			"message": result.Content,
			"stages":  []string{},
		})
		return
	}

	c.JSON(200, gin.H{
		"message": parsed.Message,
		"stages":  parsed.Stages,
	})
}

type createPipelineInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Stages      []struct {
		Name string `json:"name"`
	} `json:"stages"`
}

type updatePipelineInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Stages      []struct {
		Name string `json:"name"`
	} `json:"stages"`
}
