package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// mockPublisher is a no-op CommandPublisher for tests.
type mockPublisher struct {
	called     bool
	routingKey string
	err        error
}

func (m *mockPublisher) PublishCommand(routingKey string, payload interface{}) error {
	m.called = true
	m.routingKey = routingKey
	return m.err
}

func setupMessageTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	return testutil.NewTestDB(t)
}

func setupMessageContext(t *testing.T, db *gorm.DB, tenantID uuid.UUID, method, path string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	var req *http.Request
	if body != nil {
		req, _ = http.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, _ = http.NewRequest(method, path, nil)
	}
	c.Request = req

	c.Set("tenantId", tenantID)
	c.Set("alcance", "tenant")
	c.Set("userId", float64(1))
	scoped := db.Where(`"tenantId" = ?`, tenantID)
	c.Set("db", scoped)

	return c, w
}

func TestMessageController_ListMessages_ReturnsEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMessageTestDB(t)
	tenantID := uuid.New()

	// Insert a ticket and two messages
	db.Exec(`INSERT INTO "Tickets" (status, "tenantId") VALUES (?,?)`, "open", tenantID)
	var ticketID int
	db.Raw(`SELECT id FROM "Tickets" WHERE "tenantId" = ?`, tenantID).Scan(&ticketID)

	db.Exec(`INSERT INTO "Messages" (id, body, "ticketId", "tenantId") VALUES (?,?,?,?)`, "msg1", "Olá", ticketID, tenantID)
	db.Exec(`INSERT INTO "Messages" (id, body, "ticketId", "tenantId") VALUES (?,?,?,?)`, "msg2", "Tudo bem", ticketID, tenantID)

	pub := &mockPublisher{}
	ctrl := NewMessageController(pub, nil, nil)
	c, w := setupMessageContext(t, db, tenantID, "GET", fmt.Sprintf("/messages/%d", ticketID), nil)
	c.Params = gin.Params{{Key: "ticketId", Value: fmt.Sprintf("%d", ticketID)}}

	ctrl.ListMessages(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(2), resp["count"])
	msgs := resp["messages"].([]interface{})
	assert.Len(t, msgs, 2)
}

func TestMessageController_ListMessages_FiltersByTenantViaDB(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMessageTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()

	db.Exec(`INSERT INTO "Tickets" (status, "tenantId") VALUES (?,?)`, "open", tenantA)
	var ticketID int
	db.Raw(`SELECT id FROM "Tickets" WHERE "tenantId" = ?`, tenantA).Scan(&ticketID)

	db.Exec(`INSERT INTO "Messages" (id, body, "ticketId", "tenantId") VALUES (?,?,?,?)`, "m-a", "Msg de A", ticketID, tenantA)
	db.Exec(`INSERT INTO "Messages" (id, body, "ticketId", "tenantId") VALUES (?,?,?,?)`, "m-b", "Msg de B", ticketID, tenantB)

	pub := &mockPublisher{}
	ctrl := NewMessageController(pub, nil, nil)
	// Use tenantA scope — tenantB message should not appear
	c, w := setupMessageContext(t, db, tenantA, "GET", fmt.Sprintf("/messages/%d", ticketID), nil)
	c.Params = gin.Params{{Key: "ticketId", Value: fmt.Sprintf("%d", ticketID)}}

	ctrl.ListMessages(c)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(1), resp["count"])
}

func TestMessageController_SendMessage_TicketNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMessageTestDB(t)
	tenantID := uuid.New()

	payload, _ := json.Marshal(map[string]string{"body": "Oi"})
	pub := &mockPublisher{}
	ctrl := NewMessageController(pub, nil, nil)
	c, w := setupMessageContext(t, db, tenantID, "POST", "/messages/9999", payload)
	c.Params = gin.Params{{Key: "ticketId", Value: "9999"}}

	ctrl.SendMessage(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.False(t, pub.called, "publisher should not be called when ticket is not found")
}

func TestMessageController_SendMessage_InvalidTicketID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMessageTestDB(t)
	tenantID := uuid.New()

	payload, _ := json.Marshal(map[string]string{"body": "Oi"})
	pub := &mockPublisher{}
	ctrl := NewMessageController(pub, nil, nil)
	c, w := setupMessageContext(t, db, tenantID, "POST", "/messages/abc", payload)
	c.Params = gin.Params{{Key: "ticketId", Value: "abc"}}

	ctrl.SendMessage(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestMessageController_SendMessage_PublishesCommand(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMessageTestDB(t)
	tenantID := uuid.New()

	db.Exec(`INSERT INTO "Whatsapps" (id, name, "tenantId") VALUES (?,?,?)`, 42, "conn-42", tenantID)
	db.Exec(`INSERT INTO "Contacts" (name, number, "isGroup", "tenantId") VALUES (?,?,?,?)`, "Fulano", "5511999998888", false, tenantID)
	var contactID int
	db.Raw(`SELECT id FROM "Contacts" WHERE "tenantId" = ?`, tenantID).Scan(&contactID)
	db.Exec(`INSERT INTO "Tickets" (status, "whatsappId", "contactId", "tenantId") VALUES (?,?,?,?)`, "open", 42, contactID, tenantID)
	var ticketID int
	db.Raw(`SELECT id FROM "Tickets" WHERE "tenantId" = ?`, tenantID).Scan(&ticketID)

	payload, _ := json.Marshal(map[string]string{"body": "Olá mundo", "mediaType": "chat"})
	pub := &mockPublisher{}
	ctrl := NewMessageController(pub, nil, nil)
	c, w := setupMessageContext(t, db, tenantID, "POST", fmt.Sprintf("/messages/%d", ticketID), payload)
	c.Params = gin.Params{{Key: "ticketId", Value: fmt.Sprintf("%d", ticketID)}}

	ctrl.SendMessage(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, pub.called, "publisher should be called")
	assert.Contains(t, pub.routingKey, "wbot.")
	assert.Contains(t, pub.routingKey, tenantID.String())
	// The command type must be encoded in the routing key so the engine's
	// topic binding (wbot.*.*.message.send.text) actually receives it.
	assert.Contains(t, pub.routingKey, "message.send.text")

	// The outgoing message must be persisted (fromMe) so it shows in the UI
	// and the later ack event can find it.
	var sentCount int64
	db.Model(&models.Message{}).Where(`"ticketId" = ? AND "fromMe" = ?`, ticketID, true).Count(&sentCount)
	assert.Equal(t, int64(1), sentCount, "outgoing message should be persisted")
}

func TestMessageController_SendMessage_Multipart_SavesMediaAndPublishes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMessageTestDB(t)
	tenantID := uuid.New()

	db.Exec(`INSERT INTO "Whatsapps" (id, name, "tenantId") VALUES (?,?,?)`, 42, "conn-42", tenantID)
	db.Exec(`INSERT INTO "Contacts" (name, number, "isGroup", "tenantId") VALUES (?,?,?,?)`, "Fulano", "5511999998888", false, tenantID)
	var contactID int
	db.Raw(`SELECT id FROM "Contacts" WHERE "tenantId" = ?`, tenantID).Scan(&contactID)
	db.Exec(`INSERT INTO "Tickets" (status, "whatsappId", "contactId", "tenantId") VALUES (?,?,?,?)`, "open", 42, contactID, tenantID)
	var ticketID int
	db.Raw(`SELECT id FROM "Tickets" WHERE "tenantId" = ?`, tenantID).Scan(&ticketID)

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	_ = mw.WriteField("body", "foto aqui")
	fw, _ := mw.CreateFormFile("medias", "photo.jpg")
	_, _ = fw.Write([]byte("fakejpegbytes"))
	require.NoError(t, mw.Close())

	pub := &mockPublisher{}
	ctrl := NewMessageController(pub, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", fmt.Sprintf("/messages/%d", ticketID), &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	c.Request = req
	c.Set("tenantId", tenantID)
	c.Set("alcance", "tenant")
	c.Set("userId", float64(1))
	scoped := db.Where(`"tenantId" = ?`, tenantID)
	c.Set("db", scoped)
	c.Params = gin.Params{{Key: "ticketId", Value: fmt.Sprintf("%d", ticketID)}}

	ctrl.SendMessage(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, pub.called)

	var resp map[string]interface{}
	_ = json.NewDecoder(strings.NewReader(w.Body.String())).Decode(&resp)
	assert.Equal(t, "Message sent", resp["message"])
}

func TestMimeTypeToMediaType(t *testing.T) {
	cases := []struct{ mime, want string }{
		{"image/jpeg", "image"},
		{"video/mp4", "video"},
		{"audio/ogg", "audio"},
		{"application/pdf", "document"},
		{"text/plain", "document"},
	}
	for _, tc := range cases {
		assert.Equal(t, tc.want, mimeTypeToMediaType(tc.mime), tc.mime)
	}
}
