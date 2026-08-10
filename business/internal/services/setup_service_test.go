package services

import (
	"context"
	"errors"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func newSetupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	return testutil.NewTestDB(t)
}

func seedPermissions(t *testing.T, db *gorm.DB) {
	t.Helper()
	perms := []models.Permission{
		{Resource: "tickets", Action: "read", IsSystem: true},
		{Resource: "tickets", Action: "create", IsSystem: true},
		{Resource: "tickets", Action: "update", IsSystem: true},
		{Resource: "contacts", Action: "read", IsSystem: true},
		{Resource: "contacts", Action: "create", IsSystem: true},
		{Resource: "contacts", Action: "update", IsSystem: true},
		{Resource: "settings", Action: "update", IsSystem: true},
	}
	if err := db.Create(&perms).Error; err != nil {
		t.Fatalf("seed permissions: %v", err)
	}
}

func TestSetupServiceInitializeTenantCreatesAtomicDayZeroWorkspace(t *testing.T) {
	db := newSetupTestDB(t)
	seedPermissions(t, db)

	svc := NewSetupService(db)
	err := svc.InitializeTenant(TenantSeedData{
		CompanyName: "Acme Ltda",
		FirstName:   "Maria",
		LastName:    "Silva",
		Email:       "maria@example.com",
		Password:    "secret123",
		Document:    "12345678000199",
		BackendURL:  "https://api.example.com",
	})
	if err != nil {
		t.Fatalf("InitializeTenant: %v", err)
	}

	// Tenant
	var tenant models.Tenant
	if err := db.First(&tenant).Error; err != nil {
		t.Fatalf("tenant not created: %v", err)
	}
	if tenant.ID == uuid.Nil {
		t.Fatal("tenant ID must not be zero")
	}
	if tenant.Name != "Acme Ltda" {
		t.Fatalf("tenant name: got %q, want %q", tenant.Name, "Acme Ltda")
	}
	if tenant.Status != "active" || tenant.Document != "12345678000199" {
		t.Fatalf("tenant unexpected: %+v", tenant)
	}

	// Subscription
	var sub models.TenantSubscription
	if err := db.First(&sub, `"tenantId" = ?`, tenant.ID).Error; err != nil {
		t.Fatalf("subscription not created: %v", err)
	}
	if sub.Status != "active" {
		t.Fatalf("subscription status: got %q", sub.Status)
	}

	// User
	var user models.User
	if err := db.First(&user, "email = ?", "maria@example.com").Error; err != nil {
		t.Fatalf("user not created: %v", err)
	}
	if user.TenantID != tenant.ID {
		t.Fatalf("user tenantId mismatch: got %s, want %s", user.TenantID, tenant.ID)
	}
	// alcance="plataforma": quem roda o wizard local é o dono/operador desta
	// instalação, precisa das seções superadmin-only de Configurações
	// (Armazenamento, Modo SaaS) desde o primeiro login — distinto de
	// ProvisionTenant (control plane SaaS), que continua criando "tenant".
	if user.Alcance != "plataforma" {
		t.Fatalf("user alcance: got %q, want plataforma", user.Alcance)
	}
	if user.CargoID == nil {
		t.Fatal("user cargoId must not be nil")
	}
	if !user.CheckPassword("secret123") {
		t.Fatal("user password check failed")
	}

	// Owner
	if tenant.OwnerID == nil || *tenant.OwnerID != user.ID {
		t.Fatalf("tenant ownerId not set correctly: got %v, want %d", tenant.OwnerID, user.ID)
	}

	// Cargo Administrador deve ter TODAS as permissions do catálogo (7 seeded)
	var assigned int64
	if err := db.Table("cargo_permissoes").Where(`"cargoId" = ?`, *user.CargoID).Count(&assigned).Error; err != nil {
		t.Fatalf("count cargo permissions: %v", err)
	}
	if assigned != 7 {
		t.Fatalf("expected 7 cargo permissions, got %d", assigned)
	}

	// Setor "Geral" criado e vinculado ao Administrador como gestor
	var setor models.Setor
	if err := db.First(&setor, `"tenantId" = ? AND name = ?`, tenant.ID, "Geral").Error; err != nil {
		t.Fatalf("default setor not created: %v", err)
	}
	var userSetor models.UserSetor
	if err := db.First(&userSetor, "\"userId\" = ? AND \"setorId\" = ?", user.ID, setor.ID).Error; err != nil {
		t.Fatalf("user_setores link not created: %v", err)
	}
	if !userSetor.EhGestor {
		t.Fatal("expected Administrador to be marked ehGestor on default Setor")
	}

	// Queue
	var queue models.Queue
	if err := db.First(&queue, `"tenantId" = ? AND name = ?`, tenant.ID, "Atendimento Inicial").Error; err != nil {
		t.Fatalf("default queue not created: %v", err)
	}
	if queue.Color == "" || queue.DistributionStrategy != "MANUAL" {
		t.Fatalf("unexpected queue: %+v", queue)
	}

	// Tag
	var tag models.Tag
	if err := db.First(&tag, `"tenantId" = ? AND name = ?`, tenant.ID, "Novo Cliente").Error; err != nil {
		t.Fatalf("default tag not created: %v", err)
	}
	if tag.Color != "#28a745" {
		t.Fatalf("tag color: got %q, want #28a745", tag.Color)
	}

	// Settings
	var backend models.Setting
	if err := db.First(&backend, `"tenantId" = ? AND key = ?`, tenant.ID, "backendUrl").Error; err != nil {
		t.Fatalf("backendUrl setting not created: %v", err)
	}
	if backend.Value != "https://api.example.com" {
		t.Fatalf("backendUrl value: got %q", backend.Value)
	}

	var sysTitle models.Setting
	if err := db.First(&sysTitle, `"tenantId" = ? AND key = ?`, tenant.ID, "systemTitle").Error; err != nil {
		t.Fatalf("systemTitle setting not created: %v", err)
	}
	if sysTitle.Value != "Watink" {
		t.Fatalf("systemTitle value: got %q", sysTitle.Value)
	}
}

func TestSetupServiceInitializeTenantRollsBackOnFailure(t *testing.T) {
	db := newSetupTestDB(t)

	// Sabotage: drop Queues so transaction will fail at the Day-0 Queue step
	if err := db.Exec(`DROP TABLE "Queues"`).Error; err != nil {
		t.Fatalf("drop queues: %v", err)
	}

	svc := NewSetupService(db)
	err := svc.InitializeTenant(TenantSeedData{
		FirstName: "Fail",
		Email:     "fail@example.com",
		Password:  "secret123",
	})
	if err == nil {
		t.Fatal("expected error from InitializeTenant")
	}

	// Verify full rollback: no orphans
	for _, table := range []string{"Tenants", "Users", "Cargos", "Setores", "Settings", "Tags"} {
		var count int64
		if err := db.Table(table).Count(&count).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			t.Fatalf("count %s: %v", table, err)
		}
		if count != 0 {
			t.Fatalf("expected rollback to leave %s empty, got %d rows", table, count)
		}
	}
}

func TestSetupService_NeedsSetup_True(t *testing.T) {
	db := newSetupTestDB(t)
	svc := NewSetupService(db)

	needs, err := svc.NeedsSetup(context.Background())
	if err != nil {
		t.Fatalf("NeedsSetup: %v", err)
	}
	if !needs {
		t.Fatal("expected NeedsSetup=true when DB is empty")
	}
}

func TestSetupService_NeedsSetup_False(t *testing.T) {
	db := newSetupTestDB(t)
	seedPermissions(t, db)

	svc := NewSetupService(db)
	if err := svc.InitializeTenant(TenantSeedData{
		FirstName: "Ana",
		Email:     "ana@example.com",
		Password:  "pass123",
	}); err != nil {
		t.Fatalf("InitializeTenant: %v", err)
	}

	needs, err := svc.NeedsSetup(context.Background())
	if err != nil {
		t.Fatalf("NeedsSetup: %v", err)
	}
	if needs {
		t.Fatal("expected NeedsSetup=false when tenant exists")
	}
}

func TestSetupServiceDoubleSetupPrevention(t *testing.T) {
	db := newSetupTestDB(t)
	seedPermissions(t, db)

	svc := NewSetupService(db)
	err := svc.InitializeTenant(TenantSeedData{
		FirstName: "First",
		Email:     "first@example.com",
		Password:  "secret123",
	})
	if err != nil {
		t.Fatalf("first setup: %v", err)
	}

	// Second setup with same email should fail (unique constraint)
	err = svc.InitializeTenant(TenantSeedData{
		FirstName: "Second",
		Email:     "first@example.com",
		Password:  "secret456",
	})
	if err == nil {
		t.Fatal("expected error on duplicate setup (unique email)")
	}
}

// =====================================================================
// PushSubscription — reconcileDeactivations (issue #622)
// =====================================================================

func seedTenantForReconciliation(t *testing.T, db *gorm.DB) uuid.UUID {
	t.Helper()
	tenant := models.Tenant{Name: "Reconcile Co"}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("seed tenant: %v", err)
	}
	return tenant.ID
}

func seedActiveInstallation(t *testing.T, db *gorm.DB, tenantID uuid.UUID, slug string) {
	t.Helper()
	if err := db.Exec(
		`INSERT INTO "PluginInstallations" ("id","tenantId","pluginId","active","activatedAt","createdAt","updatedAt") VALUES (gen_random_uuid(), ?, ?, true, now(), now(), now())`,
		tenantID, slug,
	).Error; err != nil {
		t.Fatalf("seed installation %s: %v", slug, err)
	}
}

func installationActive(t *testing.T, db *gorm.DB, tenantID uuid.UUID, slug string) bool {
	t.Helper()
	var inst models.PluginInstallation
	if err := db.Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, slug).First(&inst).Error; err != nil {
		t.Fatalf("installation %s not found: %v", slug, err)
	}
	return inst.Active
}

func TestPushSubscription_PlanOnly_DeactivatesProPluginNotEntitled(t *testing.T) {
	db := newSetupTestDB(t)
	tenantID := seedTenantForReconciliation(t, db)
	seedActiveInstallation(t, db, tenantID, "helpdesk")
	if err := db.Create(&models.InstancePolicy{MarketplaceMode: "plan_only"}).Error; err != nil {
		t.Fatalf("seed instance policy: %v", err)
	}

	svc := NewSetupService(db)
	spec := domain.ProvisionPlanSpec{Name: "Basic", PluginEntitlements: []string{}}
	if err := svc.PushSubscription(tenantID, spec, "active", nil); err != nil {
		t.Fatalf("PushSubscription: %v", err)
	}

	if installationActive(t, db, tenantID, "helpdesk") {
		t.Fatal("helpdesk should have been deactivated (pro, absent from new plan's entitlements)")
	}
}

func TestPushSubscription_PlanOnly_KeepsEntitledPluginActive(t *testing.T) {
	db := newSetupTestDB(t)
	tenantID := seedTenantForReconciliation(t, db)
	seedActiveInstallation(t, db, tenantID, "helpdesk")
	if err := db.Create(&models.InstancePolicy{MarketplaceMode: "plan_only"}).Error; err != nil {
		t.Fatalf("seed instance policy: %v", err)
	}

	svc := NewSetupService(db)
	spec := domain.ProvisionPlanSpec{Name: "Pro", PluginEntitlements: []string{"helpdesk"}}
	if err := svc.PushSubscription(tenantID, spec, "active", nil); err != nil {
		t.Fatalf("PushSubscription: %v", err)
	}

	if !installationActive(t, db, tenantID, "helpdesk") {
		t.Fatal("helpdesk should remain active (still in the new plan's entitlements)")
	}
}

func TestPushSubscription_SelfService_NeverDeactivates(t *testing.T) {
	db := newSetupTestDB(t)
	tenantID := seedTenantForReconciliation(t, db)
	seedActiveInstallation(t, db, tenantID, "helpdesk")
	// Sem InstancePolicy nem SAAS_INTERNAL_TOKEN -> self_service (default).

	svc := NewSetupService(db)
	spec := domain.ProvisionPlanSpec{Name: "Basic", PluginEntitlements: []string{}}
	if err := svc.PushSubscription(tenantID, spec, "active", nil); err != nil {
		t.Fatalf("PushSubscription: %v", err)
	}

	if !installationActive(t, db, tenantID, "helpdesk") {
		t.Fatal("self_service mode must never touch allocations via reconciliation")
	}
}
