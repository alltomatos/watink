package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestInternalSaaSOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)

	const token = "s3cr3t-per-instance-token"

	cases := []struct {
		name       string
		envToken   string
		headerTok  string
		wantStatus int
		wantNext   bool
	}{
		{name: "fail-closed sem env", envToken: "", headerTok: token, wantStatus: http.StatusServiceUnavailable, wantNext: false},
		{name: "sem header", envToken: token, headerTok: "", wantStatus: http.StatusUnauthorized, wantNext: false},
		{name: "token errado", envToken: token, headerTok: "wrong", wantStatus: http.StatusUnauthorized, wantNext: false},
		{name: "token certo", envToken: token, headerTok: token, wantStatus: http.StatusOK, wantNext: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.envToken == "" {
				t.Setenv("SAAS_INTERNAL_TOKEN", "")
			} else {
				t.Setenv("SAAS_INTERNAL_TOKEN", tc.envToken)
			}

			nextCalled := false
			r := gin.New()
			r.GET("/internal/saas/ping", InternalSaaSOnly(), func(c *gin.Context) {
				nextCalled = true
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			req := httptest.NewRequest(http.MethodGet, "/internal/saas/ping", nil)
			if tc.headerTok != "" {
				req.Header.Set("X-Internal-Token", tc.headerTok)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tc.wantStatus {
				t.Fatalf("status = %d, quer %d (body=%s)", w.Code, tc.wantStatus, w.Body.String())
			}
			if nextCalled != tc.wantNext {
				t.Fatalf("nextCalled = %v, quer %v", nextCalled, tc.wantNext)
			}
		})
	}
}
