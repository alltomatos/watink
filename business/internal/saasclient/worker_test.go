package saasclient

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// fakeProvisioner registra as chamadas feitas pelo executor — usado para
// provar que o comando decodificado do payload chega com os campos certos,
// sem precisar de um SetupService real (que faria I/O completo de tenant).
type fakeProvisioner struct {
	provisionCalls []domain.TenantSeedData
	provisionSpecs []domain.ProvisionPlanSpec
	pushCalls      []uuid.UUID
	pushStatus     []string
	err            error
}

func (f *fakeProvisioner) ProvisionTenant(data domain.TenantSeedData, spec domain.ProvisionPlanSpec, idempotencyKey string) (domain.ProvisionResult, error) {
	f.provisionCalls = append(f.provisionCalls, data)
	f.provisionSpecs = append(f.provisionSpecs, spec)
	if f.err != nil {
		return domain.ProvisionResult{}, f.err
	}
	return domain.ProvisionResult{TenantID: "tenant-1", OwnerUserID: 1}, nil
}

func (f *fakeProvisioner) PushSubscription(tenantID uuid.UUID, spec domain.ProvisionPlanSpec, status string, expiresAt *time.Time) error {
	f.pushCalls = append(f.pushCalls, tenantID)
	f.pushStatus = append(f.pushStatus, status)
	return f.err
}

func TestWorker_Execute_ComandoForaDaAllowlistNuncaExecuta(t *testing.T) {
	db := testutil.NewTestDB(t)
	prov := &fakeProvisioner{}
	w := NewWorker(nil, db, prov, "test")

	err := w.execute(SyncCommand{ID: "1", Command: "delete_everything", Payload: json.RawMessage(`{}`)})
	require.NoError(t, err) // "confirmado" sem executar — nunca reentrega um comando que nunca vai processar

	require.Empty(t, prov.provisionCalls, "comando fora da allowlist não deveria chegar ao provisioner")
	require.Empty(t, prov.pushCalls, "comando fora da allowlist não deveria chegar ao provisioner")
}

func TestWorker_ExecuteProvision_DecodificaEChamaSetupService(t *testing.T) {
	db := testutil.NewTestDB(t)
	prov := &fakeProvisioner{}
	w := NewWorker(nil, db, prov, "test")

	payload := `{
		"companyName":"Acme","firstName":"Ana","lastName":"Silva","email":"ana@acme.com",
		"password":"senha-forte-o-suficiente","document":"12345678900","idempotencyKey":"key-1",
		"plan":{"name":"Starter","usersLimit":5,"connectionsLimit":2,"queuesLimit":1,"pluginQuota":0,"price":49.9,"active":true}
	}`
	err := w.execute(SyncCommand{ID: "2", Command: "provision", Payload: json.RawMessage(payload)})
	require.NoError(t, err)

	require.Len(t, prov.provisionCalls, 1)
	require.Equal(t, "Acme", prov.provisionCalls[0].CompanyName)
	require.Equal(t, "ana@acme.com", prov.provisionCalls[0].Email)
	require.Equal(t, "Starter", prov.provisionSpecs[0].Name)
	require.Equal(t, 5, prov.provisionSpecs[0].UsersLimit)
}

func TestWorker_ExecuteSetStatus_AtualizaTenantDireto(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenant := models.Tenant{Name: "Tenant X", Status: "active"}
	require.NoError(t, db.Create(&tenant).Error)

	w := NewWorker(nil, db, &fakeProvisioner{}, "test")
	payload := `{"status":"suspended","reason":"inadimplência"}`
	err := w.execute(SyncCommand{ID: "3", Command: "set_status", TenantID: tenant.ID.String(), Payload: json.RawMessage(payload)})
	require.NoError(t, err)

	var reloaded models.Tenant
	require.NoError(t, db.First(&reloaded, "id = ?", tenant.ID).Error)
	require.Equal(t, "suspended", reloaded.Status)
}

func TestWorker_ExecutePushSubscription_ChamaProvisionerComTenantIDCorreto(t *testing.T) {
	db := testutil.NewTestDB(t)
	prov := &fakeProvisioner{}
	w := NewWorker(nil, db, prov, "test")

	tenantID := uuid.New()
	payload := `{"plan":{"name":"Pro"},"subscription":{"status":"active"}}`
	err := w.execute(SyncCommand{ID: "4", Command: "push_subscription", TenantID: tenantID.String(), Payload: json.RawMessage(payload)})
	require.NoError(t, err)

	require.Len(t, prov.pushCalls, 1)
	require.Equal(t, tenantID, prov.pushCalls[0])
	require.Equal(t, "active", prov.pushStatus[0])
}

func TestWorker_Tick_SemContratoConfiguradoNaoChamaRede(t *testing.T) {
	db := testutil.NewTestDB(t)
	w := NewWorker(services.NewSaaSContractService(db), db, &fakeProvisioner{}, "test")

	acks := w.tick(context.Background(), nil)
	require.Nil(t, acks, "sem pareamento, tick não deveria produzir acks nem tentar chamar o SaaS")
}
