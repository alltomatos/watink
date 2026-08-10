package services

import (
	"errors"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
)

func TestSaaSContractService_GetWithoutPolicy_ReturnsNotConfigured(t *testing.T) {
	db := testutil.NewTestDB(t)
	svc := NewSaaSContractService(db)

	_, err := svc.Get()
	if !errors.Is(err, ErrSaaSContractNotConfigured) {
		t.Fatalf("expected ErrSaaSContractNotConfigured, got %v", err)
	}
}

func TestSaaSContractService_SetThenGet_RoundTrips(t *testing.T) {
	db := testutil.NewTestDB(t)
	svc := NewSaaSContractService(db)

	if err := svc.Set("https://saas.watink.com", "inst-123", "super-secret-token"); err != nil {
		t.Fatalf("Set: %v", err)
	}

	got, err := svc.Get()
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if !got.Paired() {
		t.Fatal("expected contract to be Paired() after Set")
	}
	if got.BaseURL != "https://saas.watink.com" || got.InstanceID != "inst-123" || got.InternalToken != "super-secret-token" {
		t.Fatalf("unexpected contract: %+v", got)
	}
	if got.PairedAt == nil {
		t.Fatal("expected PairedAt to be set")
	}

	// Token never persisted in plaintext.
	var policy models.InstancePolicy
	if err := db.First(&policy).Error; err != nil {
		t.Fatalf("load policy: %v", err)
	}
	if policy.SaasInternalTokenEnc == nil || *policy.SaasInternalTokenEnc == "super-secret-token" {
		t.Fatal("token must be encrypted at rest, never stored in plaintext")
	}
}

func TestSaaSContractService_Set_PreservesOriginalPairedAt(t *testing.T) {
	db := testutil.NewTestDB(t)
	svc := NewSaaSContractService(db)

	if err := svc.Set("https://saas.watink.com", "inst-123", "token-1"); err != nil {
		t.Fatalf("first Set: %v", err)
	}
	first, err := svc.Get()
	if err != nil {
		t.Fatalf("Get: %v", err)
	}

	if err := svc.Set("https://saas.watink.com", "inst-123", "token-2"); err != nil {
		t.Fatalf("second Set: %v", err)
	}
	second, err := svc.Get()
	if err != nil {
		t.Fatalf("Get: %v", err)
	}

	if !second.PairedAt.Equal(*first.PairedAt) {
		t.Fatalf("expected PairedAt to stay stable across re-pair, got %v then %v", first.PairedAt, second.PairedAt)
	}
	if second.InternalToken != "token-2" {
		t.Fatalf("expected token to be updated, got %q", second.InternalToken)
	}
}

func TestSaaSContractService_TouchSync_UpdatesOnlyLastSyncAt(t *testing.T) {
	db := testutil.NewTestDB(t)
	svc := NewSaaSContractService(db)

	if err := svc.Set("https://saas.watink.com", "inst-123", "token-1"); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if err := svc.TouchSync(); err != nil {
		t.Fatalf("TouchSync: %v", err)
	}

	got, err := svc.Get()
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.LastSyncAt == nil {
		t.Fatal("expected LastSyncAt to be set after TouchSync")
	}
	if got.InternalToken != "token-1" {
		t.Fatal("TouchSync must not change the token")
	}
}
