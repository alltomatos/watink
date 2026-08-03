package plugins

import (
	"net/http"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// Found live in homolog: deleting an Assistant that had at least one
// AssistantGroup row (group visibility toggled at least once) failed with a
// foreign key violation (23503) — DeleteAssistant cleaned up
// AssistantRouterOptions and the synthetic Flow, but never AssistantGroups.
func TestAssistantController_Delete_RemovesAssistantGroupsFirst(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	a := models.Assistant{
		TenantID: tenantID, Name: "Teste", Mode: models.AssistantModePersona,
		GroupsMode: models.AssistantGroupsModeSelective,
	}
	require.NoError(t, db.Create(&a).Error)

	contact := models.Contact{TenantID: tenantID, Name: "Grupo", Number: "123-group@g.us", IsGroup: true}
	require.NoError(t, db.Create(&contact).Error)
	require.NoError(t, db.Create(&models.AssistantGroup{
		TenantID: tenantID, AssistantID: a.ID, ContactID: contact.ID, Active: true,
	}).Error)

	ac := NewAssistantController()
	c, w := newHandlerTestContext(t, http.MethodDelete, "/assistants/"+itoa(a.ID), nil, db, tenantID)
	c.Params = gin.Params{{Key: "id", Value: itoa(a.ID)}}

	ac.Delete(c)

	require.Equal(t, http.StatusOK, w.Code, "delete should succeed, body: %s", w.Body.String())

	var count int64
	require.NoError(t, db.Model(&models.AssistantGroup{}).Where(`"assistantId" = ?`, a.ID).Count(&count).Error)
	require.Zero(t, count, "AssistantGroup rows should be gone too")
}
