package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// testScopedMiddleware simula o middleware de autenticação injetando DB, tenantId e alcance.
func testScopedMiddleware(db *gorm.DB, tenantID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("db", db)
		c.Set("tenantId", tenantID)
		c.Set("alcance", "tenant")
		c.Set("userId", 1)
		c.Next()
	}
}

func TestUpdateContactDoesNotAcceptTenantIDFromPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := testutil.NewTestDB(t)

	mockRepo := &MockContactRepo{db: db}
	controller := NewContactController(mockRepo, nil, nil, nil, nil)

	tenantA := uuid.New()
	tenantB := uuid.New()
	contact := models.Contact{Name: "Original", Number: "5511999999999", Email: "original@example.com", TenantID: tenantA}
	if err := db.Create(&contact).Error; err != nil {
		t.Fatal(err)
	}

	payload := map[string]interface{}{
		"id":       contact.ID + 1000,
		"name":     "Updated",
		"number":   "5511888888888",
		"email":    "updated@example.com",
		"tenantId": tenantB.String(),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	router := gin.New()
	router.Use(testScopedMiddleware(db, tenantA.String()))
	router.PUT("/contacts/:contactId", controller.UpdateContact)

	req := httptest.NewRequest(http.MethodPut, "/contacts/"+strconv.Itoa(contact.ID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", res.Code, res.Body.String())
	}

	var updated models.Contact
	if err := db.First(&updated, contact.ID).Error; err != nil {
		t.Fatal(err)
	}
	if updated.TenantID != tenantA {
		t.Fatalf("tenantId changed to %s", updated.TenantID)
	}
	if updated.ID != contact.ID {
		t.Fatalf("id changed to %d", updated.ID)
	}
	if updated.Name != "Updated" {
		t.Fatalf("name = %s", updated.Name)
	}
}

type MockContactRepo struct{ db *gorm.DB }

func (m *MockContactRepo) FindByID(ctx context.Context, id int, tenantID uuid.UUID) (*domain.Contact, error) {
	var c models.Contact
	if err := m.db.Where("id = ? AND \"tenantId\" = ?", id, tenantID).First(&c).Error; err != nil {
		if err.Error() == "record not found" {
			return nil, nil
		}
		return nil, err
	}
	return &domain.Contact{ID: c.ID, Name: c.Name, TenantID: c.TenantID}, nil
}
func (m *MockContactRepo) Update(ctx context.Context, contact *domain.Contact, fields map[string]interface{}) error {
	return m.db.Model(&models.Contact{}).Where("id = ? AND \"tenantId\" = ?", contact.ID, contact.TenantID).Updates(fields).Error
}
func (m *MockContactRepo) Find(ctx context.Context, tenantID uuid.UUID, search string) ([]domain.Contact, error) {
	return nil, nil
}
func (m *MockContactRepo) FindByNumber(ctx context.Context, tenantID uuid.UUID, number string, isGroup bool) (*domain.Contact, error) {
	return nil, nil
}
func (m *MockContactRepo) FindByLID(ctx context.Context, tenantID uuid.UUID, lid string, isGroup bool) (*domain.Contact, error) {
	return nil, nil
}
func (m *MockContactRepo) FindOrCreate(ctx context.Context, tenantID uuid.UUID, number, pushName, profilePicUrl string, isGroup, isLid bool, lid string) (*domain.Contact, error) {
	return nil, nil
}
func (m *MockContactRepo) Create(ctx context.Context, contact *domain.Contact) error { return nil }
func (m *MockContactRepo) Delete(ctx context.Context, id int, tenantID uuid.UUID) error {
	return nil
}
func (m *MockContactRepo) BulkDelete(ctx context.Context, ids []int, tenantID uuid.UUID) (int64, error) {
	tx := m.db.Where("id IN ? AND \"tenantId\" = ?", ids, tenantID).Delete(&models.Contact{})
	return tx.RowsAffected, tx.Error
}
func (m *MockContactRepo) DeleteAll(ctx context.Context, tenantID uuid.UUID) (int64, error) {
	tx := m.db.Where("\"tenantId\" = ?", tenantID).Delete(&models.Contact{})
	return tx.RowsAffected, tx.Error
}

// ── additional contact tests ──────────────────────────────────────────────────

func setupContactTestDB(t *testing.T) (*gorm.DB, uuid.UUID) {
	t.Helper()
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	return db, tenantID
}

func newContactRouter(db *gorm.DB, tenantID string) *gin.Engine {
	r := gin.New()
	r.Use(testScopedMiddleware(db, tenantID))
	repo := &MockContactRepo{db: db}
	ctrl := NewContactController(repo, nil, nil, nil, nil)
	r.GET("/contacts", ctrl.ListContacts)
	r.GET("/contacts/:contactId", ctrl.ShowContact)
	r.POST("/contacts", ctrl.CreateContact)
	r.PUT("/contacts/:contactId", ctrl.UpdateContact)
	r.DELETE("/contacts/:contactId", ctrl.DeleteContact)
	r.POST("/contacts/bulk-delete", ctrl.BulkDeleteContacts)
	r.DELETE("/contacts/all", ctrl.DeleteAllContacts)
	return r
}

func TestContactController_ListContacts_ReturnsEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)
	c := models.Contact{Name: "Ana", Number: "5511001", Email: "ana@test.com", TenantID: tenantID}
	if err := db.Create(&c).Error; err != nil {
		t.Fatal(err)
	}

	router := newContactRouter(db, tenantID.String())
	req := httptest.NewRequest(http.MethodGet, "/contacts", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if _, ok := resp["contacts"]; !ok {
		t.Fatal("response missing 'contacts' key")
	}
}

func TestContactController_ShowContact_Found(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)
	c := models.Contact{Name: "Bob", Number: "5511002", Email: "bob@test.com", TenantID: tenantID}
	if err := db.Create(&c).Error; err != nil {
		t.Fatal(err)
	}

	router := newContactRouter(db, tenantID.String())
	req := httptest.NewRequest(http.MethodGet, "/contacts/"+strconv.Itoa(c.ID), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestContactController_ShowContact_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)

	router := newContactRouter(db, tenantID.String())
	req := httptest.NewRequest(http.MethodGet, "/contacts/9999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestContactController_CreateContact_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)

	payload, _ := json.Marshal(map[string]interface{}{
		"name":   "Carlos",
		"number": "5511003",
		"email":  "carlos@test.com",
	})

	router := newContactRouter(db, tenantID.String())
	req := httptest.NewRequest(http.MethodPost, "/contacts", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestContactController_BulkDeleteContacts_DeletesOnlyOwnTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)
	otherTenant := uuid.New()

	c1 := models.Contact{Name: "A", Number: "1", TenantID: tenantID}
	c2 := models.Contact{Name: "B", Number: "2", TenantID: tenantID}
	other := models.Contact{Name: "Other", Number: "3", TenantID: otherTenant}
	for _, c := range []*models.Contact{&c1, &c2, &other} {
		if err := db.Create(c).Error; err != nil {
			t.Fatal(err)
		}
	}

	router := newContactRouter(db, tenantID.String())
	payload, _ := json.Marshal(map[string]interface{}{"ids": []int{c1.ID, c2.ID, other.ID}})
	req := httptest.NewRequest(http.MethodPost, "/contacts/bulk-delete", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp["deleted"] != float64(2) {
		t.Fatalf("deleted = %v, want 2 (other tenant's contact must survive)", resp["deleted"])
	}

	var remaining models.Contact
	if err := db.First(&remaining, other.ID).Error; err != nil {
		t.Fatalf("other tenant's contact was deleted: %v", err)
	}
}

func TestContactController_BulkDeleteContacts_RejectsEmptyIDs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)

	router := newContactRouter(db, tenantID.String())
	payload, _ := json.Marshal(map[string]interface{}{"ids": []int{}})
	req := httptest.NewRequest(http.MethodPost, "/contacts/bulk-delete", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestContactController_DeleteAllContacts_ScopedToTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)
	otherTenant := uuid.New()

	c1 := models.Contact{Name: "A", Number: "1", TenantID: tenantID}
	other := models.Contact{Name: "Other", Number: "2", TenantID: otherTenant}
	if err := db.Create(&c1).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}

	router := newContactRouter(db, tenantID.String())
	req := httptest.NewRequest(http.MethodDelete, "/contacts/all", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var remainingOwn []models.Contact
	if err := db.Where("\"tenantId\" = ?", tenantID).Find(&remainingOwn).Error; err != nil {
		t.Fatal(err)
	}
	if len(remainingOwn) != 0 {
		t.Fatalf("expected 0 remaining contacts for tenant, got %d", len(remainingOwn))
	}

	var remainingOther models.Contact
	if err := db.First(&remainingOther, other.ID).Error; err != nil {
		t.Fatalf("other tenant's contact was deleted: %v", err)
	}
}

func TestContactController_DeleteContact_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)
	c := models.Contact{Name: "Diana", Number: "5511004", Email: "diana@test.com", TenantID: tenantID}
	if err := db.Create(&c).Error; err != nil {
		t.Fatal(err)
	}

	router := newContactRouter(db, tenantID.String())
	req := httptest.NewRequest(http.MethodDelete, "/contacts/"+strconv.Itoa(c.ID), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
