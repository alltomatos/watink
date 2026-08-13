package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInventoryController_DeleteProduct_RejectsWhenMovementHistoryExists(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	warehouse := models.Warehouse{TenantID: tenantID, Name: "Armazém Principal", IsActive: true}
	require.NoError(t, db.Create(&warehouse).Error)
	product := models.Product{TenantID: tenantID, Name: "Produto Teste", Unit: "UN"}
	require.NoError(t, db.Create(&product).Error)
	sku := models.ProductSKU{ProductID: product.ID, SKUCode: "SKU-1"}
	require.NoError(t, db.Create(&sku).Error)

	svc := services.NewInventoryService(db, nil)
	_, err := svc.RegisterMovement(services.MovementInput{
		TenantID: tenantID, WarehouseID: warehouse.ID, SKUID: sku.ID,
		MovementType: "IN", Quantity: 5, OriginType: "MANUAL",
	})
	require.NoError(t, err)

	ctrl := NewInventoryController(svc)
	c, w := setupPipelineContextWithParam(t, db, tenantID, "DELETE", "/inventory/products/"+strconv.Itoa(product.ID), nil, "id", strconv.Itoa(product.ID))

	ctrl.DeleteProduct(c)

	assert.Equal(t, http.StatusConflict, w.Code)

	var reloaded models.Product
	require.NoError(t, db.Unscoped().Where("id = ?", product.ID).First(&reloaded).Error)
	assert.False(t, reloaded.DeletedAt.Valid, "product must remain untouched when history blocks the delete")
}

func TestInventoryController_DeleteProduct_SoftDeletesWithoutHistory(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	product := models.Product{TenantID: tenantID, Name: "Produto Sem Histórico", Unit: "UN"}
	require.NoError(t, db.Create(&product).Error)
	sku := models.ProductSKU{ProductID: product.ID, SKUCode: "SKU-2"}
	require.NoError(t, db.Create(&sku).Error)

	svc := services.NewInventoryService(db, nil)
	ctrl := NewInventoryController(svc)
	c, w := setupPipelineContextWithParam(t, db, tenantID, "DELETE", "/inventory/products/"+strconv.Itoa(product.ID), nil, "id", strconv.Itoa(product.ID))

	ctrl.DeleteProduct(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var count int64
	db.Model(&models.Product{}).Where("id = ?", product.ID).Count(&count)
	assert.Equal(t, int64(0), count, "soft-deleted product must be excluded from default queries")
}

func TestInventoryController_ListProducts_ReturnsFlattenedSKUPriceAndBalance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()

	svc := services.NewInventoryService(db, nil)
	ctrl := NewInventoryController(svc)

	c, w := setupPipelineContext(t, db, tenantID, "POST", "/inventory/products", []byte(`{
		"name": "Refrigerante Lata",
		"unit": "UN",
		"skuCode": "SKU-REF-001",
		"priceCents": 550,
		"initialStock": 20
	}`))
	ctrl.CreateProduct(c)
	require.Equal(t, http.StatusCreated, w.Code)

	cList, wList := setupPipelineContext(t, db, tenantID, "GET", "/inventory/products", nil)
	ctrl.ListProducts(cList)
	require.Equal(t, http.StatusOK, wList.Code)

	var body struct {
		Products []productListItem `json:"products"`
	}
	require.NoError(t, json.Unmarshal(wList.Body.Bytes(), &body))
	require.Len(t, body.Products, 1)

	item := body.Products[0]
	assert.Equal(t, "Refrigerante Lata", item.Name)
	assert.Equal(t, "SKU-REF-001", item.SKUCode)
	assert.Equal(t, int64(550), item.PriceCents)
	assert.Equal(t, float64(20), item.CurrentBalance)
}
