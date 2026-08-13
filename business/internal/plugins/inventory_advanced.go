package plugins

import (
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// InventoryAdvancedPlugin unlocks the "Modo Avançado" surfaces of the WMS
// core module (múltiplos armazéns, transferências, fichas técnicas/BOM,
// tabelas de preço extras). It creates NO new tables — Product/ProductSKU/
// Warehouse/PriceTable/etc. all live in the core migration
// (database.Migrate) because the PRD's data model is always unified,
// regardless of which mode a tenant is on. This plugin only gates the
// endpoints that let a tenant grow beyond the single default warehouse/price
// table that Modo Simples auto-provisions.
type InventoryAdvancedPlugin struct{}

func (p *InventoryAdvancedPlugin) GetManifest() sdk.PluginManifest {
	return sdk.PluginManifest{
		Slug:        "inventory-advanced",
		Name:        "Estoque Avançado",
		Version:     "1.0.0",
		Description: "Múltiplos armazéns, transferências, fichas técnicas (BOM) e tabelas de preço",
		Type:        "pro",
	}
}

// OnInstall is a no-op — schema already exists via the core migration.
func (p *InventoryAdvancedPlugin) OnInstall(core sdk.WatinkCore) error { return nil }

func (p *InventoryAdvancedPlugin) OnActivate(core sdk.WatinkCore) error {
	core.RegisterRoute("GET", "/warehouses", handleListWarehouses(core))
	core.RegisterRoute("POST", "/warehouses", handleCreateWarehouse(core))
	core.RegisterRoute("PUT", "/warehouses/:id", handleUpdateWarehouse(core))
	core.RegisterRoute("DELETE", "/warehouses/:id", handleDeleteWarehouse(core))
	core.RegisterRoute("POST", "/inventory/transfer", handleTransferStock(core))

	core.RegisterRoute("GET", "/price-tables", handleListPriceTables(core))
	core.RegisterRoute("POST", "/price-tables", handleCreatePriceTable(core))
	core.RegisterRoute("PUT", "/price-tables/:id/prices", handleUpsertSKUPrice(core))

	core.RegisterRoute("GET", "/products/:id/composition", handleListComposition(core))
	core.RegisterRoute("PUT", "/products/:id/composition", handleReplaceComposition(core))
	return nil
}

func (p *InventoryAdvancedPlugin) OnDeactivate(core sdk.WatinkCore) error { return nil }

// --- Warehouses (multi-armazém) ---

func handleListWarehouses(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		var warehouses []models.Warehouse
		if err := db.Where(`"tenantId" = ?`, tenantID).Order("name ASC").Find(&warehouses).Error; err != nil {
			utils.RespondWithInternalError(c, err, "ListWarehouses")
			return
		}
		c.JSON(http.StatusOK, gin.H{"warehouses": warehouses})
	}
}

type warehouseInput struct {
	Name     string `json:"name"`
	IsActive *bool  `json:"isActive"`
}

func handleCreateWarehouse(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		var in warehouseInput
		if err := c.ShouldBindJSON(&in); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		if in.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name é obrigatório"})
			return
		}
		wh := models.Warehouse{TenantID: tenantID, Name: in.Name, IsActive: true}
		if err := db.Session(&gorm.Session{NewDB: true}).Create(&wh).Error; err != nil {
			utils.RespondWithInternalError(c, err, "CreateWarehouse")
			return
		}
		c.JSON(http.StatusCreated, wh)
	}
}

func handleUpdateWarehouse(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		id, ok := utils.ParseIntParam(c, "id")
		if !ok {
			return
		}
		var in warehouseInput
		if err := c.ShouldBindJSON(&in); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		fields := map[string]interface{}{}
		if in.Name != "" {
			fields["name"] = in.Name
		}
		if in.IsActive != nil {
			fields["isActive"] = *in.IsActive
		}
		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.Warehouse{}).
			Where(`id = ? AND "tenantId" = ?`, id, tenantID).Updates(fields).Error; err != nil {
			utils.RespondWithInternalError(c, err, "UpdateWarehouse")
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Armazém atualizado"})
	}
}

// handleDeleteWarehouse soft-deletes a Warehouse — never the "Armazém
// Principal" (Modo Simples depends on it always existing), and never one that
// still carries a non-zero balance.
func handleDeleteWarehouse(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		id, ok := utils.ParseIntParam(c, "id")
		if !ok {
			return
		}

		var wh models.Warehouse
		if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&wh).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "armazém não encontrado"})
			return
		}
		if wh.Name == "Armazém Principal" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "o Armazém Principal não pode ser removido"})
			return
		}
		var nonZeroBalances int64
		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.WarehouseBalance{}).
			Where(`"warehouseId" = ? AND "currentBalance" != 0`, id).Count(&nonZeroBalances).Error; err != nil {
			utils.RespondWithInternalError(c, err, "CountWarehouseBalancesForDelete")
			return
		}
		if nonZeroBalances > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "armazém possui saldo em estoque e não pode ser removido"})
			return
		}

		if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).Delete(&models.Warehouse{}).Error; err != nil {
			utils.RespondWithInternalError(c, err, "SoftDeleteWarehouse")
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Armazém removido"})
	}
}

// --- Transferências entre armazéns ---

type transferInput struct {
	SKUID           int     `json:"skuId"`
	FromWarehouseID int     `json:"fromWarehouseId"`
	ToWarehouseID   int     `json:"toWarehouseId"`
	Quantity        float64 `json:"quantity"`
}

// handleTransferStock posts a TRANSFER as a paired OUT (origin) + IN
// (destination) movement — both go through InventoryService.RegisterMovement
// so the same locking/audit-trail guarantees apply as any other movement.
func handleTransferStock(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, tenantID, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		var in transferInput
		if err := c.ShouldBindJSON(&in); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		if in.SKUID == 0 || in.FromWarehouseID == 0 || in.ToWarehouseID == 0 || in.Quantity <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "skuId, fromWarehouseId, toWarehouseId e quantity (> 0) são obrigatórios"})
			return
		}
		if in.FromWarehouseID == in.ToWarehouseID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "armazém de origem e destino não podem ser o mesmo"})
			return
		}

		if _, err := registerInventoryMovement(core, inventoryMovementInput{
			TenantID:     tenantID,
			WarehouseID:  in.FromWarehouseID,
			SKUID:        in.SKUID,
			MovementType: "OUT",
			Quantity:     in.Quantity,
			OriginType:   "MANUAL",
		}); err != nil {
			if err == errInsufficientStock {
				c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
				return
			}
			utils.RespondWithInternalError(c, err, "TransferStockOut")
			return
		}
		movement, err := registerInventoryMovement(core, inventoryMovementInput{
			TenantID:     tenantID,
			WarehouseID:  in.ToWarehouseID,
			SKUID:        in.SKUID,
			MovementType: "TRANSFER",
			Quantity:     in.Quantity,
			OriginType:   "MANUAL",
		})
		if err != nil {
			utils.RespondWithInternalError(c, err, "TransferStockIn")
			return
		}
		c.JSON(http.StatusCreated, movement)
	}
}

// --- Tabelas de preço extras ---

func handleListPriceTables(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		var tables []models.PriceTable
		if err := db.Where(`"tenantId" = ?`, tenantID).Order("name ASC").Find(&tables).Error; err != nil {
			utils.RespondWithInternalError(c, err, "ListPriceTables")
			return
		}
		c.JSON(http.StatusOK, gin.H{"priceTables": tables})
	}
}

func handleCreatePriceTable(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		var in struct {
			Name string `json:"name"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		if in.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name é obrigatório"})
			return
		}
		pt := models.PriceTable{TenantID: tenantID, Name: in.Name, IsActive: true}
		if err := db.Session(&gorm.Session{NewDB: true}).Create(&pt).Error; err != nil {
			utils.RespondWithInternalError(c, err, "CreatePriceTable")
			return
		}
		c.JSON(http.StatusCreated, pt)
	}
}

// handleUpsertSKUPrice sets/updates the price of a SKU within a given price
// table (:id). Ownership of the price table is checked against the tenant
// before writing.
func handleUpsertSKUPrice(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, tenantID, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		tableID, ok := utils.ParseIntParam(c, "id")
		if !ok {
			return
		}
		var in struct {
			SKUID      int   `json:"skuId"`
			PriceCents int64 `json:"priceCents"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		if in.SKUID == 0 || in.PriceCents < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "skuId e priceCents (>= 0) são obrigatórios"})
			return
		}

		var table models.PriceTable
		if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, tableID, tenantID).First(&table).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "tabela de preço não encontrada"})
			return
		}

		var price models.SKUPrice
		err := db.Session(&gorm.Session{NewDB: true}).
			Where(`"skuId" = ? AND "priceTableId" = ?`, in.SKUID, tableID).First(&price).Error
		if err == gorm.ErrRecordNotFound {
			price = models.SKUPrice{SKUID: in.SKUID, PriceTableID: tableID, PriceCents: in.PriceCents, Currency: "BRL"}
			if err := db.Session(&gorm.Session{NewDB: true}).Create(&price).Error; err != nil {
				utils.RespondWithInternalError(c, err, "CreateSKUPrice")
				return
			}
		} else if err != nil {
			utils.RespondWithInternalError(c, err, "LookupSKUPrice")
			return
		} else {
			if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.SKUPrice{}).
				Where("id = ?", price.ID).Update("priceCents", in.PriceCents).Error; err != nil {
				utils.RespondWithInternalError(c, err, "UpdateSKUPrice")
				return
			}
			price.PriceCents = in.PriceCents
		}
		c.JSON(http.StatusOK, price)
	}
}

// --- Fichas Técnicas (BOM) ---

func handleListComposition(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, _, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		productID, ok := utils.ParseIntParam(c, "id")
		if !ok {
			return
		}
		var skuIDs []int
		if err := db.Model(&models.ProductSKU{}).Where(`"productId" = ?`, productID).Pluck("id", &skuIDs).Error; err != nil {
			utils.RespondWithInternalError(c, err, "ListProductSKUsForComposition")
			return
		}
		var compositions []models.ProductComposition
		if len(skuIDs) > 0 {
			if err := db.Where(`"parentSkuId" IN ?`, skuIDs).Find(&compositions).Error; err != nil {
				utils.RespondWithInternalError(c, err, "ListComposition")
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"compositions": compositions})
	}
}

// handleReplaceComposition replaces the full BOM of a parent SKU (delete +
// reinsert, same pattern accepted elsewhere in the codebase for "set" style
// child collections — the compositions themselves have no independent
// history to preserve, unlike InventoryMovements).
func handleReplaceComposition(core sdk.WatinkCore) gin.HandlerFunc {
	return func(c *gin.Context) {
		db, _, ok := auth.GetScoped(c, "Inventory")
		if !ok {
			return
		}
		if _, ok := utils.ParseIntParam(c, "id"); !ok {
			return
		}
		var in struct {
			ParentSKUID int `json:"parentSkuId"`
			Items       []struct {
				ChildSKUID       int     `json:"childSkuId"`
				QuantityRequired float64 `json:"quantityRequired"`
			} `json:"items"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			utils.RespondWithBindError(c, err)
			return
		}
		if in.ParentSKUID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parentSkuId é obrigatório"})
			return
		}

		err := db.Session(&gorm.Session{NewDB: true}).Transaction(func(tx *gorm.DB) error {
			if err := tx.Where(`"parentSkuId" = ?`, in.ParentSKUID).Delete(&models.ProductComposition{}).Error; err != nil {
				return err
			}
			for _, item := range in.Items {
				comp := models.ProductComposition{
					ParentSKUID:      in.ParentSKUID,
					ChildSKUID:       item.ChildSKUID,
					QuantityRequired: item.QuantityRequired,
				}
				if err := tx.Create(&comp).Error; err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			utils.RespondWithInternalError(c, err, "ReplaceComposition")
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Ficha técnica atualizada"})
	}
}
