package controllers

import (
	"net/http"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/mediastore"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// InventoryController is the Modo Simples CRUD (PRD "Divulgação Progressiva
// de Complexidade") — always on, free, for every tenant. It never exposes
// Warehouse/PriceTable choice to the caller: the "Armazém Principal" and
// "Base" price table are resolved server-side. Modo Avançado (multiple
// warehouses, transfers, BOM, extra price tables) lives in the
// inventory-advanced plugin, which reuses these same models/service.
type InventoryController struct {
	inventory *services.InventoryService
}

func NewInventoryController(inventory *services.InventoryService) *InventoryController {
	return &InventoryController{inventory: inventory}
}

type productInput struct {
	CategoryID *int   `json:"categoryId"`
	Name       string `json:"name"`
	Unit       string `json:"unit"`
}

// productListItem is the Modo Simples read model — Product flattened with its
// primary SKU (the one and only SKU CreateProduct ever creates in this mode),
// the Base price table entry and the Armazém Principal balance, so the
// "Adicionar Produto" screen never has to make three round-trips per row.
type productListItem struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Unit           string  `json:"unit"`
	CategoryID     *int    `json:"categoryId"`
	ImageURL       *string `json:"imageUrl"`
	SKUID          int     `json:"skuId"`
	SKUCode        string  `json:"skuCode"`
	MinQuantity    float64 `json:"minQuantity"`
	PriceCents     int64   `json:"priceCents"`
	CurrentBalance float64 `json:"currentBalance"`
}

// ListProducts returns the tenant's products (soft-deleted excluded by GORM)
// flattened with primary SKU, base price and current stock in the default
// warehouse — see productListItem.
// @Summary      Listar produtos
// @Tags         inventory
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /inventory/products [get]
func (ic *InventoryController) ListProducts(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Inventory")
	if !ok {
		return
	}
	var products []models.Product
	if err := db.Where(`"tenantId" = ?`, tenantID).Order("name ASC").Find(&products).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListProducts")
		return
	}
	if len(products) == 0 {
		c.JSON(http.StatusOK, gin.H{"products": []productListItem{}})
		return
	}

	productIDs := make([]int, len(products))
	for i, p := range products {
		productIDs[i] = p.ID
	}

	var skus []models.ProductSKU
	if err := db.Session(&gorm.Session{NewDB: true}).Where(`"productId" IN ?`, productIDs).Order("id ASC").Find(&skus).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListProductSKUsForList")
		return
	}
	primarySKUByProduct := make(map[int]models.ProductSKU, len(products))
	skuIDs := make([]int, 0, len(products))
	for _, sku := range skus {
		if _, exists := primarySKUByProduct[sku.ProductID]; !exists {
			primarySKUByProduct[sku.ProductID] = sku
			skuIDs = append(skuIDs, sku.ID)
		}
	}

	priceBySKU := map[int]int64{}
	balanceBySKU := map[int]float64{}
	if len(skuIDs) > 0 {
		priceTable, err := ic.inventory.GetOrCreateBasePriceTable(tenantID)
		if err != nil {
			utils.RespondWithInternalError(c, err, "GetOrCreateBasePriceTableForList")
			return
		}
		var prices []models.SKUPrice
		if err := db.Session(&gorm.Session{NewDB: true}).Where(`"priceTableId" = ? AND "skuId" IN ?`, priceTable.ID, skuIDs).Find(&prices).Error; err != nil {
			utils.RespondWithInternalError(c, err, "ListSKUPricesForList")
			return
		}
		for _, p := range prices {
			priceBySKU[p.SKUID] = p.PriceCents
		}

		warehouse, err := ic.inventory.GetOrCreateDefaultWarehouse(tenantID)
		if err != nil {
			utils.RespondWithInternalError(c, err, "GetOrCreateDefaultWarehouseForList")
			return
		}
		var balances []models.WarehouseBalance
		if err := db.Session(&gorm.Session{NewDB: true}).Where(`"warehouseId" = ? AND "skuId" IN ?`, warehouse.ID, skuIDs).Find(&balances).Error; err != nil {
			utils.RespondWithInternalError(c, err, "ListWarehouseBalancesForList")
			return
		}
		for _, b := range balances {
			balanceBySKU[b.SKUID] = b.CurrentBalance
		}
	}

	items := make([]productListItem, 0, len(products))
	for _, p := range products {
		sku := primarySKUByProduct[p.ID]
		items = append(items, productListItem{
			ID:             p.ID,
			Name:           p.Name,
			Unit:           p.Unit,
			CategoryID:     p.CategoryID,
			ImageURL:       p.ImageURL,
			SKUID:          sku.ID,
			SKUCode:        sku.SKUCode,
			MinQuantity:    sku.MinQuantity,
			PriceCents:     priceBySKU[sku.ID],
			CurrentBalance: balanceBySKU[sku.ID],
		})
	}
	c.JSON(http.StatusOK, gin.H{"products": items})
}

// CreateProduct creates a Product plus its first ProductSKU and base price in
// one call — the Modo Simples "Adicionar Produto" screen has a single flat
// form (Nome, Imagem, Preço, Quantidade), so the controller resolves the
// default Warehouse/PriceTable and posts the initial IN movement.
// @Summary      Criar produto (modo simples)
// @Tags         inventory
// @Accept       json
// @Produce      json
// @Success      201  {object}  models.Product
// @Security     BearerAuth
// @Router       /inventory/products [post]
func (ic *InventoryController) CreateProduct(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Inventory")
	if !ok {
		return
	}
	var in struct {
		productInput
		SKUCode      string  `json:"skuCode"`
		PriceCents   int64   `json:"priceCents"`
		InitialStock float64 `json:"initialStock"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if in.Name == "" || in.SKUCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name e skuCode são obrigatórios"})
		return
	}
	if in.Unit == "" {
		in.Unit = "UN"
	}

	product := models.Product{TenantID: tenantID, CategoryID: in.CategoryID, Name: in.Name, Unit: in.Unit}
	sess := db.Session(&gorm.Session{NewDB: true})
	if err := sess.Create(&product).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreateProduct")
		return
	}

	sku := models.ProductSKU{ProductID: product.ID, SKUCode: in.SKUCode}
	if err := db.Session(&gorm.Session{NewDB: true}).Create(&sku).Error; err != nil {
		utils.RespondWithInternalError(c, err, "CreateProductSKU")
		return
	}

	priceTable, err := ic.inventory.GetOrCreateBasePriceTable(tenantID)
	if err != nil {
		utils.RespondWithInternalError(c, err, "GetOrCreateBasePriceTable")
		return
	}
	if in.PriceCents > 0 {
		price := models.SKUPrice{SKUID: sku.ID, PriceTableID: priceTable.ID, PriceCents: in.PriceCents, Currency: "BRL"}
		if err := db.Session(&gorm.Session{NewDB: true}).Create(&price).Error; err != nil {
			utils.RespondWithInternalError(c, err, "CreateSKUPrice")
			return
		}
	}

	if in.InitialStock > 0 {
		warehouse, err := ic.inventory.GetOrCreateDefaultWarehouse(tenantID)
		if err != nil {
			utils.RespondWithInternalError(c, err, "GetOrCreateDefaultWarehouse")
			return
		}
		if _, err := ic.inventory.RegisterMovement(services.MovementInput{
			TenantID:     tenantID,
			WarehouseID:  warehouse.ID,
			SKUID:        sku.ID,
			MovementType: "IN",
			Quantity:     in.InitialStock,
			OriginType:   "MANUAL",
		}); err != nil {
			utils.RespondWithInternalError(c, err, "RegisterInitialStockMovement")
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{"product": product, "sku": sku})
}

// UploadProductImage attaches a photo to an existing Product — a separate
// step from CreateProduct (which is JSON-only) so the multipart upload never
// blocks the simple text-only path. Saved via pkg/mediastore (local disk,
// same storage chat media already uses) — no S3/object-store dependency for
// something this small.
// @Summary      Enviar imagem do produto
// @Tags         inventory
// @Accept       mpfd
// @Produce      json
// @Param        id  path  int  true  "ID do produto"
// @Success      200  {object}  models.Product
// @Security     BearerAuth
// @Router       /inventory/products/{id}/image [post]
func (ic *InventoryController) UploadProductImage(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Inventory")
	if !ok {
		return
	}
	id, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}

	var existing models.Product
	if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&existing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "produto não encontrado"})
		return
	}

	file, header, err := c.Request.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "arquivo 'image' obrigatório"})
		return
	}
	defer func() { _ = file.Close() }()

	mimeType := sanitizeMimeType(header.Header.Get("Content-Type"))
	if !strings.HasPrefix(mimeType, "image/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "apenas arquivos de imagem são aceitos"})
		return
	}

	savedURL, err := mediastore.SaveMediaReader(file, mimeType)
	if err != nil {
		utils.RespondWithInternalError(c, err, "UploadProductImage")
		return
	}

	if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.Product{}).
		Where("id = ?", id).Update("imageUrl", savedURL).Error; err != nil {
		utils.RespondWithInternalError(c, err, "SaveProductImageURL")
		return
	}

	existing.ImageURL = &savedURL
	c.JSON(http.StatusOK, existing)
}

// UpdateProduct edits name/category/unit of a product by :id.
// @Summary      Atualizar produto
// @Tags         inventory
// @Accept       json
// @Produce      json
// @Param        id  path  int  true  "ID do produto"
// @Success      200  {object}  models.Product
// @Security     BearerAuth
// @Router       /inventory/products/{id} [put]
func (ic *InventoryController) UpdateProduct(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Inventory")
	if !ok {
		return
	}
	id, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}
	var in struct {
		productInput
		SKUCode     string  `json:"skuCode"`
		MinQuantity float64 `json:"minQuantity"`
		PriceCents  int64   `json:"priceCents"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	fields := map[string]interface{}{"name": in.Name, "categoryId": in.CategoryID}
	if in.Unit != "" {
		fields["unit"] = in.Unit
	}
	if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.Product{}).
		Where(`id = ? AND "tenantId" = ?`, id, tenantID).Updates(fields).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateProduct")
		return
	}

	// Modo Simples só tem uma SKU por produto (a criada por CreateProduct) —
	// atualizá-la aqui evita expor a existência de múltiplas SKUs no formulário.
	var sku models.ProductSKU
	if err := db.Session(&gorm.Session{NewDB: true}).Where(`"productId" = ?`, id).Order("id ASC").First(&sku).Error; err == nil {
		skuFields := map[string]interface{}{"minQuantity": in.MinQuantity}
		if in.SKUCode != "" {
			skuFields["skuCode"] = in.SKUCode
		}
		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.ProductSKU{}).
			Where("id = ?", sku.ID).Updates(skuFields).Error; err != nil {
			utils.RespondWithInternalError(c, err, "UpdateProductSKU")
			return
		}

		priceTable, err := ic.inventory.GetOrCreateBasePriceTable(tenantID)
		if err != nil {
			utils.RespondWithInternalError(c, err, "GetOrCreateBasePriceTableForUpdate")
			return
		}
		var price models.SKUPrice
		err = db.Session(&gorm.Session{NewDB: true}).
			Where(`"skuId" = ? AND "priceTableId" = ?`, sku.ID, priceTable.ID).First(&price).Error
		if err == gorm.ErrRecordNotFound {
			if in.PriceCents > 0 {
				price = models.SKUPrice{SKUID: sku.ID, PriceTableID: priceTable.ID, PriceCents: in.PriceCents, Currency: "BRL"}
				if err := db.Session(&gorm.Session{NewDB: true}).Create(&price).Error; err != nil {
					utils.RespondWithInternalError(c, err, "CreateSKUPriceOnUpdate")
					return
				}
			}
		} else if err != nil {
			utils.RespondWithInternalError(c, err, "LookupSKUPriceOnUpdate")
			return
		} else if in.PriceCents > 0 {
			if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.SKUPrice{}).
				Where("id = ?", price.ID).Update("priceCents", in.PriceCents).Error; err != nil {
				utils.RespondWithInternalError(c, err, "UpdateSKUPriceOnUpdate")
				return
			}
		}
	}

	var updated models.Product
	if err := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).First(&updated).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ReloadProductAfterUpdate")
		return
	}
	c.JSON(http.StatusOK, updated)
}

// DeleteProduct soft-deletes a Product and its SKUs — hard delete is
// forbidden by the PRD; if any SKU has movement history, the delete is
// rejected outright rather than silently orphaning InventoryMovements.
// @Summary      Remover produto
// @Tags         inventory
// @Produce      json
// @Param        id  path  int  true  "ID do produto"
// @Success      200  {object}  map[string]string
// @Security     BearerAuth
// @Router       /inventory/products/{id} [delete]
func (ic *InventoryController) DeleteProduct(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Inventory")
	if !ok {
		return
	}
	id, ok := utils.ParseIntParam(c, "id")
	if !ok {
		return
	}

	var skuIDs []int
	if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.ProductSKU{}).
		Where("\"productId\" = ?", id).Pluck("id", &skuIDs).Error; err != nil {
		utils.RespondWithInternalError(c, err, "ListProductSKUsForDelete")
		return
	}
	if len(skuIDs) > 0 {
		var movementCount int64
		if err := db.Session(&gorm.Session{NewDB: true}).Model(&models.InventoryMovement{}).
			Where(`"tenantId" = ? AND "skuId" IN ?`, tenantID, skuIDs).Count(&movementCount).Error; err != nil {
			utils.RespondWithInternalError(c, err, "CountMovementsForDelete")
			return
		}
		if movementCount > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "produto possui histórico de movimentações e não pode ser removido — use ajuste de estoque"})
			return
		}
	}

	sess := db.Session(&gorm.Session{NewDB: true})
	if err := sess.Where("\"productId\" = ?", id).Delete(&models.ProductSKU{}).Error; err != nil {
		utils.RespondWithInternalError(c, err, "SoftDeleteProductSKUs")
		return
	}
	res := db.Session(&gorm.Session{NewDB: true}).Where(`id = ? AND "tenantId" = ?`, id, tenantID).Delete(&models.Product{})
	if res.Error != nil {
		utils.RespondWithInternalError(c, res.Error, "SoftDeleteProduct")
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "produto não encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Produto removido"})
}

type movementInput struct {
	SKUID      int     `json:"skuId"`
	Quantity   float64 `json:"quantity"`
	OriginType string  `json:"originType"`
}

// RegisterEntry posts a manual IN movement against the tenant's default
// warehouse (Modo Simples never exposes warehouse choice).
// @Summary      Registrar entrada de estoque (modo simples)
// @Tags         inventory
// @Accept       json
// @Produce      json
// @Success      201  {object}  models.InventoryMovement
// @Security     BearerAuth
// @Router       /inventory/movements/in [post]
func (ic *InventoryController) RegisterEntry(c *gin.Context) {
	ic.registerSimpleMovement(c, "IN")
}

// RegisterExit posts a manual OUT movement against the tenant's default
// warehouse. Returns 409 when the requested quantity would drive the balance
// negative.
// @Summary      Registrar saída de estoque (modo simples)
// @Tags         inventory
// @Accept       json
// @Produce      json
// @Success      201  {object}  models.InventoryMovement
// @Security     BearerAuth
// @Router       /inventory/movements/out [post]
func (ic *InventoryController) RegisterExit(c *gin.Context) {
	ic.registerSimpleMovement(c, "OUT")
}

func (ic *InventoryController) registerSimpleMovement(c *gin.Context, movementType string) {
	_, tenantID, ok := auth.GetScoped(c, "Inventory")
	if !ok {
		return
	}
	var in movementInput
	if err := c.ShouldBindJSON(&in); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}
	if in.Quantity <= 0 || in.SKUID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "skuId e quantity (> 0) são obrigatórios"})
		return
	}
	if in.OriginType == "" {
		in.OriginType = "MANUAL"
	}

	warehouse, err := ic.inventory.GetOrCreateDefaultWarehouse(tenantID)
	if err != nil {
		utils.RespondWithInternalError(c, err, "GetOrCreateDefaultWarehouse")
		return
	}

	movement, err := ic.inventory.RegisterMovement(services.MovementInput{
		TenantID:     tenantID,
		WarehouseID:  warehouse.ID,
		SKUID:        in.SKUID,
		MovementType: movementType,
		Quantity:     in.Quantity,
		OriginType:   in.OriginType,
	})
	if err != nil {
		if err == services.ErrInsufficientStock {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		utils.RespondWithInternalError(c, err, "RegisterMovement")
		return
	}
	c.JSON(http.StatusCreated, movement)
}
