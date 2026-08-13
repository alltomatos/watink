package services

import (
	"sync"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// capturingBroadcaster is a local mock (no global state), per project
// convention — records every EmitToTenantRoom call for assertion.
type capturingBroadcaster struct {
	mu     sync.Mutex
	events []capturedEvent
}

type capturedEvent struct {
	tenantID string
	event    string
	payload  interface{}
}

func (b *capturingBroadcaster) EmitToRoom(_, _, _ string, _ interface{}) {}
func (b *capturingBroadcaster) EmitToTenantRoom(tenantID, event string, payload interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.events = append(b.events, capturedEvent{tenantID: tenantID, event: event, payload: payload})
}
func (b *capturingBroadcaster) EmitToNamespace(_, _ string, _ interface{}) {}

func TestInventoryService_RegisterMovement_INThenOUT(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	warehouse := models.Warehouse{TenantID: tenantID, Name: "Armazém Principal", IsActive: true}
	require.NoError(t, db.Create(&warehouse).Error)
	product := models.Product{TenantID: tenantID, Name: "Produto Teste", Unit: "UN"}
	require.NoError(t, db.Create(&product).Error)
	sku := models.ProductSKU{ProductID: product.ID, SKUCode: "SKU-1", MinQuantity: 5}
	require.NoError(t, db.Create(&sku).Error)

	svc := NewInventoryService(db, &capturingBroadcaster{})

	_, err := svc.RegisterMovement(MovementInput{
		TenantID: tenantID, WarehouseID: warehouse.ID, SKUID: sku.ID,
		MovementType: "IN", Quantity: 10, OriginType: "MANUAL",
	})
	require.NoError(t, err)

	var balance models.WarehouseBalance
	require.NoError(t, db.Where(`"warehouseId" = ? AND "skuId" = ?`, warehouse.ID, sku.ID).First(&balance).Error)
	assert.Equal(t, float64(10), balance.CurrentBalance)

	_, err = svc.RegisterMovement(MovementInput{
		TenantID: tenantID, WarehouseID: warehouse.ID, SKUID: sku.ID,
		MovementType: "OUT", Quantity: 3, OriginType: "MANUAL",
	})
	require.NoError(t, err)

	require.NoError(t, db.Where(`"warehouseId" = ? AND "skuId" = ?`, warehouse.ID, sku.ID).First(&balance).Error)
	assert.Equal(t, float64(7), balance.CurrentBalance)

	var count int64
	db.Model(&models.InventoryMovement{}).Where(`"tenantId" = ?`, tenantID).Count(&count)
	assert.Equal(t, int64(2), count)
}

func TestInventoryService_RegisterMovement_RejectsNegativeBalance(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	warehouse := models.Warehouse{TenantID: tenantID, Name: "Armazém Principal", IsActive: true}
	require.NoError(t, db.Create(&warehouse).Error)
	product := models.Product{TenantID: tenantID, Name: "Produto Teste", Unit: "UN"}
	require.NoError(t, db.Create(&product).Error)
	sku := models.ProductSKU{ProductID: product.ID, SKUCode: "SKU-1"}
	require.NoError(t, db.Create(&sku).Error)

	svc := NewInventoryService(db, &capturingBroadcaster{})

	_, err := svc.RegisterMovement(MovementInput{
		TenantID: tenantID, WarehouseID: warehouse.ID, SKUID: sku.ID,
		MovementType: "OUT", Quantity: 1, OriginType: "MANUAL",
	})
	assert.ErrorIs(t, err, ErrInsufficientStock)

	var balance models.WarehouseBalance
	err = db.Where(`"warehouseId" = ? AND "skuId" = ?`, warehouse.ID, sku.ID).First(&balance).Error
	// Either no row was created, or it stayed at zero — either way, never negative.
	if err == nil {
		assert.Equal(t, float64(0), balance.CurrentBalance)
	}
}

func TestInventoryService_RegisterMovement_EmitsLowStockEvent(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	warehouse := models.Warehouse{TenantID: tenantID, Name: "Armazém Principal", IsActive: true}
	require.NoError(t, db.Create(&warehouse).Error)
	product := models.Product{TenantID: tenantID, Name: "Produto Teste", Unit: "UN"}
	require.NoError(t, db.Create(&product).Error)
	sku := models.ProductSKU{ProductID: product.ID, SKUCode: "SKU-1", MinQuantity: 5}
	require.NoError(t, db.Create(&sku).Error)

	broadcaster := &capturingBroadcaster{}
	svc := NewInventoryService(db, broadcaster)

	_, err := svc.RegisterMovement(MovementInput{
		TenantID: tenantID, WarehouseID: warehouse.ID, SKUID: sku.ID,
		MovementType: "IN", Quantity: 10, OriginType: "MANUAL",
	})
	require.NoError(t, err)
	assert.Empty(t, broadcaster.events, "balance above MinQuantity must not emit low_stock")

	_, err = svc.RegisterMovement(MovementInput{
		TenantID: tenantID, WarehouseID: warehouse.ID, SKUID: sku.ID,
		MovementType: "OUT", Quantity: 8, OriginType: "MANUAL",
	})
	require.NoError(t, err)

	require.Len(t, broadcaster.events, 1)
	assert.Equal(t, "inventory.low_stock", broadcaster.events[0].event)
	assert.Equal(t, tenantID.String(), broadcaster.events[0].tenantID)
}

func TestInventoryService_RegisterMovement_ConcurrentOUTsNeverGoNegative(t *testing.T) {
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()

	warehouse := models.Warehouse{TenantID: tenantID, Name: "Armazém Principal", IsActive: true}
	require.NoError(t, db.Create(&warehouse).Error)
	product := models.Product{TenantID: tenantID, Name: "Produto Teste", Unit: "UN"}
	require.NoError(t, db.Create(&product).Error)
	sku := models.ProductSKU{ProductID: product.ID, SKUCode: "SKU-1"}
	require.NoError(t, db.Create(&sku).Error)

	svc := NewInventoryService(db, &capturingBroadcaster{})
	require.NoError(t, db.Create(&models.WarehouseBalance{WarehouseID: warehouse.ID, SKUID: sku.ID, CurrentBalance: 10}).Error)

	const attempts = 10
	var wg sync.WaitGroup
	successCount := int32(0)
	var mu sync.Mutex
	wg.Add(attempts)
	for i := 0; i < attempts; i++ {
		go func() {
			defer wg.Done()
			_, err := svc.RegisterMovement(MovementInput{
				TenantID: tenantID, WarehouseID: warehouse.ID, SKUID: sku.ID,
				MovementType: "OUT", Quantity: 3, OriginType: "MANUAL",
			})
			if err == nil {
				mu.Lock()
				successCount++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	var balance models.WarehouseBalance
	require.NoError(t, db.Where(`"warehouseId" = ? AND "skuId" = ?`, warehouse.ID, sku.ID).First(&balance).Error)
	assert.GreaterOrEqual(t, balance.CurrentBalance, float64(0), "balance must never go negative under concurrency")
	// 10 units, 3 per OUT: at most 3 can succeed (9 consumed), never 4 (would be -2).
	assert.LessOrEqual(t, successCount, int32(3))
}
