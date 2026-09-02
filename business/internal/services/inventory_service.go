package services

import (
	"errors"
	"fmt"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// InventoryService centralizes the WMS transactional engine (PRD "Motor
// Transacional"): every stock movement is an append-only row in
// InventoryMovements plus an atomically-updated WarehouseBalance, in the same
// transaction, with a row lock to prevent concurrent OUTs from driving the
// balance negative.
type InventoryService struct {
	db        *gorm.DB
	broadcast domain.Broadcaster
}

func NewInventoryService(db *gorm.DB, broadcast domain.Broadcaster) *InventoryService {
	return &InventoryService{db: db, broadcast: broadcast}
}

var ErrInsufficientStock = errors.New("saldo insuficiente para a saída solicitada")

// MovementInput describes a single stock movement request. OriginType is one
// of MANUAL, ORDER, OS; MovementType is one of IN, OUT, TRANSFER.
type MovementInput struct {
	TenantID     uuid.UUID
	WarehouseID  int
	SKUID        int
	MovementType string
	Quantity     float64
	OriginType   string
	OriginID     *int
}

// GetOrCreateDefaultWarehouse resolves the tenant's "Armazém Principal",
// creating it on first use (Modo Simples onboarding, PRD "Magia do
// Backend"). Kept idempotent via FirstOrCreate rather than a dedicated
// onboarding hook, so any entry point (product create, first movement) works
// without ordering assumptions.
func (s *InventoryService) GetOrCreateDefaultWarehouse(tenantID uuid.UUID) (*models.Warehouse, error) {
	var wh models.Warehouse
	err := s.db.Session(&gorm.Session{NewDB: true}).
		Where(`"tenantId" = ? AND name = ?`, tenantID, "Armazém Principal").
		Attrs(models.Warehouse{TenantID: tenantID, Name: "Armazém Principal", IsActive: true}).
		FirstOrCreate(&wh).Error
	return &wh, err
}

// GetOrCreateBasePriceTable resolves the tenant's "Base" price table, same
// lazy-creation reasoning as GetOrCreateDefaultWarehouse.
func (s *InventoryService) GetOrCreateBasePriceTable(tenantID uuid.UUID) (*models.PriceTable, error) {
	var pt models.PriceTable
	err := s.db.Session(&gorm.Session{NewDB: true}).
		Where(`"tenantId" = ? AND name = ?`, tenantID, "Base").
		Attrs(models.PriceTable{TenantID: tenantID, Name: "Base", IsActive: true}).
		FirstOrCreate(&pt).Error
	return &pt, err
}

// RegisterMovement is the single write path for InventoryMovements +
// WarehouseBalances. It locks the WarehouseBalance row (SELECT ... FOR
// UPDATE) inside the transaction so two concurrent OUTs never drive the
// balance negative, inserts the immutable movement row, and — if the
// resulting balance falls below the SKU's MinQuantity — emits
// "inventory.low_stock" via EmitToTenantRoom (never EmitToNamespace).
//
// Correcting a past mistake is never an UPDATE on InventoryMovements: callers
// post a new compensating IN/OUT with OriginType=MANUAL instead (PRD
// invariant, enforced by convention here since the table has no UPDATE path
// at all in this service).
func (s *InventoryService) RegisterMovement(in MovementInput) (*models.InventoryMovement, error) {
	if in.Quantity <= 0 {
		return nil, fmt.Errorf("quantidade do movimento deve ser positiva")
	}

	var movement models.InventoryMovement
	var lowStock bool
	var resultingBalance float64
	var minQuantity float64

	err := s.db.Session(&gorm.Session{NewDB: true}).Transaction(func(tx *gorm.DB) error {
		var balance models.WarehouseBalance
		lockErr := tx.Raw(`SELECT * FROM "WarehouseBalances" WHERE "warehouseId" = ? AND "skuId" = ? FOR UPDATE`,
			in.WarehouseID, in.SKUID).
			Scan(&balance).Error
		if lockErr != nil {
			return lockErr
		}
		// Row doesn't exist yet — create it at zero, still inside the tx so a
		// concurrent first-write can't race past this point.
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
				return ErrInsufficientStock
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
			OriginID:    in.OriginID,
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
		domain.BroadcastOrNop(s.broadcast).EmitToTenantRoom(in.TenantID.String(), "inventory.low_stock", map[string]interface{}{
			"skuId":          in.SKUID,
			"warehouseId":    in.WarehouseID,
			"currentBalance": resultingBalance,
			"minQuantity":    minQuantity,
		})
	}

	return &movement, nil
}
