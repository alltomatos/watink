package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// stubPublisher is a no-op CommandPublisher for tests.
type stubPublisher struct {
	calls []map[string]interface{}
	err   error
}

func (s *stubPublisher) PublishCommand(routingKey string, payload interface{}) error {
	if s.err != nil {
		return s.err
	}
	s.calls = append(s.calls, map[string]interface{}{"routingKey": routingKey, "payload": payload})
	return nil
}

func TestSendMessageTextJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	pub := &stubPublisher{}
	mc := NewMessageController(pub, nil, nil)

	// Seed whatsapp + contact + ticket
	wa := models.Whatsapp{Name: "WA", TenantID: tenantID, Status: "CONNECTED"}
	if err := db.Create(&wa).Error; err != nil {
		t.Fatal(err)
	}
	contact := models.Contact{Name: "C", Number: "5511999999999", TenantID: tenantID}
	if err := db.Create(&contact).Error; err != nil {
		t.Fatal(err)
	}
	ticket := models.Ticket{
		Status:     "open",
		TenantID:   tenantID,
		ContactID:  contact.ID,
		WhatsappID: wa.ID,
	}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	r.Use(testScopedMiddleware(db, tenantID.String()))
	r.POST("/messages/:ticketId", mc.SendMessage)

	t.Run("happy path — text message published", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"body": "Hello", "mediaType": "", "mediaUrl": ""})
		req := httptest.NewRequest(http.MethodPost, "/messages/"+strconv.Itoa(ticket.ID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		r.ServeHTTP(res, req)

		if res.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d — %s", res.Code, res.Body.String())
		}
		if len(pub.calls) == 0 {
			t.Fatal("expected PublishCommand to be called")
		}
	})

	t.Run("ticket not found returns 404", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"body": "Hello"})
		req := httptest.NewRequest(http.MethodPost, "/messages/999999", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		r.ServeHTTP(res, req)

		if res.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", res.Code)
		}
	})

	t.Run("invalid ticket id returns 400", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"body": "Hello"})
		req := httptest.NewRequest(http.MethodPost, "/messages/notanint", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		r.ServeHTTP(res, req)

		if res.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", res.Code)
		}
	})

	t.Run("body too long returns 400", func(t *testing.T) {
		longBody := make([]byte, 65536)
		for i := range longBody {
			longBody[i] = 'x'
		}
		body, _ := json.Marshal(map[string]string{"body": string(longBody)})
		req := httptest.NewRequest(http.MethodPost, "/messages/"+strconv.Itoa(ticket.ID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		r.ServeHTTP(res, req)

		if res.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", res.Code)
		}
	})

	t.Run("wrong tenant cannot send message", func(t *testing.T) {
		rOther := gin.New()
		rOther.Use(testScopedMiddleware(db, uuid.New().String()))
		rOther.POST("/messages/:ticketId", mc.SendMessage)

		body, _ := json.Marshal(map[string]string{"body": "Hello"})
		req := httptest.NewRequest(http.MethodPost, "/messages/"+strconv.Itoa(ticket.ID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		rOther.ServeHTTP(res, req)

		if res.Code != http.StatusNotFound {
			t.Fatalf("expected 404 for cross-tenant, got %d", res.Code)
		}
	})
}

func TestReactToMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutil.NewTestDB(t)
	tenantID := uuid.New()
	pub := &stubPublisher{}
	mc := NewMessageController(pub, nil, nil)

	wa := models.Whatsapp{Name: "WA", TenantID: tenantID, Status: "CONNECTED"}
	if err := db.Create(&wa).Error; err != nil {
		t.Fatal(err)
	}
	contact := models.Contact{Name: "C", Number: "5511999999999", TenantID: tenantID}
	if err := db.Create(&contact).Error; err != nil {
		t.Fatal(err)
	}
	ticket := models.Ticket{Status: "open", TenantID: tenantID, ContactID: contact.ID, WhatsappID: wa.ID}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatal(err)
	}
	msg := models.Message{
		ID:        "MSG1",
		Body:      "Olá",
		TicketID:  ticket.ID,
		FromMe:    false,
		ContactID: &contact.ID,
		TenantID:  tenantID,
		Reactions: "[]",
	}
	if err := db.Create(&msg).Error; err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	r.Use(testScopedMiddleware(db, tenantID.String()))
	r.POST("/messages/:messageId/react", mc.ReactToMessage)

	t.Run("happy path — publishes command and persists optimistic reaction", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"reaction": "👍"})
		req := httptest.NewRequest(http.MethodPost, "/messages/MSG1/react", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		r.ServeHTTP(res, req)

		if res.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d — %s", res.Code, res.Body.String())
		}
		if len(pub.calls) == 0 {
			t.Fatal("expected PublishCommand to be called")
		}

		var updated models.Message
		if err := db.First(&updated, "id = ?", "MSG1").Error; err != nil {
			t.Fatal(err)
		}
		if updated.Reactions == "[]" || updated.Reactions == "" {
			t.Fatalf("expected reactions to be persisted, got %q", updated.Reactions)
		}
	})

	t.Run("empty reaction removes the bot's own reaction", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"reaction": ""})
		req := httptest.NewRequest(http.MethodPost, "/messages/MSG1/react", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		r.ServeHTTP(res, req)

		if res.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d — %s", res.Code, res.Body.String())
		}

		var updated models.Message
		if err := db.First(&updated, "id = ?", "MSG1").Error; err != nil {
			t.Fatal(err)
		}
		if updated.Reactions != "[]" {
			t.Fatalf("expected reactions to be cleared, got %q", updated.Reactions)
		}
	})

	t.Run("message not found returns 404", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"reaction": "👍"})
		req := httptest.NewRequest(http.MethodPost, "/messages/DOES-NOT-EXIST/react", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		r.ServeHTTP(res, req)

		if res.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", res.Code)
		}
	})

	t.Run("wrong tenant cannot react", func(t *testing.T) {
		rOther := gin.New()
		rOther.Use(testScopedMiddleware(db, uuid.New().String()))
		rOther.POST("/messages/:messageId/react", mc.ReactToMessage)

		body, _ := json.Marshal(map[string]string{"reaction": "👍"})
		req := httptest.NewRequest(http.MethodPost, "/messages/MSG1/react", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		rOther.ServeHTTP(res, req)

		if res.Code != http.StatusNotFound {
			t.Fatalf("expected 404 for cross-tenant, got %d", res.Code)
		}
	})
}

func TestSanitizeMimeType(t *testing.T) {
	cases := []struct {
		input    string
		wantSafe bool // just check it doesn't contain control chars
	}{
		{"image/jpeg", true},
		{"video/mp4", true},
		{"", true},                   // falls back to application/octet-stream
		{"image/jpeg\nhacked", true}, // newline stripped
	}
	for _, tc := range cases {
		got := sanitizeMimeType(tc.input)
		for _, ch := range got {
			if ch == '\n' || ch == '\r' || ch < 0x20 {
				t.Errorf("sanitizeMimeType(%q) contains control char in %q", tc.input, got)
			}
		}
		if got == "" {
			t.Errorf("sanitizeMimeType(%q) returned empty string", tc.input)
		}
	}
}

func TestMimeTypeToMediaTypeSend(t *testing.T) {
	cases := []struct{ mime, want string }{
		{"image/jpeg", "image"},
		{"video/mp4", "video"},
		{"audio/mpeg", "audio"},
		{"application/pdf", "document"},
		{"", "document"},
	}
	for _, tc := range cases {
		got := mimeTypeToMediaType(tc.mime)
		if got != tc.want {
			t.Errorf("mimeTypeToMediaType(%q) = %q, want %q", tc.mime, got, tc.want)
		}
	}
}
