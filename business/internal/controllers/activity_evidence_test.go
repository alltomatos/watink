package controllers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// fakeActivityObjectStore é um domain.ObjectStore em memória — mock local
// dentro do teste, sem variável global (padrão do repo). Guarda bytes
// crus por chave; PresignedGetURL devolve uma URL sintética previsível.
type fakeActivityObjectStore struct {
	objects map[string][]byte
}

func newFakeActivityObjectStore() *fakeActivityObjectStore {
	return &fakeActivityObjectStore{objects: map[string][]byte{}}
}

func (f *fakeActivityObjectStore) Upload(_ context.Context, key string, r io.Reader, _ int64, _ string) error {
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	f.objects[key] = data
	return nil
}

func (f *fakeActivityObjectStore) Download(_ context.Context, key string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(f.objects[key])), nil
}

func (f *fakeActivityObjectStore) PresignedGetURL(_ context.Context, key string, ttl time.Duration) (string, error) {
	return "https://fake-store.local/watink-activities/" + key + "?ttl=" + ttl.String(), nil
}

func (f *fakeActivityObjectStore) Describe() map[string]any {
	return map[string]any{"bucket": "watink-activities"}
}

// TestNormalizeActivityPhotoValue_StripsPresignedURLToKey é o critério
// anti-staleness central de #531: o frontend re-envia a URL assinada
// retornada pelo upload como `value` do item — persistir essa URL crua
// gravaria um link que expira; a normalização reduz sempre à chave.
func TestNormalizeActivityPhotoValue_StripsPresignedURLToKey(t *testing.T) {
	cases := []struct {
		name   string
		bucket string
		raw    string
		want   string
	}{
		{
			name:   "presigned path-style com bucket no path",
			bucket: "watink-activities",
			raw:    "https://minio.internal:9000/watink-activities/tenant-a/activities/5/items/9/foto.jpg?X-Amz-Signature=abc&X-Amz-Expires=86400",
			want:   "tenant-a/activities/5/items/9/foto.jpg",
		},
		{
			name:   "ja e uma chave crua (sem URL)",
			bucket: "watink-activities",
			raw:    "tenant-a/activities/5/items/9/foto.jpg",
			want:   "tenant-a/activities/5/items/9/foto.jpg",
		},
		{
			name:   "vazio permanece vazio",
			bucket: "watink-activities",
			raw:    "",
			want:   "",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, normalizeActivityPhotoValue(tc.bucket, tc.raw))
		})
	}
}

// TestActivityController_UploadItemPhoto_NilStore_DoesNotPanic — sem
// S3_* configurado (ac.s3Store == nil), o upload devolve erro JSON,
// nunca panic. Mesma garantia de knowledge_base_mutation.go:278-282.
func TestActivityController_UploadItemPhoto_NilStore_DoesNotPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	activityID := mustCreateActivity(t, db, tenantID, "Atividade", "in_progress", "medium")
	item := models.ActivityChecklistItem{ActivityID: activityID, TenantID: tenantID, Label: "Foto", InputType: "photo"}
	require.NoError(t, db.Create(&item).Error)

	body, contentType := multipartPhotoBody(t, "photo", "foto.jpg", []byte("conteudo-fake-de-imagem"))
	c, w := setupMultipartContext(t, db, tenantID, "/activities/"+itoa(activityID)+"/items/"+itoa(item.ID)+"/photo", body, contentType)
	c.Params = gin.Params{{Key: "id", Value: itoa(activityID)}, {Key: "itemId", Value: itoa(item.ID)}}

	assert.NotPanics(t, func() { ctrl.UploadItemPhoto(c) })
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// TestActivityController_UploadItemPhoto_ExceedsCap_Returns413 confirma que
// o cap de 10MB é aplicado mesmo sem s3Store configurado — o
// MaxBytesReader roda ANTES da checagem de store.
func TestActivityController_UploadItemPhoto_ExceedsCap_Returns413(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	activityID := mustCreateActivity(t, db, tenantID, "Atividade", "in_progress", "medium")
	item := models.ActivityChecklistItem{ActivityID: activityID, TenantID: tenantID, Label: "Foto", InputType: "photo"}
	require.NoError(t, db.Create(&item).Error)

	oversized := bytes.Repeat([]byte("a"), activityPhotoUploadMaxBytes+1024)
	body, contentType := multipartPhotoBody(t, "photo", "grande.jpg", oversized)
	c, w := setupMultipartContext(t, db, tenantID, "/activities/"+itoa(activityID)+"/items/"+itoa(item.ID)+"/photo", body, contentType)
	c.Params = gin.Params{{Key: "id", Value: itoa(activityID)}, {Key: "itemId", Value: itoa(item.ID)}}

	ctrl.UploadItemPhoto(c)
	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code, "body: %s", w.Body.String())
}

// TestActivityController_Finalize_NilStore_DoesNotPanic mesma garantia do
// upload de foto, pro caminho de finalize.
func TestActivityController_Finalize_NilStore_DoesNotPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	activityID := mustCreateActivity(t, db, tenantID, "Atividade", "in_progress", "medium")

	tinyPNG := base64.StdEncoding.EncodeToString([]byte("fake-png-bytes"))
	payload, _ := json.Marshal(map[string]string{"clientSignature": "data:image/png;base64," + tinyPNG})
	c, w := setupPipelineContextWithParam(t, db, tenantID, "POST", "/activities/"+itoa(activityID)+"/finalize", payload, "id", itoa(activityID))

	assert.NotPanics(t, func() { ctrl.Finalize(c) })
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// TestActivityController_Finalize_ExceedsCap_Returns413 confirma o cap do
// caminho JSON (dataURL grande), independente da config do store.
func TestActivityController_Finalize_ExceedsCap_Returns413(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	ctrl := NewActivityController(nil)

	activityID := mustCreateActivity(t, db, tenantID, "Atividade", "in_progress", "medium")

	oversized := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte("a"), activityFinalizeMaxBytes+1024))
	payload, _ := json.Marshal(map[string]string{"clientSignature": "data:image/png;base64," + oversized})
	c, w := setupPipelineContextWithParam(t, db, tenantID, "POST", "/activities/"+itoa(activityID)+"/finalize", payload, "id", itoa(activityID))

	ctrl.Finalize(c)
	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code, "body: %s", w.Body.String())
}

// TestActivityController_Finalize_TenantIsolation confirma 404 (não
// vazamento) ao tentar finalizar Activity de outro tenant — a chave do
// objeto nunca chega a ser derivada pro tenant errado, porque
// findScopedActivity barra antes.
func TestActivityController_Finalize_TenantIsolation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()
	ctrl := NewActivityController(nil)

	activityID := mustCreateActivity(t, db, tenantA, "Atividade de A", "in_progress", "medium")

	payload, _ := json.Marshal(map[string]string{"clientSignature": "data:image/png;base64,aGVsbG8="})
	c, w := setupPipelineContextWithParam(t, db, tenantB, "POST", "/activities/"+itoa(activityID)+"/finalize", payload, "id", itoa(activityID))
	ctrl.Finalize(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// TestActivityController_Finalize_Success_NoBase64Persisted é o
// happy-path com um ObjectStore fake real: confirma status=done,
// finishedAt preenchido, e — o invariante mais importante do módulo —
// que a coluna clientSignatureUrl guarda uma CHAVE, nunca o base64 cru.
func TestActivityController_Finalize_Success_NoBase64Persisted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPipelineTestDB(t)
	tenantID := uuid.New()
	store := newFakeActivityObjectStore()
	ctrl := NewActivityController(store)

	activityID := mustCreateActivity(t, db, tenantID, "Atividade", "in_progress", "medium")

	rawSignatureBytes := []byte("conteudo-fake-de-assinatura-png")
	b64 := base64.StdEncoding.EncodeToString(rawSignatureBytes)
	payload, _ := json.Marshal(map[string]string{"clientSignature": "data:image/png;base64," + b64})
	c, w := setupPipelineContextWithParam(t, db, tenantID, "POST", "/activities/"+itoa(activityID)+"/finalize", payload, "id", itoa(activityID))

	ctrl.Finalize(c)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var updated models.Activity
	require.NoError(t, db.Where("id = ?", activityID).First(&updated).Error)
	assert.Equal(t, "done", updated.Status)
	require.NotNil(t, updated.FinishedAt)
	require.NotEmpty(t, updated.ClientSignatureUrl)

	// A coluna guarda a CHAVE do objeto (mesmo formato de
	// buildActivityObjectKey), nunca o base64 nem o dataURL cru.
	assert.NotContains(t, updated.ClientSignatureUrl, "base64")
	assert.NotContains(t, updated.ClientSignatureUrl, b64)
	assert.Contains(t, updated.ClientSignatureUrl, "activities/"+itoa(activityID))

	// E o que foi de fato gravado no store é o PNG decodificado, não o
	// base64/dataURL.
	stored, ok := store.objects[updated.ClientSignatureUrl]
	require.True(t, ok, "objeto deveria estar no store sob a chave persistida")
	assert.Equal(t, rawSignatureBytes, stored)
}

// multipartPhotoBody monta um corpo multipart/form-data com um único
// arquivo no campo dado.
func multipartPhotoBody(t *testing.T, field, filename string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	buf := &bytes.Buffer{}
	w := multipart.NewWriter(buf)
	fw, err := w.CreateFormFile(field, filename)
	require.NoError(t, err)
	_, err = fw.Write(content)
	require.NoError(t, err)
	require.NoError(t, w.Close())
	return buf, w.FormDataContentType()
}

// setupMultipartContext é como setupPipelineContext, mas com um corpo
// multipart/form-data (Content-Type próprio, não application/json).
func setupMultipartContext(t *testing.T, db *gorm.DB, tenantID uuid.UUID, path string, body *bytes.Buffer, contentType string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	req, _ := http.NewRequest("POST", path, body)
	req.Header.Set("Content-Type", contentType)
	c.Request = req

	c.Set("tenantId", tenantID)
	c.Set("alcance", "tenant")
	c.Set("userId", float64(1))
	scoped := db.Where(`"tenantId" = ?`, tenantID)
	c.Set("db", scoped)

	return c, w
}
