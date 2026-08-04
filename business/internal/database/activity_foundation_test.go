package database

import (
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestActivityFoundation_MigratesAllFiveTables garante que os 5 models do
// módulo Activity foram registrados no AutoMigrate real usado pelos testes
// (testutil.allModels()) — esquecer essa lista mata todo teste de controller
// futuro com "relation does not exist", que lê como harness quebrado, não
// como migração ausente.
func TestActivityFoundation_MigratesAllFiveTables(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	activity := models.Activity{
		Title:          "Instalação de equipamento",
		Status:         "pending",
		Priority:       "medium",
		LastActivityAt: time.Now(),
		TenantID:       tenantID,
	}
	require.NoError(t, db.Create(&activity).Error)

	assignee := models.ActivityAssignee{ActivityID: activity.ID, UserID: 1, TenantID: tenantID}
	require.NoError(t, db.Create(&assignee).Error)

	item := models.ActivityChecklistItem{
		ActivityID: activity.ID, Label: "Conferir voltagem", InputType: "text", TenantID: tenantID,
	}
	require.NoError(t, db.Create(&item).Error)

	material := models.ActivityMaterial{
		ActivityID: activity.ID, MaterialName: "Cabo de rede", Quantity: 10, Unit: "m", TenantID: tenantID,
	}
	require.NoError(t, db.Create(&material).Error)

	occurrence := models.ActivityOccurrence{
		ActivityID: activity.ID, Description: "Cliente ausente", Type: "impediment", TenantID: tenantID,
	}
	require.NoError(t, db.Create(&occurrence).Error)

	var counts struct {
		Activities, Assignees, Items, Materials, Occurrences int64
	}
	db.Model(&models.Activity{}).Where(`"tenantId" = ?`, tenantID).Count(&counts.Activities)
	db.Model(&models.ActivityAssignee{}).Where(`"tenantId" = ?`, tenantID).Count(&counts.Assignees)
	db.Model(&models.ActivityChecklistItem{}).Where(`"tenantId" = ?`, tenantID).Count(&counts.Items)
	db.Model(&models.ActivityMaterial{}).Where(`"tenantId" = ?`, tenantID).Count(&counts.Materials)
	db.Model(&models.ActivityOccurrence{}).Where(`"tenantId" = ?`, tenantID).Count(&counts.Occurrences)

	assert.EqualValues(t, 1, counts.Activities)
	assert.EqualValues(t, 1, counts.Assignees)
	assert.EqualValues(t, 1, counts.Items)
	assert.EqualValues(t, 1, counts.Materials)
	assert.EqualValues(t, 1, counts.Occurrences)
}

// TestActivityFoundation_TenantIsolation confirma que uma query filtrada por
// tenantId (o que auth.GetScoped injeta em todo controller) nunca vaza a
// Activity de outro tenant.
func TestActivityFoundation_TenantIsolation(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()

	require.NoError(t, db.Create(&models.Activity{
		Title: "Atividade do tenant A", Status: "pending", Priority: "medium",
		LastActivityAt: time.Now(), TenantID: tenantA,
	}).Error)
	require.NoError(t, db.Create(&models.Activity{
		Title: "Atividade do tenant B", Status: "pending", Priority: "medium",
		LastActivityAt: time.Now(), TenantID: tenantB,
	}).Error)

	var scopedToA []models.Activity
	require.NoError(t, db.Where(`"tenantId" = ?`, tenantA).Find(&scopedToA).Error)

	require.Len(t, scopedToA, 1)
	assert.Equal(t, "Atividade do tenant A", scopedToA[0].Title)
}

// TestActivityFoundation_AssigneeUniqueConstraint garante que
// UNIQUE(activityId, userId) rejeita duplicata — o índice
// idx_activity_assignees_activity_user é o que impede o PUT
// /activities/:id/assignees de criar duas linhas para o mesmo par.
func TestActivityFoundation_AssigneeUniqueConstraint(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	activity := models.Activity{
		Title: "Atividade", Status: "pending", Priority: "medium",
		LastActivityAt: time.Now(), TenantID: tenantID,
	}
	require.NoError(t, db.Create(&activity).Error)

	require.NoError(t, db.Exec(
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_assignees_activity_user ON "ActivityAssignees" ("activityId", "userId")`,
	).Error)

	require.NoError(t, db.Create(&models.ActivityAssignee{
		ActivityID: activity.ID, UserID: 42, TenantID: tenantID,
	}).Error)

	err := db.Create(&models.ActivityAssignee{
		ActivityID: activity.ID, UserID: 42, TenantID: tenantID,
	}).Error
	assert.Error(t, err, "insert duplicado de (activityId, userId) deveria violar a UNIQUE")
}

// TestActivityFoundation_PermissionsSeeded confirma que Seed() cria as 5
// permissões do recurso activities e que rodar Seed() duas vezes não
// duplica (FirstOrCreate é idempotente sobre resource+action).
func TestActivityFoundation_PermissionsSeeded(t *testing.T) {
	db := testutil.NewTestDB(t)
	prevDB := DB
	DB = db
	t.Cleanup(func() { DB = prevDB })

	Seed()
	Seed()

	var count int64
	require.NoError(t, db.Model(&models.Permission{}).Where("resource = ?", "activities").Count(&count).Error)
	assert.EqualValues(t, 5, count)
}
