package pluginlicense

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestGetCatalog_DecodesContract sobe um httptest.Server servindo o JSON do
// contrato de GET /api/v1/plugins/catalog e verifica que GetCatalog decodifica
// offline/plugins corretamente, incluindo price como float.
func TestGetCatalog_DecodesContract(t *testing.T) {
	const body = `{
		"offline": false,
		"plugins": [
			{"id":"1","slug":"helpdesk","name":"Helpdesk","description":"desk","version":"1.2.0","type":"pro","category":"support","price":49.9,"iconUrl":"http://x/i.png"},
			{"id":"2","slug":"webchat","name":"Web Chat","description":"chat","version":"0.9.0","type":"free","category":"channels","price":0,"iconUrl":""}
		]
	}`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/plugins/catalog" {
			http.Error(w, "unexpected path "+r.URL.Path, http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	c := NewClientWithBaseURL(srv.URL)
	got, err := c.GetCatalog()
	if err != nil {
		t.Fatalf("GetCatalog returned error: %v", err)
	}

	if got.Offline {
		t.Errorf("Offline = true, want false")
	}
	if len(got.Plugins) != 2 {
		t.Fatalf("len(Plugins) = %d, want 2", len(got.Plugins))
	}

	p0 := got.Plugins[0]
	if p0.ID != "1" || p0.Slug != "helpdesk" || p0.Name != "Helpdesk" ||
		p0.Description != "desk" || p0.Version != "1.2.0" || p0.Type != "pro" ||
		p0.Category != "support" || p0.IconURL != "http://x/i.png" {
		t.Errorf("Plugins[0] decoded incorrectly: %+v", p0)
	}
	if p0.Price != 49.9 {
		t.Errorf("Plugins[0].Price = %v, want 49.9 (float)", p0.Price)
	}

	if got.Plugins[1].Slug != "webchat" || got.Plugins[1].Price != 0 || got.Plugins[1].Type != "free" {
		t.Errorf("Plugins[1] decoded incorrectly: %+v", got.Plugins[1])
	}
}

// TestGetCatalog_OfflineTrue verifica que o campo offline=true é propagado.
func TestGetCatalog_OfflineTrue(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"offline":true,"plugins":[]}`))
	}))
	defer srv.Close()

	c := NewClientWithBaseURL(srv.URL)
	got, err := c.GetCatalog()
	if err != nil {
		t.Fatalf("GetCatalog returned error: %v", err)
	}
	if !got.Offline {
		t.Errorf("Offline = false, want true")
	}
	if len(got.Plugins) != 0 {
		t.Errorf("len(Plugins) = %d, want 0", len(got.Plugins))
	}
}

// TestGetCatalog_Non200_ReturnsError verifica que status != 200 vira erro (o
// controller é quem decide o fail-safe, não o client).
func TestGetCatalog_Non200_ReturnsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := NewClientWithBaseURL(srv.URL)
	if _, err := c.GetCatalog(); err == nil {
		t.Fatalf("GetCatalog returned nil error on status 500, want error")
	}
}

// TestGetInstance_DecodesContract verifica o decode de {instanceId}.
func TestGetInstance_DecodesContract(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/plugins/instance" {
			http.Error(w, "unexpected path "+r.URL.Path, http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"instanceId":"INST-1700000000-deadbeef"}`))
	}))
	defer srv.Close()

	c := NewClientWithBaseURL(srv.URL)
	got, err := c.GetInstance()
	if err != nil {
		t.Fatalf("GetInstance returned error: %v", err)
	}
	if got.InstanceID != "INST-1700000000-deadbeef" {
		t.Errorf("InstanceID = %q, want %q", got.InstanceID, "INST-1700000000-deadbeef")
	}
}

// TestGetInstance_Non200_ReturnsError verifica que status != 200 vira erro.
func TestGetInstance_Non200_ReturnsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	c := NewClientWithBaseURL(srv.URL)
	if _, err := c.GetInstance(); err == nil {
		t.Fatalf("GetInstance returned nil error on status 503, want error")
	}
}

// TestCheckout_PostsSlugAndReturnURLSucceedsOn200 verifica que Checkout
// envia POST {slug, returnUrl} em JSON e trata 200 como sucesso,
// decodificando o pedido pending + checkoutUrl.
func TestCheckout_PostsSlugAndReturnURLSucceedsOn200(t *testing.T) {
	var gotMethod, gotPath, gotContentType string
	var gotBody struct {
		Slug      string `json:"slug"`
		ReturnURL string `json:"returnUrl"`
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotContentType = r.Header.Get("Content-Type")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"orderId":7,"amountCents":3229,"checkoutUrl":"https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=abc"}`))
	}))
	defer srv.Close()

	c := NewClientWithBaseURL(srv.URL)
	order, err := c.Checkout("helpdesk", "https://cliente.watink.com/marketplace/helpdesk")
	if err != nil {
		t.Fatalf("Checkout returned error: %v", err)
	}
	if order.OrderID != 7 || order.AmountCents != 3229 || order.CheckoutURL == "" {
		t.Errorf("order = %+v, want {OrderID:7 AmountCents:3229 CheckoutURL:non-empty}", order)
	}

	if gotMethod != http.MethodPost {
		t.Errorf("method = %q, want POST", gotMethod)
	}
	if gotPath != "/api/v1/plugins/checkout" {
		t.Errorf("path = %q, want /api/v1/plugins/checkout", gotPath)
	}
	if gotContentType != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", gotContentType)
	}
	if gotBody.Slug != "helpdesk" {
		t.Errorf("body.slug = %q, want helpdesk", gotBody.Slug)
	}
	if gotBody.ReturnURL != "https://cliente.watink.com/marketplace/helpdesk" {
		t.Errorf("body.returnUrl = %q, want repassado", gotBody.ReturnURL)
	}
}

// TestCheckout_201Succeeds verifica que 201 (pedido recém-criado pelo Hub)
// também é tratado como sucesso, não apenas 200.
func TestCheckout_201Succeeds(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"orderId":1,"amountCents":100,"checkoutUrl":"https://mp/x"}`))
	}))
	defer srv.Close()

	c := NewClientWithBaseURL(srv.URL)
	if _, err := c.Checkout("helpdesk", "https://cliente.watink.com/marketplace/helpdesk"); err != nil {
		t.Fatalf("Checkout returned error on 201: %v", err)
	}
}

// TestCheckout_Non2xx_ReturnsDescriptiveError verifica que qualquer status
// fora de 200/201 (ex.: 404 unknown_plugin, 422 invalid_plugin, 503
// instância não registrada) vira erro com o status code na mensagem.
func TestCheckout_Non2xx_ReturnsDescriptiveError(t *testing.T) {
	cases := []int{http.StatusNotFound, http.StatusUnprocessableEntity, http.StatusServiceUnavailable}
	for _, status := range cases {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "boom", status)
		}))

		c := NewClientWithBaseURL(srv.URL)
		_, err := c.Checkout("helpdesk", "https://cliente.watink.com/marketplace/helpdesk")
		srv.Close()

		if err == nil {
			t.Fatalf("Checkout returned nil error on status %d, want error", status)
		}
	}
}
