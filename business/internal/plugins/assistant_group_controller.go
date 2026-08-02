package plugins

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AssistantGroupController manages per-group visibility for an Assistant in
// GroupsMode="selective" — the "duas colunas Inativo/Ativo" screen. Groups
// are only known once they've sent at least one message (Contact.IsGroup=
// true) — there is no separate WhatsApp group-listing integration yet.
type AssistantGroupController struct{}

func NewAssistantGroupController() *AssistantGroupController { return &AssistantGroupController{} }

type groupListItem struct {
	ContactID int    `json:"contactId"`
	Name      string `json:"name"`
	Number    string `json:"number"`
	Active    bool   `json:"active"`
}

// List returns every group Contact seen on the Assistant's connection, each
// flagged Active per its AssistantGroup row (absent row = false, the "todo
// grupo começa em Inativo" default) — the frontend splits this single list
// into the two columns.
func (gc *AssistantGroupController) List(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	assistantID, _ := strconv.Atoi(c.Param("id"))

	var a models.Assistant
	if err := db.Where(`id = ? AND "tenantId" = ?`, assistantID, tenantID).First(&a).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assistant não encontrado"})
		return
	}
	if a.WhatsAppID == nil {
		// No connection bound yet — a group belongs to exactly one
		// connection (only members of that number see it on WhatsApp), so
		// without a connection there is no group list to show.
		c.JSON(http.StatusOK, []groupListItem{})
		return
	}

	// Contact has no direct connection column — a group's connection is
	// derived from the Tickets it has on THIS Assistant's WhatsAppID.
	// Real WhatsApp groups only ever belong to one connection (server-side
	// membership), so this is the correct scope, not a tenant-wide list —
	// connection A must never see or activate connection B's groups.
	var contacts []models.Contact
	if err := db.Session(&gorm.Session{NewDB: true}).
		Distinct().
		Joins(`JOIN "Tickets" ON "Tickets"."contactId" = "Contacts".id`).
		Where(`"Contacts"."tenantId" = ? AND "Contacts"."isGroup" = true AND "Tickets"."whatsappId" = ?`, tenantID, *a.WhatsAppID).
		Find(&contacts).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListAssistantGroups: contacts")
		return
	}

	var activeRows []models.AssistantGroup
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`"tenantId" = ? AND "assistantId" = ? AND active = true`, tenantID, assistantID).
		Find(&activeRows).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListAssistantGroups: active")
		return
	}
	activeSet := make(map[int]bool, len(activeRows))
	for _, r := range activeRows {
		activeSet[r.ContactID] = true
	}

	items := make([]groupListItem, len(contacts))
	for i, ct := range contacts {
		items[i] = groupListItem{ContactID: ct.ID, Name: ct.Name, Number: ct.Number, Active: activeSet[ct.ID]}
	}
	c.JSON(http.StatusOK, items)
}

type toggleGroupInput struct {
	ContactID int  `json:"contactId"`
	Active    bool `json:"active"`
}

// Toggle activates/deactivates a single group for an Assistant — an
// upsert on AssistantGroup keyed by (tenantId, assistantId, contactId).
func (gc *AssistantGroupController) Toggle(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Assistants")
	if !ok {
		return
	}
	assistantID, _ := strconv.Atoi(c.Param("id"))

	var a models.Assistant
	if err := db.Where(`id = ? AND "tenantId" = ?`, assistantID, tenantID).First(&a).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assistant não encontrado"})
		return
	}

	var in toggleGroupInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if in.ContactID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "contactId é obrigatório"})
		return
	}
	if a.WhatsAppID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "assistant sem conexão configurada"})
		return
	}

	// The group must actually belong to THIS Assistant's connection (derived
	// via Tickets, same as List) — without this check, an operator could
	// activate a group from a DIFFERENT connection by guessing its
	// contactId, which would leak that group's messages to this Assistant.
	var contact models.Contact
	if err := db.Session(&gorm.Session{NewDB: true}).
		Distinct().
		Joins(`JOIN "Tickets" ON "Tickets"."contactId" = "Contacts".id`).
		Where(`"Contacts".id = ? AND "Contacts"."tenantId" = ? AND "Contacts"."isGroup" = true AND "Tickets"."whatsappId" = ?`,
			in.ContactID, tenantID, *a.WhatsAppID).
		First(&contact).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "grupo não encontrado nesta conexão"})
		return
	}

	// Explicit find-then-write instead of FirstOrCreate+Assign: AssistantGroup.
	// Active has gorm:"default:false" — GORM omits a Go zero value (false)
	// from an INSERT/struct-based UPDATE and lets the column default apply
	// instead, which would silently no-op a "deactivate" toggle. Update by
	// single column always sends the value regardless of zero-ness (same
	// lesson learned fixing the IgnoreGroups bug).
	var existing models.AssistantGroup
	findErr := db.Session(&gorm.Session{NewDB: true}).
		Where(`"tenantId" = ? AND "assistantId" = ? AND "contactId" = ?`, tenantID, assistantID, in.ContactID).
		First(&existing).Error
	switch {
	case errors.Is(findErr, gorm.ErrRecordNotFound):
		row := models.AssistantGroup{TenantID: tenantID, AssistantID: assistantID, ContactID: in.ContactID}
		if err := db.Session(&gorm.Session{NewDB: true}).Create(&row).Error; err != nil {
			utils.RespondWithInternalError(c, err, "ToggleAssistantGroup: create")
			return
		}
		if err := db.Session(&gorm.Session{NewDB: true}).Model(&row).Update("active", in.Active).Error; err != nil {
			utils.RespondWithInternalError(c, err, "ToggleAssistantGroup: set active")
			return
		}
	case findErr != nil:
		utils.RespondWithInternalError(c, findErr, "ToggleAssistantGroup: find")
		return
	default:
		if err := db.Session(&gorm.Session{NewDB: true}).Model(&existing).Update("active", in.Active).Error; err != nil {
			utils.RespondWithInternalError(c, err, "ToggleAssistantGroup: update")
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"contactId": in.ContactID, "active": in.Active})
}
