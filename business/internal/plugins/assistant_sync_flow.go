package plugins

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// syntheticFlowName is deterministic per Assistant — used to find/upsert its
// synthetic Flow without a dedicated FK column (ADR 0027).
func syntheticFlowName(assistantID int) string {
	return fmt.Sprintf("__assistant_%d", assistantID)
}

// syntheticGraph builds the 2-node FlowGraph (trigger → assistant) that lets
// the Assistant reuse the FlowBuilder's trigger-matching/debounce/session
// runtime instead of duplicating it (ADR 0027 "Flow sintético").
func syntheticGraph(a models.Assistant) ([]byte, []byte, error) {
	var whatsappID *string
	if a.WhatsAppID != nil {
		s := strconv.Itoa(*a.WhatsAppID)
		whatsappID = &s
	}

	type condition struct {
		Field    string `json:"field"`
		Operator string `json:"operator"`
		Value    string `json:"value"`
	}
	type triggerData struct {
		TriggerType string      `json:"triggerType"`
		WhatsAppID  *string     `json:"whatsappId"`
		Conditions  []condition `json:"conditions"`
	}

	td := triggerData{WhatsAppID: whatsappID}
	if a.TriggerType == "keyword" && strings.TrimSpace(a.TriggerValue) != "" {
		td.TriggerType = "keyword"
		td.Conditions = []condition{{Field: "lastInput", Operator: "contains", Value: a.TriggerValue}}
	} else {
		td.TriggerType = "any"
	}
	triggerDataJSON, err := json.Marshal(td)
	if err != nil {
		return nil, nil, err
	}

	assistantDataJSON, err := json.Marshal(map[string]int{"assistantId": a.ID})
	if err != nil {
		return nil, nil, err
	}

	nodes := []map[string]json.RawMessage{
		{"id": json.RawMessage(`"assistant-trigger"`), "type": json.RawMessage(`"start"`), "data": triggerDataJSON},
		{"id": json.RawMessage(`"assistant-node"`), "type": json.RawMessage(`"assistant"`), "data": assistantDataJSON},
	}
	edges := []map[string]string{
		{"id": "assistant-edge-1", "source": "assistant-trigger", "target": "assistant-node"},
	}

	nodesJSON, err := json.Marshal(nodes)
	if err != nil {
		return nil, nil, err
	}
	edgesJSON, err := json.Marshal(edges)
	if err != nil {
		return nil, nil, err
	}
	return nodesJSON, edgesJSON, nil
}

// assistantFlowTrigger projects the Assistant's trigger fields onto the flat
// (type,value) columns the runtime's matchTriggers reads — mirrors
// flow.ProjectTrigger's "keyword" case (case-insensitive contains). Operators
// other than contains land in a later issue (flow/trigger.go matcher
// extension); until then a non-contains operator degrades to match-any,
// never silently matching the wrong thing.
func assistantFlowTrigger(a models.Assistant) (triggerType, triggerValue string) {
	if a.TriggerType == "keyword" && a.TriggerOperator == "contains" && strings.TrimSpace(a.TriggerValue) != "" {
		return flow.TriggerWhatsAppMessage, strings.ToLower(strings.TrimSpace(a.TriggerValue))
	}
	return flow.TriggerWhatsAppMessage, ""
}

// syncSyntheticFlow upserts the Assistant's synthetic Flow to reflect its
// current connection/trigger/active state. Called after every
// Create/Update/Delete in AssistantController. tx should be the same
// transaction the Assistant write happened in when available (nil = use db
// directly, e.g. Delete's fire-and-forget best effort).
func syncSyntheticFlow(db *gorm.DB, tenantID uuid.UUID, a models.Assistant) error {
	nodesJSON, edgesJSON, err := syntheticGraph(a)
	if err != nil {
		return err
	}
	triggerType, triggerValue := assistantFlowTrigger(a)

	var existing models.Flow
	name := syntheticFlowName(a.ID)
	err = db.Where(`"tenantId" = ? AND name = ? AND internal = true`, tenantID, name).First(&existing).Error

	fields := map[string]interface{}{
		"name":         name,
		"nodes":        datatypes.JSON(nodesJSON),
		"edges":        datatypes.JSON(edgesJSON),
		"triggerType":  triggerType,
		"triggerValue": triggerValue,
		"whatsappId":   a.WhatsAppID,
		"active":       a.Active,
		"internal":     true,
	}

	if err == gorm.ErrRecordNotFound {
		newFlow := models.Flow{
			Name: name, TenantID: tenantID, Internal: true,
			Nodes: datatypes.JSON(nodesJSON), Edges: datatypes.JSON(edgesJSON),
			TriggerType: triggerType, TriggerValue: triggerValue,
			WhatsAppID: a.WhatsAppID, Active: a.Active,
		}
		return db.Create(&newFlow).Error
	}
	if err != nil {
		return err
	}
	return db.Session(&gorm.Session{NewDB: true}).Model(&models.Flow{}).
		Where(`id = ? AND "tenantId" = ?`, existing.ID, tenantID).Updates(fields).Error
}

// deleteSyntheticFlow removes the Assistant's synthetic Flow (called from
// AssistantController.Delete).
func deleteSyntheticFlow(db *gorm.DB, tenantID uuid.UUID, assistantID int) error {
	return db.Session(&gorm.Session{NewDB: true}).
		Where(`"tenantId" = ? AND name = ? AND internal = true`, tenantID, syntheticFlowName(assistantID)).
		Delete(&models.Flow{}).Error
}
