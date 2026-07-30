package controllers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/mock"
)

func TestContactController_ImportContacts_NoConnectedSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)

	sessions := &MockChannelSessionRepo{}
	sessions.On("FindAll", mock.Anything, tenantID).Return([]domain.ChannelSession{
		{ID: 1, Status: "DISCONNECTED", TenantID: tenantID},
	}, nil)
	pub := &mockPublisher{}

	ctrl := NewContactController(&MockContactRepo{db: db}, sessions, pub, nil, nil)

	r := gin.New()
	r.Use(testScopedMiddleware(db, tenantID.String()))
	r.POST("/contacts/import", ctrl.ImportContacts)

	req := httptest.NewRequest(http.MethodPost, "/contacts/import", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
	if pub.called {
		t.Fatal("publisher should not be called when no connected session exists")
	}
}

func TestContactController_ImportContacts_PublishesCommand(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)

	sessions := &MockChannelSessionRepo{}
	sessions.On("FindAll", mock.Anything, tenantID).Return([]domain.ChannelSession{
		{ID: 7, Status: "CONNECTED", TenantID: tenantID},
	}, nil)
	pub := &mockPublisher{}

	ctrl := NewContactController(&MockContactRepo{db: db}, sessions, pub, nil, nil)

	r := gin.New()
	r.Use(testScopedMiddleware(db, tenantID.String()))
	r.POST("/contacts/import", ctrl.ImportContacts)

	req := httptest.NewRequest(http.MethodPost, "/contacts/import", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d: %s", w.Code, w.Body.String())
	}
	if !pub.called {
		t.Fatal("publisher should be called for a connected session")
	}
	want := "wbot." + tenantID.String() + ".7.contact.import"
	if pub.routingKey != want {
		t.Fatalf("routing key = %q, want %q", pub.routingKey, want)
	}
}

func TestContactController_ImportContacts_SkipsIzapiaSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenantID := setupContactTestDB(t)

	// Only an izapia session is connected -- bulk import has no izapia
	// equivalent yet, so this must be a clear 409, never a silent 202
	// publish to a routing key nothing consumes.
	sessions := &MockChannelSessionRepo{}
	sessions.On("FindAll", mock.Anything, tenantID).Return([]domain.ChannelSession{
		{ID: 9, Status: "CONNECTED", EngineType: "izapia", TenantID: tenantID},
	}, nil)
	pub := &mockPublisher{}

	ctrl := NewContactController(&MockContactRepo{db: db}, sessions, pub, nil, nil)

	r := gin.New()
	r.Use(testScopedMiddleware(db, tenantID.String()))
	r.POST("/contacts/import", ctrl.ImportContacts)

	req := httptest.NewRequest(http.MethodPost, "/contacts/import", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 for izapia-only connections, got %d: %s", w.Code, w.Body.String())
	}
	if pub.called {
		t.Fatal("publisher should not be called for an izapia session (bulk import unsupported)")
	}
}
