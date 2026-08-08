package services

import (
	"errors"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// --- Test helpers ---

func setupPlanLimitDB(t *testing.T) *gorm.DB {
	t.Helper()
	return testutil.NewTestDB(t)
}

func seedPlanLimitData(db *gorm.DB, tenantID uuid.UUID, pluginQuota int, pluginCount int) {
	seedPlanWithLimits(db, tenantID, planLimits{pluginQuota: pluginQuota})
	for i := 0; i < pluginCount; i++ {
		pi := map[string]interface{}{
			"id":       uuid.New().String(),
			"tenantId": tenantID.String(),
			"pluginId": uuid.New().String(),
			"active":   true,
		}
		db.Table("PluginInstallations").Create(&pi)
	}
}

type planLimits struct {
	usersLimit       int
	connectionsLimit int
	queuesLimit      int
	pluginQuota      int
}

// seedPlanWithLimits cria Plan+TenantSubscription("active") com os limites
// informados -- 0 em qualquer campo é a convenção de ilimitado do domínio.
func seedPlanWithLimits(db *gorm.DB, tenantID uuid.UUID, limits planLimits) {
	plan := map[string]interface{}{
		"name":             "Pro-" + tenantID.String(),
		"usersLimit":       limits.usersLimit,
		"connectionsLimit": limits.connectionsLimit,
		"queuesLimit":      limits.queuesLimit,
		"pluginQuota":      limits.pluginQuota,
		"active":           true,
	}
	db.Table("Plans").Create(&plan)
	var planID int
	db.Raw(`SELECT LASTVAL()`).Scan(&planID)

	sub := map[string]interface{}{
		"id":       uuid.New().String(),
		"tenantId": tenantID.String(),
		"planId":   planID,
		"status":   "active",
	}
	db.Table("TenantSubscriptions").Create(&sub)
}

// --- Tests ---

func TestPlanLimitService_NoSubscription_CoreResourcesUnlimited(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()

	// Sem subscription (instância não gerida por Watink SaaS) -- fail-open,
	// preserva o comportamento histórico de "sempre ilimitado".
	for _, resource := range []string{"users", "connections", "queues"} {
		if err := svc.CheckLimit(tenantID, resource); err != nil {
			t.Errorf("CheckLimit(%q) should fail-open without a subscription, got error: %v", resource, err)
		}
	}
}

func TestPlanLimitService_Plugins_NoSubscription_Rejected(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()

	err := svc.CheckLimit(tenantID, "plugins")
	if err == nil {
		t.Fatal("expected error when no active subscription exists")
	}
	if err.Error() != "active subscription required for plugin features" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestPlanLimitService_Plugins_WithinQuota_Allowed(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()

	// Plan allows 5 plugins, tenant has 3 installed
	seedPlanLimitData(db, tenantID, 5, 3)

	if err := svc.CheckLimit(tenantID, "plugins"); err != nil {
		t.Errorf("expected plugin check to pass (3/5), got: %v", err)
	}
}

func TestPlanLimitService_Plugins_QuotaExceeded_Rejected(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()

	// Plan allows 3 plugins, tenant already has 3 installed
	seedPlanLimitData(db, tenantID, 3, 3)

	err := svc.CheckLimit(tenantID, "plugins")
	if err == nil {
		t.Fatal("expected quota exceeded error")
	}
}

func TestPlanLimitService_Plugins_ZeroQuota_Unlimited(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()

	// PluginQuota=0 means unlimited per Plan model logic
	seedPlanLimitData(db, tenantID, 0, 10)

	if err := svc.CheckLimit(tenantID, "plugins"); err != nil {
		t.Errorf("quota=0 means unlimited, got: %v", err)
	}
}

func TestPlanLimitService_Plugins_CrossTenant_Isolation(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)

	tenantA := uuid.New()
	tenantB := uuid.New()

	// Tenant A: quota=2, 2 plugins installed (at limit)
	seedPlanLimitData(db, tenantA, 2, 2)

	// Tenant B: quota=5, 1 plugin installed
	seedPlanLimitData(db, tenantB, 5, 1)

	// Tenant A should be blocked
	if err := svc.CheckLimit(tenantA, "plugins"); err == nil {
		t.Error("tenant A should hit quota limit")
	}

	// Tenant B should be allowed
	if err := svc.CheckLimit(tenantB, "plugins"); err != nil {
		t.Errorf("tenant B should pass (1/5), got: %v", err)
	}
}

func TestPlanLimitService_UnknownResource_NoSubscription_Allowed(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()

	// Só "plugins" exige subscription resolvível; qualquer outro resource
	// (conhecido ou não) sem subscription é fail-open.
	if err := svc.CheckLimit(tenantID, "premium_feature"); err != nil {
		t.Errorf("unknown resource without subscription should pass, got: %v", err)
	}
}

func TestPlanLimitService_UnknownResource_WithSubscription_Allowed(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()

	// Has subscription but unknown resource falls through switch → nil
	seedPlanLimitData(db, tenantID, 5, 0)

	if err := svc.CheckLimit(tenantID, "premium_feature"); err != nil {
		t.Errorf("unknown resource with subscription should pass, got: %v", err)
	}
}

// =====================================================================
// users/connections/queues — enforcement real (issue integration-core.md §2.2)
// =====================================================================

func seedUsers(t *testing.T, db *gorm.DB, tenantID uuid.UUID, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		u := models.User{
			Name:         "User",
			Email:        uuid.New().String() + "@example.com",
			PasswordHash: "x",
			TenantID:     tenantID,
		}
		if err := db.Create(&u).Error; err != nil {
			t.Fatalf("seed user: %v", err)
		}
	}
}

func seedWhatsapps(t *testing.T, db *gorm.DB, tenantID uuid.UUID, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		w := models.Whatsapp{Name: "wa-" + uuid.New().String(), TenantID: tenantID}
		if err := db.Create(&w).Error; err != nil {
			t.Fatalf("seed whatsapp: %v", err)
		}
	}
}

func seedQueues(t *testing.T, db *gorm.DB, tenantID uuid.UUID, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		q := models.Queue{Name: "queue-" + uuid.New().String(), Color: "#000", TenantID: tenantID}
		if err := db.Create(&q).Error; err != nil {
			t.Fatalf("seed queue: %v", err)
		}
	}
}

func TestPlanLimitService_Users_WithinLimit_Allowed(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()
	seedPlanWithLimits(db, tenantID, planLimits{usersLimit: 5})
	seedUsers(t, db, tenantID, 3)

	if err := svc.CheckLimit(tenantID, "users"); err != nil {
		t.Errorf("expected 3/5 users to pass, got: %v", err)
	}
}

func TestPlanLimitService_Users_LimitReached_Rejected(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()
	seedPlanWithLimits(db, tenantID, planLimits{usersLimit: 3})
	seedUsers(t, db, tenantID, 3)

	err := svc.CheckLimit(tenantID, "users")
	if err == nil {
		t.Fatal("expected error at 3/3 users")
	}
	var limitErr *PlanLimitError
	if !errors.As(err, &limitErr) {
		t.Fatalf("expected *PlanLimitError, got %T: %v", err, err)
	}
	if limitErr.Resource != "users" || limitErr.Limit != 3 {
		t.Errorf("unexpected PlanLimitError: %+v", limitErr)
	}
}

func TestPlanLimitService_Users_ZeroLimit_Unlimited(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()
	seedPlanWithLimits(db, tenantID, planLimits{usersLimit: 0})
	seedUsers(t, db, tenantID, 50)

	if err := svc.CheckLimit(tenantID, "users"); err != nil {
		t.Errorf("usersLimit=0 means unlimited, got: %v", err)
	}
}

func TestPlanLimitService_Connections_LimitReached_Rejected(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()
	seedPlanWithLimits(db, tenantID, planLimits{connectionsLimit: 2})
	seedWhatsapps(t, db, tenantID, 2)

	err := svc.CheckLimit(tenantID, "connections")
	if err == nil {
		t.Fatal("expected error at 2/2 connections")
	}
}

func TestPlanLimitService_Queues_LimitReached_Rejected(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantID := uuid.New()
	seedPlanWithLimits(db, tenantID, planLimits{queuesLimit: 1})
	seedQueues(t, db, tenantID, 1)

	err := svc.CheckLimit(tenantID, "queues")
	if err == nil {
		t.Fatal("expected error at 1/1 queues")
	}
}

func TestPlanLimitService_Users_CrossTenant_Isolation(t *testing.T) {
	db := setupPlanLimitDB(t)
	svc := NewPlanLimitService(db)
	tenantA := uuid.New()
	tenantB := uuid.New()
	seedPlanWithLimits(db, tenantA, planLimits{usersLimit: 1})
	seedUsers(t, db, tenantA, 1)
	seedPlanWithLimits(db, tenantB, planLimits{usersLimit: 5})
	seedUsers(t, db, tenantB, 1)

	if err := svc.CheckLimit(tenantA, "users"); err == nil {
		t.Error("tenant A should hit its limit")
	}
	if err := svc.CheckLimit(tenantB, "users"); err != nil {
		t.Errorf("tenant B should pass (1/5), got: %v", err)
	}
}
