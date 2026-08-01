package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// FlowController encapsulates flow operations with RLS-scoped DB from auth middleware.
// All queries are automatically tenant-scoped via auth.GetScoped(c, "Flows").
//
// runtime drives on-demand run starts (POST /flows/:id/run); it may be nil in
// tests that don't exercise that endpoint.
type FlowController struct {
	runtime *flow.Skeleton
}

func NewFlowController(runtime *flow.Skeleton) *FlowController {
	return &FlowController{runtime: runtime}
}

// maxFlowJSONSize caps the size of nodes/edges JSON blobs to 1 MiB.
const maxFlowJSONSize = 1 << 20

// flowInput is the Create payload (Name required).
type flowInput struct {
	Name       string         `json:"name" binding:"required"`
	Nodes      datatypes.JSON `json:"nodes"`
	Edges      datatypes.JSON `json:"edges"`
	Active     bool           `json:"active"`
	WhatsAppID *int           `json:"whatsappId"`
}

// flowUpdateInput is the Update payload. All fields are pointers so an omitted
// field is preserved (partial PATCH) instead of being zeroed — fixing the data
// loss where Save() of the whole struct wiped Nodes/Edges/Active (FB0-B1).
type flowUpdateInput struct {
	Name       *string         `json:"name"`
	Nodes      *datatypes.JSON `json:"nodes"`
	Edges      *datatypes.JSON `json:"edges"`
	Active     *bool           `json:"active"`
	WhatsAppID *int            `json:"whatsappId"`
}

// validateFlowGraph parses nodes+edges into the versioned FlowGraph contract and
// validates it (ADR 0013). On a contract breach it writes HTTP 422 and returns
// false; on an unknown future schemaVersion it also writes 422. Absence of
// schemaVersion defaults to v1 (handled in flow.ParseGraph) — not an error.
func validateFlowGraph(c *gin.Context, nodes, edges datatypes.JSON) bool {
	graph, err := flow.ParseGraph(nodes, edges)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return false
	}
	if err := graph.Validate(); err != nil {
		var verr *flow.ValidationError
		switch {
		case errors.Is(err, flow.ErrUnknownSchemaVersion):
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "unknown flow graph schemaVersion"})
		case errors.As(err, &verr):
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": verr.Error()})
		default:
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "invalid flow graph"})
		}
		return false
	}
	return true
}

// projectFlowTrigger parses nodes+edges into the FlowGraph contract and projects
// the entry/trigger node onto the flat (triggerType, triggerValue) columns. A
// parse failure or an absent entry node yields a zero projection (empty columns)
// — the graph was already validated for persistence by validateFlowGraph.
func projectFlowTrigger(nodes, edges datatypes.JSON) flow.TriggerProjection {
	graph, err := flow.ParseGraph(nodes, edges)
	if err != nil {
		return flow.TriggerProjection{}
	}
	return flow.ProjectTrigger(graph)
}

// guardActivation blocks ACTIVATING a flow whose effective graph contains a node
// type the engine cannot execute (no registered executor) — such a flow would
// abort its run silently at runtime (interpreter MustGet). When activating is
// true and unsupported nodes exist, it writes HTTP 422 and returns false. It is
// a no-op (returns true) when the flow is not being activated.
func guardActivation(c *gin.Context, activating bool, nodes, edges datatypes.JSON) bool {
	if !activating {
		return true
	}
	graph, err := flow.ParseGraph(nodes, edges)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return false
	}
	if unsupported := flow.UnsupportedNodeTypes(graph); len(unsupported) > 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error":            "Não é possível ativar o fluxo: estes nós ainda não são executáveis pelo motor — " + strings.Join(unsupported, ", "),
			"code":             "ERR_NODES_NOT_EXECUTABLE",
			"unsupportedNodes": unsupported,
		})
		return false
	}
	return true
}

// @Summary      Listar flows
// @Tags         flows
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Security     BearerAuth
// @Router       /flows [get]
func (fc *FlowController) List(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Flows")
	if !ok {
		return
	}

	var flows []models.Flow
	// internal=false: hide plugin-generated synthetic Flows (Assistentes de
	// IA, ADR 0027) from the normal listing — they are not user-authored.
	if err := db.Preload("Whatsapp").Where("\"tenantId\" = ? AND internal = false", tenantID).Find(&flows).Error; err != nil {
		utils.RespondWithInternalError(c, err, "Failed to fetch flows")
		return
	}

	c.JSON(http.StatusOK, flows)
}

// @Summary      Criar flow
// @Tags         flows
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Dados do flow"
// @Success      200   {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /flows [post]
func (fc *FlowController) Create(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Flows")
	if !ok {
		return
	}

	var req flowInput
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	flowName, err := utils.ValidateStringField(req.Name, "name", 255)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Nodes) > maxFlowJSONSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "field 'nodes' exceeds maximum allowed size of 1 MiB"})
		return
	}
	if len(req.Edges) > maxFlowJSONSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "field 'edges' exceeds maximum allowed size of 1 MiB"})
		return
	}

	// FB0-B4: reject malformed/illegal graphs with 422 before persisting.
	if !validateFlowGraph(c, req.Nodes, req.Edges) {
		return
	}

	// Activation guard: a flow created ACTIVE must be fully executable.
	if !guardActivation(c, req.Active, req.Nodes, req.Edges) {
		return
	}

	// FB1-T1: project the graph's entry/trigger node onto the flat
	// triggerType/triggerValue columns the runtime matches against.
	proj := projectFlowTrigger(req.Nodes, req.Edges)

	// The flow-level whatsappId (set in the editor toolbar) is the source of truth
	// for the connection binding — a flow may be created with none and bound later.
	whatsappID := req.WhatsAppID

	flow := models.Flow{
		Name:            flowName,
		Nodes:           req.Nodes,
		Edges:           req.Edges,
		Active:          req.Active,
		WhatsAppID:      whatsappID,
		TriggerType:     proj.Type,
		TriggerValue:    proj.Value,
		TriggerOperator: proj.Operator,
		TenantID:        tenantID,
	}

	if err := db.Create(&flow).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreateFlow")
		return
	}

	// Reload with the connection preloaded so the response carries whatsapp.name.
	if err := db.Preload("Whatsapp").Where("\"tenantId\" = ? AND id = ?", tenantID, flow.ID).First(&flow).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreateFlowReload")
		return
	}

	c.JSON(http.StatusOK, flow)
}

// @Summary      Detalhar flow
// @Tags         flows
// @Produce      json
// @Param        flowId  path      int  true  "ID do flow"
// @Success      200     {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /flows/{flowId} [get]
func (fc *FlowController) Show(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Flows")
	if !ok {
		return
	}
	id := c.Param("flowId")

	var flow models.Flow
	if err := db.Preload("Whatsapp").Where("\"tenantId\" = ? AND id = ?", tenantID, id).First(&flow).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Flow not found"})
		return
	}

	c.JSON(http.StatusOK, flow)
}

// @Summary      Atualizar flow
// @Tags         flows
// @Accept       json
// @Produce      json
// @Param        flowId  path      int                     true  "ID do flow"
// @Param        body    body      map[string]interface{}  true  "Campos a atualizar"
// @Success      200     {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /flows/{flowId} [put]
//
// Update applies a PARTIAL PATCH: only the fields present in the body are
// changed. Omitted fields (nodes/edges/active/name and the
// triggerType/triggerValue/whatsappId/timestamps not exposed here) are
// preserved — never zeroed (FB0-B1).
func (fc *FlowController) Update(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Flows")
	if !ok {
		return
	}
	id := c.Param("flowId")

	var existing models.Flow
	if err := db.Where("\"tenantId\" = ? AND id = ?", tenantID, id).First(&existing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Flow not found"})
		return
	}

	var req flowUpdateInput
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	// Detecta se o request incluiu explicitamente "whatsappId" (mesmo null), para o
	// editor poder ATRELAR, TROCAR ou DESATRELAR (detach) a conexão — vs um PATCH que
	// omite o campo (preserva). Um *int sozinho não distingue null de ausente.
	var present map[string]json.RawMessage
	_ = c.ShouldBindBodyWith(&present, binding.JSON)
	_, whatsappProvided := present["whatsappId"]

	// Build the partial update set; only present fields are touched.
	updates := map[string]interface{}{}

	if req.Name != nil {
		flowName, err := utils.ValidateStringField(*req.Name, "name", 255)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		updates["name"] = flowName
	}

	// Effective graph = incoming field if present, else the persisted value.
	// Re-validate the resulting graph so a partial edit can't yield an illegal one.
	effNodes := existing.Nodes
	effEdges := existing.Edges
	graphTouched := false

	if req.Nodes != nil {
		if len(*req.Nodes) > maxFlowJSONSize {
			c.JSON(http.StatusBadRequest, gin.H{"error": "field 'nodes' exceeds maximum allowed size of 1 MiB"})
			return
		}
		effNodes = *req.Nodes
		updates["nodes"] = *req.Nodes
		graphTouched = true
	}
	if req.Edges != nil {
		if len(*req.Edges) > maxFlowJSONSize {
			c.JSON(http.StatusBadRequest, gin.H{"error": "field 'edges' exceeds maximum allowed size of 1 MiB"})
			return
		}
		effEdges = *req.Edges
		updates["edges"] = *req.Edges
		graphTouched = true
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	// Conexão: o editor é a fonte da verdade. Presente (valor ou null) → grava;
	// ausente → preserva. req.WhatsAppID é *int → GORM grava o valor ou NULL (detach).
	if whatsappProvided {
		updates["whatsappId"] = req.WhatsAppID
	}

	// FB0-B4: only re-validate the graph when nodes/edges are part of this PATCH.
	if graphTouched && !validateFlowGraph(c, effNodes, effEdges) {
		return
	}

	// FB1-T1: re-project the trigger columns whenever the graph changed, so an
	// edit to the entry/trigger node is reflected in the runtime match.
	if graphTouched {
		proj := projectFlowTrigger(effNodes, effEdges)
		updates["triggerType"] = proj.Type
		updates["triggerValue"] = proj.Value
		updates["triggerOperator"] = proj.Operator
		// A conexão NÃO vem mais do nó de gatilho — é o editor (toolbar) quem define
		// o whatsappId do fluxo (ver bloco de presença acima).
	}

	// Activation guard: block turning a flow ACTIVE while its effective graph
	// has a node the engine can't execute (would abort the run at runtime).
	if !guardActivation(c, req.Active != nil && *req.Active, effNodes, effEdges) {
		return
	}

	if len(updates) == 0 {
		// Nothing to change — return the current record untouched.
		c.JSON(http.StatusOK, existing)
		return
	}

	// Session(NewDB:true) — never reuse the scoped db for writes. Model+Updates
	// of a map writes ONLY the listed columns, preserving every other field
	// (triggerType/triggerValue/whatsappId/createdAt and any omitted graph blob).
	if err := db.Session(&gorm.Session{NewDB: true}).
		Model(&models.Flow{}).
		Where("\"tenantId\" = ? AND id = ?", tenantID, existing.ID).
		Updates(updates).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateFlow")
		return
	}

	// Re-read so the response reflects the merged record (preserved + patched),
	// with the connection preloaded so the card can show whatsapp.name.
	var updated models.Flow
	if err := db.Preload("Whatsapp").Where("\"tenantId\" = ? AND id = ?", tenantID, existing.ID).First(&updated).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateFlowReload")
		return
	}

	c.JSON(http.StatusOK, updated)
}

// @Summary      Remover flow
// @Tags         flows
// @Produce      json
// @Param        flowId  path      int  true  "ID do flow"
// @Success      200     {object}  map[string]string
// @Security     BearerAuth
// @Router       /flows/{flowId} [delete]
func (fc *FlowController) Delete(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Flows")
	if !ok {
		return
	}
	id := c.Param("flowId")

	result := db.Where("\"tenantId\" = ? AND id = ?", tenantID, id).Delete(&models.Flow{})
	if result.Error != nil {
		utils.RespondWithInternalError(c, result.Error, "DeleteFlow")
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Flow not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Flow deleted successfully"})
}
