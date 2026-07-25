package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestTenantMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("rejects_x-tenant-id_header", func(t *testing.T) {
		r := gin.New()
		r.Use(TenantMiddleware())
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		req.Header.Set("x-tenant-id", "some-uuid")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		assert.Contains(t, w.Body.String(), "x-tenant-id header is not accepted")
	})

	t.Run("rejects_missing_tenant_in_context", func(t *testing.T) {
		r := gin.New()
		r.Use(TenantMiddleware())
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "tenant context not found")
	})

	t.Run("accepts_with_tenant_in_context", func(t *testing.T) {
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("tenantId", "valid-uuid")
		})
		r.Use(TenantMiddleware())
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}
