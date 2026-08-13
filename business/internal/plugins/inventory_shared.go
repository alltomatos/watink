package plugins

import (
	"errors"
	"fmt"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// errInsufficientStock mirrors services.ErrInsufficientStock. Duplicated
// deliberately, same reasoning as coreImpl.CreateActivity (manager.go):
// this package (plugins) is imported by internal/application/usecases, and
// internal/services is downstream of that same chain, so importing
// internal/services here would cycle the build. registerInventoryMovement
// below re-implements InventoryService.RegisterMovement's locking/audit
// logic against the raw *gorm.DB instead.
var errInsufficientStock = errors.New("saldo insuficiente para a saída solicitada")

type inventoryMovementInput struct {
	TenantID     uuid.UUID
	WarehouseID  int
	SKUID        int
	MovementType string
	Quantity     float64
	OriginType   string
}

// getOrCreateDefaultWarehouse mirrors
// InventoryService.GetOrCreateDefaultWarehouse.
func getOrCreateDefaultWarehouse(db *gorm.DB, tenantID uuid.UUID) (*models.Warehouse, error) {
	var wh models.Warehouse
	err := db.Session(&gorm.Session{NewDB: true}).
		Where(`"tenantId" = ? AND name = ?`, tenantID, "Armazém Principal").
		Attrs(models.Warehouse{TenantID: tenantID, Name: "Armazém Principal", IsActive: true}).
		FirstOrCreate(&wh).Error
	return &wh, err
}

// registerInventoryMovement mirrors InventoryService.RegisterMovement: same
// row-locked (SELECT ... FOR UPDATE) transaction, same append-only
// InventoryMovements insert, same low-stock threshold check — emitted here
// via core.EmitSocketEvent("tenant:"+tenantID, ...) instead of
// domain.Broadcaster directly, since plugins only has access to sdk.WatinkCore.
func registerInventoryMovement(core sdk.WatinkCore, in inventoryMovementInput) (*models.InventoryMovement, error) {
	if in.Quantity <= 0 {
		return nil, fmt.Errorf("quantidade do movimento deve ser positiva")
	}
	db := core.GetDB()

	var movement models.InventoryMovement
	var lowStock bool
	var resultingBalance, minQuantity float64

	err := db.Session(&gorm.Session{NewDB: true}).Transaction(func(tx *gorm.DB) error {
		var balance models.WarehouseBalance
		if err := tx.Raw(`SELECT * FROM "WarehouseBalances" WHERE "warehouseId" = ? AND "skuId" = ? FOR UPDATE`,
			in.WarehouseID, in.SKUID).Scan(&balance).Error; err != nil {
			return err
		}
		if balance.WarehouseID == 0 && balance.SKUID == 0 {
			balance = models.WarehouseBalance{WarehouseID: in.WarehouseID, SKUID: in.SKUID, CurrentBalance: 0}
			if err := tx.Create(&balance).Error; err != nil {
				return err
			}
			if err := tx.Raw(`SELECT * FROM "WarehouseBalances" WHERE "warehouseId" = ? AND "skuId" = ? FOR UPDATE`,
				in.WarehouseID, in.SKUID).Scan(&balance).Error; err != nil {
				return err
			}
		}

		delta := in.Quantity
		if in.MovementType == "OUT" {
			delta = -in.Quantity
			if balance.CurrentBalance+delta < 0 {
				return errInsufficientStock
			}
		}
		newBalance := balance.CurrentBalance + delta

		if err := tx.Model(&models.WarehouseBalance{}).
			Where(`"warehouseId" = ? AND "skuId" = ?`, in.WarehouseID, in.SKUID).
			Update("currentBalance", newBalance).Error; err != nil {
			return err
		}

		movement = models.InventoryMovement{
			TenantID:    in.TenantID,
			WarehouseID: in.WarehouseID,
			SKUID:       in.SKUID,
			Type:        in.MovementType,
			Quantity:    in.Quantity,
			OriginType:  in.OriginType,
		}
		if err := tx.Create(&movement).Error; err != nil {
			return err
		}

		var sku models.ProductSKU
		if err := tx.Where("id = ?", in.SKUID).First(&sku).Error; err != nil {
			return err
		}
		resultingBalance = newBalance
		minQuantity = sku.MinQuantity
		lowStock = newBalance < sku.MinQuantity
		return nil
	})
	if err != nil {
		return nil, err
	}

	if lowStock {
		core.EmitSocketEvent("tenant:"+in.TenantID.String(), "inventory.low_stock", map[string]interface{}{
			"skuId":          in.SKUID,
			"warehouseId":    in.WarehouseID,
			"currentBalance": resultingBalance,
			"minQuantity":    minQuantity,
		})
	}

	return &movement, nil
}
