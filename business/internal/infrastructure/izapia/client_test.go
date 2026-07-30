package izapia

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClient_GetContactPicture_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/sessions/sess-1/contacts/5511999990001@s.whatsapp.net/picture", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"data":{"url":"https://cdn.example.com/pic.jpg","id":"abc","type":"image","direct_path":"/x"}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	url, err := client.GetContactPicture(context.Background(), "sess-1", "5511999990001@s.whatsapp.net")
	require.NoError(t, err)
	assert.Equal(t, "https://cdn.example.com/pic.jpg", url)
}

func TestClient_GetContactPicture_NotFound_ReturnsEmptyNoError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":false,"error":{"code":"NOT_FOUND","message":"no picture"}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	url, err := client.GetContactPicture(context.Background(), "sess-1", "5511999990002@s.whatsapp.net")
	require.NoError(t, err, "NOT_FOUND must not surface as an error -- it just means no picture")
	assert.Equal(t, "", url)
}

func TestClient_GetContactPicture_OtherError_Propagates(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":false,"error":{"code":"PROVIDER_ERROR","message":"rate limited"}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key")
	_, err := client.GetContactPicture(context.Background(), "sess-1", "5511999990003@s.whatsapp.net")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "rate limited")
}
