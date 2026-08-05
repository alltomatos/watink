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

// GroupsMode="selective": a group must be BOTH explicitly activated
// (AssistantGroup.Active) AND the Assistant @-mentioned to get a reply —
// otherwise it just observes. These three tests pin that contract.

func TestAssistantRuntime_Selective_InactiveGroupIsBlocked(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	a := models.Assistant{
		TenantID: tenantID, Name: "Teste", Mode: models.AssistantModePersona,
		Active: true, GroupsMode: models.AssistantGroupsModeSelective,
	}
	require.NoError(t, db.Create(&a).Error)

	contact := models.Contact{TenantID: tenantID, Name: "Grupo Teste", Number: "123-group@g.us", IsGroup: true}
	require.NoError(t, db.Create(&contact).Error)
	// No AssistantGroup row at all → inactive by default.

	r := NewAssistantRuntime(db, nil, nil)
	st := &flow.ExecState{TenantID: tenantID, Contact: &domain.Contact{ID: contact.ID, IsGroup: true}}

	outcome, err := r.Execute(context.Background(), st, a.ID)
	require.NoError(t, err)
	require.Equal(t, "assistant: grupo não ativado", outcome.Detail)
}

func TestAssistantRuntime_Selective_ActiveGroupWithoutMentionOnlyObserves(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	wa := models.Whatsapp{TenantID: tenantID, Number: "5511999999999"}
	require.NoError(t, db.Create(&wa).Error)

	whatsAppID := wa.ID
	a := models.Assistant{
		TenantID: tenantID, Name: "Teste", Mode: models.AssistantModePersona,
		Active: true, GroupsMode: models.AssistantGroupsModeSelective, WhatsAppID: &whatsAppID,
	}
	require.NoError(t, db.Create(&a).Error)

	contact := models.Contact{TenantID: tenantID, Name: "Grupo Teste", Number: "123-group@g.us", IsGroup: true}
	require.NoError(t, db.Create(&contact).Error)
	require.NoError(t, db.Create(&models.AssistantGroup{
		TenantID: tenantID, AssistantID: a.ID, ContactID: contact.ID, Active: true,
	}).Error)

	r := NewAssistantRuntime(db, nil, nil)
	st := &flow.ExecState{
		TenantID: tenantID,
		Contact:  &domain.Contact{ID: contact.ID, IsGroup: true},
		// No mention on this message.
	}

	outcome, err := r.Execute(context.Background(), st, a.ID)
	require.NoError(t, err)
	require.Equal(t, "assistant: grupo ativo, mas sem menção — apenas observando", outcome.Detail)
}

func TestAssistantRuntime_Selective_ActiveGroupWithMentionReachesPersona(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	wa := models.Whatsapp{TenantID: tenantID, Number: "5511999999999"}
	require.NoError(t, db.Create(&wa).Error)

	whatsAppID := wa.ID
	a := models.Assistant{
		TenantID: tenantID, Name: "Teste", Mode: models.AssistantModePersona,
		Active: true, GroupsMode: models.AssistantGroupsModeSelective, WhatsAppID: &whatsAppID,
	}
	require.NoError(t, db.Create(&a).Error)

	contact := models.Contact{TenantID: tenantID, Name: "Grupo Teste", Number: "123-group@g.us", IsGroup: true}
	require.NoError(t, db.Create(&contact).Error)
	require.NoError(t, db.Create(&models.AssistantGroup{
		TenantID: tenantID, AssistantID: a.ID, ContactID: contact.ID, Active: true,
	}).Error)

	r := NewAssistantRuntime(db, nil, nil)
	st := &flow.ExecState{
		TenantID:      tenantID,
		Contact:       &domain.Contact{ID: contact.ID, IsGroup: true},
		MentionedJIDs: []string{"5511999999999@s.whatsapp.net"},
	}

	outcome, err := r.Execute(context.Background(), st, a.ID)
	require.NoError(t, err)
	// Reaches executePersona's own early-return (no config set, so
	// cfg.AiGatewayID==0 is the first thing it checks), proving the
	// group/mention gate let it through instead of blocking beforehand.
	require.Equal(t, "assistant(persona): sem AiGateway configurado", outcome.Detail)
}
