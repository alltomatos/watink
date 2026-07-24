package plugins

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

// removeMediaFile limpa o arquivo que mediastore.SaveMediaReader gravou em
// disco (path relativo, ex. "/public/media/<hash>.png") — mediaPublicDir é
// var não-exportada do pacote mediastore, sem seam de override entre
// pacotes, então o teste limpa manualmente pelo path devolvido.
func removeMediaFile(url string) error {
	return os.Remove(strings.TrimPrefix(url, "/"))
}

// tenantMiddleware simula IsAuth+TenantMiddleware (mesmo padrão de
// controllers/contact_test.go testScopedMiddleware) — os handlers do
// Helpdesk só dependem de tenantId/userId no contexto, nunca de "db"/
// "alcance" (não usam auth.GetScoped).
func tenantMiddleware(tenantID uuid.UUID, userID int) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("tenantId", tenantID)
		c.Set("userId", userID)
		c.Next()
	}
}

func newHelpdeskTestRouter(t *testing.T, db *gorm.DB, tenantID uuid.UUID) (*gin.Engine, *MockWatinkCore) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	mc := new(MockWatinkCore)
	mc.On("GetDB").Return(db)
	mc.On("EmitSocketEvent", mock.Anything, mock.Anything, mock.Anything).Return()

	r := gin.New()
	r.Use(tenantMiddleware(tenantID, 1))
	r.GET("/protocols", handleListProtocols(mc))
	r.GET("/protocols/kanban", handleKanban(mc))
	r.GET("/protocols/dashboard", handleDashboard(mc))
	r.POST("/protocols", handleCreateProtocol(mc))
	r.GET("/protocols/:id", handleGetProtocol(mc))
	r.PUT("/protocols/:id", handleUpdateProtocol(mc))
	r.GET("/protocols/:id/attachments", handleListAttachments(mc))
	r.POST("/protocols/:id/attachments", handleUploadAttachments(mc))
	r.DELETE("/protocols/:id/attachments/:attachmentId", handleDeleteAttachment(mc))

	return r, mc
}

func createTestContact(t *testing.T, db *gorm.DB, tenantID uuid.UUID) models.Contact {
	t.Helper()
	contact := models.Contact{Name: "Cliente Teste", Number: uuid.NewString(), TenantID: tenantID}
	if err := db.Create(&contact).Error; err != nil {
		t.Fatalf("failed to create contact: %v", err)
	}
	return contact
}

func TestHandleCreateProtocol_Success(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	contact := createTestContact(t, db, tenantID)
	r, mc := newHelpdeskTestRouter(t, db, tenantID)

	body, _ := json.Marshal(map[string]interface{}{
		"subject":   "Não recebo notificações",
		"contactId": contact.ID,
		"priority":  "high",
	})
	req := httptest.NewRequest(http.MethodPost, "/protocols", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	var resp protocolDetailDTO
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotEmpty(t, resp.ProtocolNumber)
	assert.NotEmpty(t, resp.Token)
	assert.Equal(t, "open", resp.Status)
	assert.Equal(t, "high", resp.Priority)

	var count int64
	db.Model(&models.Protocol{}).Where(`"tenantId" = ?`, tenantID).Count(&count)
	assert.Equal(t, int64(1), count)

	var logs []models.ProtocolLog
	db.Where(`"protocolId" = ?`, resp.ID).Find(&logs)
	assert.Len(t, logs, 1)
	assert.Equal(t, "create", logs[0].Action)

	mc.AssertCalled(t, "EmitSocketEvent", "tenant:"+tenantID.String(), "protocol", mock.Anything)
}

func TestHandleCreateProtocol_WithTicketID_NotifiesViaWhatsApp(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	contact := createTestContact(t, db, tenantID)
	ticket := models.Ticket{ContactID: contact.ID, WhatsappID: 1, TenantID: tenantID}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatalf("failed to create ticket: %v", err)
	}

	mc := new(MockWatinkCore)
	mc.On("GetDB").Return(db)
	mc.On("EmitSocketEvent", mock.Anything, mock.Anything, mock.Anything).Return()
	mc.On("SendTicketMessage", tenantID, ticket.ID, mock.AnythingOfType("string")).Return(nil)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(tenantMiddleware(tenantID, 1))
	r.POST("/protocols", handleCreateProtocol(mc))

	body, _ := json.Marshal(map[string]interface{}{
		"subject":   "Não recebo notificações",
		"contactId": contact.ID,
		"ticketId":  ticket.ID,
	})
	req := httptest.NewRequest(http.MethodPost, "/protocols", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	var resp protocolDetailDTO
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	mc.AssertCalled(t, "SendTicketMessage", tenantID, ticket.ID, mock.MatchedBy(func(body string) bool {
		return strings.Contains(body, resp.ProtocolNumber) && strings.Contains(body, "/public/protocols/"+resp.Token)
	}))
}

func TestHandleCreateProtocol_WithoutTicketID_DoesNotNotify(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	contact := createTestContact(t, db, tenantID)
	r, mc := newHelpdeskTestRouter(t, db, tenantID)

	body, _ := json.Marshal(map[string]interface{}{"subject": "x", "contactId": contact.ID})
	req := httptest.NewRequest(http.MethodPost, "/protocols", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	mc.AssertNotCalled(t, "SendTicketMessage", mock.Anything, mock.Anything, mock.Anything)
}

func TestHandleCreateProtocol_UnknownContact_Returns422(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	r, _ := newHelpdeskTestRouter(t, db, tenantID)

	body, _ := json.Marshal(map[string]interface{}{"subject": "x", "contactId": 999999})
	req := httptest.NewRequest(http.MethodPost, "/protocols", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestHandleCreateProtocol_ContactFromOtherTenant_Returns422(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	contactOfB := createTestContact(t, db, tenantB)

	r, _ := newHelpdeskTestRouter(t, db, tenantA)
	body, _ := json.Marshal(map[string]interface{}{"subject": "x", "contactId": contactOfB.ID})
	req := httptest.NewRequest(http.MethodPost, "/protocols", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestHandleListProtocols_FiltersByStatusAndNeverLeaksOtherTenant(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	contactA := createTestContact(t, db, tenantA)
	contactB := createTestContact(t, db, tenantB)

	db.Create(&models.Protocol{ProtocolNumber: "P1", Subject: "Aberto A", Status: "open", Priority: "medium", Token: uuid.NewString(), ContactID: contactA.ID, TenantID: tenantA})
	db.Create(&models.Protocol{ProtocolNumber: "P2", Subject: "Fechado A", Status: "closed", Priority: "medium", Token: uuid.NewString(), ContactID: contactA.ID, TenantID: tenantA})
	db.Create(&models.Protocol{ProtocolNumber: "P3", Subject: "Aberto B", Status: "open", Priority: "medium", Token: uuid.NewString(), ContactID: contactB.ID, TenantID: tenantB})

	r, _ := newHelpdeskTestRouter(t, db, tenantA)

	req := httptest.NewRequest(http.MethodGet, "/protocols?status=open", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Protocols []protocolListItemDTO `json:"protocols"`
	}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp.Protocols, 1)
	assert.Equal(t, "Aberto A", resp.Protocols[0].Subject)
}

func TestHandleGetProtocol_CrossTenant_Returns404(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	contactA := createTestContact(t, db, tenantA)
	protocol := models.Protocol{ProtocolNumber: "P1", Subject: "s", Status: "open", Priority: "medium", Token: uuid.NewString(), ContactID: contactA.ID, TenantID: tenantA}
	db.Create(&protocol)

	r, _ := newHelpdeskTestRouter(t, db, tenantB)
	req := httptest.NewRequest(http.MethodGet, "/protocols/"+strconv.Itoa(protocol.ID), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleUpdateProtocol_StatusChange_LogsHistoryAndEmits(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	contact := createTestContact(t, db, tenantID)
	protocol := models.Protocol{ProtocolNumber: "P1", Subject: "s", Status: "open", Priority: "medium", Token: uuid.NewString(), ContactID: contact.ID, TenantID: tenantID}
	db.Create(&protocol)

	r, mc := newHelpdeskTestRouter(t, db, tenantID)

	form := &bytes.Buffer{}
	mw := multipart.NewWriter(form)
	_ = mw.WriteField("status", "resolved")
	_ = mw.WriteField("priority", "medium")
	_ = mw.WriteField("comment", "Resolvido via troca de senha")
	_ = mw.WriteField("subject", protocol.Subject)
	_ = mw.WriteField("description", "")
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPut, "/protocols/"+strconv.Itoa(protocol.ID), form)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var resp protocolDetailDTO
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "resolved", resp.Status)
	// history: 1 status-change entry + 1 comment entry.
	assert.Len(t, resp.History, 2)

	mc.AssertCalled(t, "EmitSocketEvent", "tenant:"+tenantID.String(), "protocol", mock.Anything)
}

func TestHandleKanban_GroupsProtocolsByStatus(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	contact := createTestContact(t, db, tenantID)
	db.Create(&models.Protocol{ProtocolNumber: "P1", Subject: "s1", Status: "open", Priority: "low", Token: uuid.NewString(), ContactID: contact.ID, TenantID: tenantID})
	db.Create(&models.Protocol{ProtocolNumber: "P2", Subject: "s2", Status: "resolved", Priority: "low", Token: uuid.NewString(), ContactID: contact.ID, TenantID: tenantID})

	r, _ := newHelpdeskTestRouter(t, db, tenantID)
	req := httptest.NewRequest(http.MethodGet, "/protocols/kanban", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Columns []struct {
			Status    string              `json:"status"`
			Protocols []kanbanProtocolDTO `json:"protocols"`
		} `json:"columns"`
	}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp.Columns, 5)

	byStatus := map[string]int{}
	for _, col := range resp.Columns {
		byStatus[col.Status] = len(col.Protocols)
	}
	assert.Equal(t, 1, byStatus["open"])
	assert.Equal(t, 1, byStatus["resolved"])
	assert.Equal(t, 0, byStatus["closed"])
}

func TestHandleDashboard_AggregatesCounts(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	contact := createTestContact(t, db, tenantID)
	db.Create(&models.Protocol{ProtocolNumber: "P1", Subject: "s1", Category: "Incidente", Status: "open", Priority: "high", Token: uuid.NewString(), ContactID: contact.ID, TenantID: tenantID})
	db.Create(&models.Protocol{ProtocolNumber: "P2", Subject: "s2", Category: "Incidente", Status: "open", Priority: "high", Token: uuid.NewString(), ContactID: contact.ID, TenantID: tenantID})
	db.Create(&models.Protocol{ProtocolNumber: "P3", Subject: "s3", Category: "Dúvida", Status: "closed", Priority: "low", Token: uuid.NewString(), ContactID: contact.ID, TenantID: tenantID})

	r, _ := newHelpdeskTestRouter(t, db, tenantID)
	req := httptest.NewRequest(http.MethodGet, "/protocols/dashboard", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		StatusCounts   []statusCount   `json:"statusCounts"`
		PriorityCounts []priorityCount `json:"priorityCounts"`
		CategoryCounts []categoryCount `json:"categoryCounts"`
	}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	totalStatus := int64(0)
	for _, sc := range resp.StatusCounts {
		totalStatus += sc.Count
	}
	assert.Equal(t, int64(3), totalStatus)

	foundIncidente := false
	for _, cc := range resp.CategoryCounts {
		if cc.Category == "Incidente" {
			assert.Equal(t, int64(2), cc.Count)
			foundIncidente = true
		}
	}
	assert.True(t, foundIncidente, "expected Incidente category count")
}

func TestHandleAttachments_UploadListDelete(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	contact := createTestContact(t, db, tenantID)
	protocol := models.Protocol{ProtocolNumber: "P1", Subject: "s", Status: "open", Priority: "medium", Token: uuid.NewString(), ContactID: contact.ID, TenantID: tenantID}
	db.Create(&protocol)

	r, _ := newHelpdeskTestRouter(t, db, tenantID)

	form := &bytes.Buffer{}
	mw := multipart.NewWriter(form)
	part, _ := mw.CreateFormFile("files", "print.png")
	_, _ = part.Write([]byte("fake-png-bytes"))
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/protocols/"+strconv.Itoa(protocol.ID)+"/attachments", form)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	var created []models.ProtocolAttachment
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	if !assert.Len(t, created, 1) {
		return
	}
	assert.Equal(t, "print.png", created[0].FileName)
	assert.NotEmpty(t, created[0].URL)
	t.Cleanup(func() { _ = removeMediaFile(created[0].URL) })

	// List
	reqList := httptest.NewRequest(http.MethodGet, "/protocols/"+strconv.Itoa(protocol.ID)+"/attachments", nil)
	wList := httptest.NewRecorder()
	r.ServeHTTP(wList, reqList)
	assert.Equal(t, http.StatusOK, wList.Code)
	var listed []models.ProtocolAttachment
	assert.NoError(t, json.Unmarshal(wList.Body.Bytes(), &listed))
	assert.Len(t, listed, 1)

	// Delete
	reqDel := httptest.NewRequest(http.MethodDelete, "/protocols/"+strconv.Itoa(protocol.ID)+"/attachments/"+strconv.Itoa(created[0].ID), nil)
	wDel := httptest.NewRecorder()
	r.ServeHTTP(wDel, reqDel)
	assert.Equal(t, http.StatusOK, wDel.Code)

	var count int64
	db.Model(&models.ProtocolAttachment{}).Where(`"protocolId" = ?`, protocol.ID).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestHandlePublicProtocol_ByToken_NoAuthNeeded(t *testing.T) {
	db := setupPluginTestDB(t)
	tenantID := uuid.New()
	tenant := models.Tenant{ID: tenantID, Name: "Empresa Teste"}
	db.Create(&tenant)
	contact := createTestContact(t, db, tenantID)
	token := uuid.NewString()
	protocol := models.Protocol{ProtocolNumber: "P1", Subject: "Assunto Público", Status: "open", Priority: "medium", Token: token, ContactID: contact.ID, TenantID: tenantID}
	db.Create(&protocol)

	mc := new(MockWatinkCore)
	mc.On("GetDB").Return(db)
	r := gin.New()
	r.GET("/public/protocols/:token", handlePublicProtocol(mc))

	req := httptest.NewRequest(http.MethodGet, "/public/protocols/"+token, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		ProtocolNumber string `json:"protocolNumber"`
		Tenant         struct {
			Name string `json:"name"`
		} `json:"tenant"`
	}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "P1", resp.ProtocolNumber)
	assert.Equal(t, "Empresa Teste", resp.Tenant.Name)
}

func TestHandlePublicProtocol_UnknownToken_Returns404(t *testing.T) {
	db := setupPluginTestDB(t)
	mc := new(MockWatinkCore)
	mc.On("GetDB").Return(db)
	r := gin.New()
	r.GET("/public/protocols/:token", handlePublicProtocol(mc))

	req := httptest.NewRequest(http.MethodGet, "/public/protocols/does-not-exist", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
