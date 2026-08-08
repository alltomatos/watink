package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestTenantStatusGate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("bypasses_superadmin_without_touching_db", func(t *testing.T) {
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("alcance", "plataforma")
		})
		// svc is nil on purpose: a superadmin request must never dereference it.
		r.Use(TenantStatusGate(nil))
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("passes_through_when_tenantId_missing_from_context", func(t *testing.T) {
		r := gin.New()
		r.Use(TenantStatusGate(nil))
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("allows_active_tenant", func(t *testing.T) {
		db := testutil.NewTestDB(t)
		tenant := models.Tenant{Name: "Active Co", Status: "active"}
		if err := db.Create(&tenant).Error; err != nil {
			t.Fatalf("create tenant: %v", err)
		}
		svc := services.NewTenantStatusService(db)

		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("tenantId", tenant.ID.String())
		})
		r.Use(TenantStatusGate(svc))
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("blocks_suspended_tenant", func(t *testing.T) {
		db := testutil.NewTestDB(t)
		tenant := models.Tenant{Name: "Suspended Co", Status: "suspended"}
		if err := db.Create(&tenant).Error; err != nil {
			t.Fatalf("create tenant: %v", err)
		}
		svc := services.NewTenantStatusService(db)

		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("tenantId", tenant.ID.String())
		})
		r.Use(TenantStatusGate(svc))
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Contains(t, w.Body.String(), "tenant_suspended")
	})

	t.Run("blocks_canceled_tenant", func(t *testing.T) {
		db := testutil.NewTestDB(t)
		tenant := models.Tenant{Name: "Canceled Co", Status: "canceled"}
		if err := db.Create(&tenant).Error; err != nil {
			t.Fatalf("create tenant: %v", err)
		}
		svc := services.NewTenantStatusService(db)

		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("tenantId", tenant.ID.String())
		})
		r.Use(TenantStatusGate(svc))
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("superadmin_still_bypasses_even_for_suspended_tenant", func(t *testing.T) {
		db := testutil.NewTestDB(t)
		tenant := models.Tenant{Name: "Suspended Co 2", Status: "suspended"}
		if err := db.Create(&tenant).Error; err != nil {
			t.Fatalf("create tenant: %v", err)
		}
		svc := services.NewTenantStatusService(db)

		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("tenantId", tenant.ID.String())
			c.Set("alcance", "plataforma")
		})
		r.Use(TenantStatusGate(svc))
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("invalidate_clears_cache_so_status_change_takes_effect_immediately", func(t *testing.T) {
		db := testutil.NewTestDB(t)
		tenant := models.Tenant{Name: "Toggle Co", Status: "active"}
		if err := db.Create(&tenant).Error; err != nil {
			t.Fatalf("create tenant: %v", err)
		}
		svc := services.NewTenantStatusService(db)

		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("tenantId", tenant.ID.String())
		})
		r.Use(TenantStatusGate(svc))
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)

		if err := db.Model(&models.Tenant{}).Where("id = ?", tenant.ID).Update("status", "suspended").Error; err != nil {
			t.Fatalf("update status: %v", err)
		}
		svc.Invalidate(tenant.ID)

		req2, _ := http.NewRequest("GET", "/protected", nil)
		w2 := httptest.NewRecorder()
		r.ServeHTTP(w2, req2)
		assert.Equal(t, http.StatusForbidden, w2.Code)
	})
}
