package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Product is the catalog parent entity (Modo Simples: campos básicos; Modo
// Avançado: IsComposite habilita Ficha Técnica via ProductComposition). Never
// hard-deleted — DeletedAt only.
type Product struct {
	ID          int            `gorm:"primaryKey" json:"id"`
	TenantID    uuid.UUID      `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	CategoryID  *int           `gorm:"column:categoryId" json:"categoryId"`
	Name        string         `gorm:"not null" json:"name"`
	Unit        string         `gorm:"not null;default:'UN'" json:"unit"`
	// ImageURL points at a file saved via pkg/mediastore (local disk,
	// "/public/media/<hash>.<ext>") — same storage used for chat media.
	// Nullable: Modo Simples never requires a photo to create a product.
	ImageURL    *string        `gorm:"column:imageUrl" json:"imageUrl"`
	IsComposite bool           `gorm:"column:isComposite;not null;default:false" json:"isComposite"`
	CreatedAt   time.Time      `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt   time.Time      `gorm:"column:updatedAt" json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Product) TableName() string { return "Products" }

// ProductSKU is the real stock-keeping unit — the entity that
// WarehouseBalance/InventoryMovement actually reference. Never hard-deleted.
type ProductSKU struct {
	ID          int            `gorm:"primaryKey" json:"id"`
	ProductID   int            `gorm:"column:productId;not null" json:"productId"`
	SKUCode     string         `gorm:"column:skuCode;not null" json:"skuCode"`
	Barcode     *string        `gorm:"column:barcode" json:"barcode"`
	MinQuantity float64        `gorm:"column:minQuantity;type:decimal(14,4);not null;default:0" json:"minQuantity"`
	CreatedAt   time.Time      `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt   time.Time      `gorm:"column:updatedAt" json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ProductSKU) TableName() string { return "ProductSKUs" }

// ProductComposition is the BOM (Bill of Materials) link — only meaningful
// when Modo Avançado is active (plugin inventory-advanced), but the table
// exists for every tenant since the data model is always unified (PRD).
type ProductComposition struct {
	ID               int     `gorm:"primaryKey" json:"id"`
	ParentSKUID      int     `gorm:"column:parentSkuId;not null" json:"parentSkuId"`
	ChildSKUID       int     `gorm:"column:childSkuId;not null" json:"childSkuId"`
	QuantityRequired float64 `gorm:"column:quantityRequired;type:decimal(14,4);not null" json:"quantityRequired"`
}

func (ProductComposition) TableName() string { return "ProductCompositions" }

// PriceTable groups SKUPrices under a named context ("Base", "Delivery").
// Every tenant gets a "Base" table auto-created on first write (Modo Simples
// onboarding) — additional tables are a Modo Avançado feature.
type PriceTable struct {
	ID       int       `gorm:"primaryKey" json:"id"`
	TenantID uuid.UUID `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	Name     string    `gorm:"not null" json:"name"`
	IsActive bool      `gorm:"column:isActive;not null;default:true" json:"isActive"`
}

func (PriceTable) TableName() string { return "PriceTables" }

// SKUPrice is the pivot between ProductSKU and PriceTable. PriceCents follows
// the ecosystem-wide money invariant (integer centavos, never float) — this
// diverges from the older Plan.Price/Deal.Value (float64 decimal), which are
// legacy debt, not a pattern to copy into new code.
type SKUPrice struct {
	ID           int    `gorm:"primaryKey" json:"id"`
	SKUID        int    `gorm:"column:skuId;not null" json:"skuId"`
	PriceTableID int    `gorm:"column:priceTableId;not null" json:"priceTableId"`
	PriceCents   int64  `gorm:"column:priceCents;not null" json:"priceCents"`
	Currency     string `gorm:"not null;default:'BRL'" json:"currency"`
}

func (SKUPrice) TableName() string { return "SKUPrices" }

// Warehouse is physical or logical stock location. Modo Simples auto-creates
// exactly one ("Armazém Principal") and hides it from the UI; additional
// warehouses are a Modo Avançado feature. Never hard-deleted.
type Warehouse struct {
	ID        int            `gorm:"primaryKey" json:"id"`
	TenantID  uuid.UUID      `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	Name      string         `gorm:"not null" json:"name"`
	IsActive  bool           `gorm:"column:isActive;not null;default:true" json:"isActive"`
	CreatedAt time.Time      `gorm:"column:createdAt" json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Warehouse) TableName() string { return "Warehouses" }

// WarehouseBalance holds the atomically-maintained current stock — never
// recomputed by summing InventoryMovements history (PRD invariant, avoids a
// full-history scan on every read). Updated only inside the same transaction
// that inserts the InventoryMovement row (inventory_service.go).
type WarehouseBalance struct {
	WarehouseID    int     `gorm:"column:warehouseId;primaryKey" json:"warehouseId"`
	SKUID          int     `gorm:"column:skuId;primaryKey" json:"skuId"`
	CurrentBalance float64 `gorm:"column:currentBalance;type:decimal(14,4);not null;default:0" json:"currentBalance"`
}

func (WarehouseBalance) TableName() string { return "WarehouseBalances" }

// InventoryMovement is the append-only audit trail. No UPDATE is ever issued
// against this table — correcting a mistaken entry means posting a new
// compensating movement ("Ajuste de Inventário"), never editing history (PRD
// invariant). No DeletedAt either — rows are permanent.
type InventoryMovement struct {
	ID          int       `gorm:"primaryKey" json:"id"`
	TenantID    uuid.UUID `gorm:"column:tenantId;type:uuid" json:"tenantId"`
	WarehouseID int       `gorm:"column:warehouseId;not null" json:"warehouseId"`
	SKUID       int       `gorm:"column:skuId;not null" json:"skuId"`
	// Type is one of IN, OUT, TRANSFER.
	Type     string  `gorm:"not null" json:"type"`
	Quantity float64 `gorm:"type:decimal(14,4);not null" json:"quantity"`
	// OriginType is one of MANUAL, ORDER, OS.
	OriginType string    `gorm:"column:originType;not null" json:"originType"`
	OriginID   *int      `gorm:"column:originId" json:"originId"`
	CreatedAt  time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (InventoryMovement) TableName() string { return "InventoryMovements" }
