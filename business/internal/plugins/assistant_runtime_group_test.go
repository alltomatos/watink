package plugins

import (
	"context"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// Found live in homolog: an Assistant with IgnoreGroups=true kept answering
// real WhatsApp group messages — the field was persisted and shown in the UI
// toggle but never checked anywhere in the dispatch path. These tests pin the
// fix at AssistantRuntime.Execute, the single entry point every Mode
// (persona/pipeline/flow/router) funnels through.
func TestAssistantRuntime_Execute_IgnoreGroupsBlocksGroupMessage(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	a := models.Assistant{
		TenantID: tenantID, Name: "Teste", Mode: models.AssistantModePersona,
		Active: true, IgnoreGroups: true,
	}
	require.NoError(t, db.Create(&a).Error)

	r := NewAssistantRuntime(db)
	st := &flow.ExecState{
		TenantID: tenantID,
		Contact:  &domain.Contact{IsGroup: true},
	}

	outcome, err := r.Execute(context.Background(), st, a.ID)
	require.NoError(t, err)
	require.Equal(t, flow.OutcomeAdvance, outcome.Kind)
	require.Equal(t, "assistant: ignora grupos", outcome.Detail)
}

// A non-group contact must reach the mode-specific logic (proven here by the
// persona branch's own "sem AiGateway configurado" advance, distinct from the
// "ignora grupos" detail above) — the check must not block 1:1 conversations.
func TestAssistantRuntime_Execute_IgnoreGroupsAllowsDirectMessage(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	a := models.Assistant{
		TenantID: tenantID, Name: "Teste", Mode: models.AssistantModePersona,
		Active: true, IgnoreGroups: true,
	}
	require.NoError(t, db.Create(&a).Error)

	r := NewAssistantRuntime(db)
	st := &flow.ExecState{
		TenantID: tenantID,
		Contact:  &domain.Contact{IsGroup: false},
	}

	outcome, err := r.Execute(context.Background(), st, a.ID)
	require.NoError(t, err)
	require.Equal(t, flow.OutcomeAdvance, outcome.Kind)
	require.NotEqual(t, "assistant: ignora grupos", outcome.Detail)
}

// IgnoreGroups=false must never block a group message either.
func TestAssistantRuntime_Execute_GroupsAllowedWhenIgnoreGroupsFalse(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	a := models.Assistant{
		TenantID: tenantID, Name: "Teste", Mode: models.AssistantModePersona,
		Active: true, IgnoreGroups: false,
	}
	require.NoError(t, db.Create(&a).Error)
	// IgnoreGroups has `gorm:"default:true"` — GORM omits a Go zero value
	// (false) from the INSERT and lets Postgres apply the column default
	// instead, so Create(&a) above actually persists true regardless of the
	// struct literal. Force it explicitly to test the false case for real.
	require.NoError(t, db.Model(&a).Update("ignoreGroups", false).Error)

	r := NewAssistantRuntime(db)
	st := &flow.ExecState{
		TenantID: tenantID,
		Contact:  &domain.Contact{IsGroup: true},
	}

	outcome, err := r.Execute(context.Background(), st, a.ID)
	require.NoError(t, err)
	require.NotEqual(t, "assistant: ignora grupos", outcome.Detail)
}
