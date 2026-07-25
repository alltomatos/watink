package pluginlicense

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// CatalogPlugin espelha um item do contrato de GET /api/v1/plugins/catalog
// exposto pelo plugin-manager (que por sua vez proxeia o Watink Hub). As tags
// json seguem exatamente o contrato — price é número (float).
type CatalogPlugin struct {
	ID              string   `json:"id"`
	Slug            string   `json:"slug"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	LongDescription string   `json:"longDescription"`
	Version         string   `json:"version"`
	Type            string   `json:"type"`
	Category        string   `json:"category"`
	Price           float64  `json:"price"`
	IconURL         string   `json:"iconUrl"`
	Screenshots     []string `json:"screenshots"`
	// TaxRatePercent é a taxa global de imposto (ex.: 8) exibida sobre o
	// preço no Marketplace — mesma taxa para todo plugin, vem do Hub via
	// plugin-manager (HubPlugin.TaxRatePercent).
	TaxRatePercent int `json:"taxRatePercent"`
	// MPPublicKey é a chave pública do Mercado Pago (conta própria do Hub),
	// usada pelo frontend para montar o Payment Brick. Não é segredo.
	MPPublicKey string `json:"mpPublicKey"`
}

// CatalogResponse é o corpo de resposta de GET /api/v1/plugins/catalog:
// {"offline":bool,"plugins":[...]}. Offline sinaliza que o plugin-manager não
// conseguiu falar com o Hub (catálogo pode vir vazio/degradado).
type CatalogResponse struct {
	Offline bool            `json:"offline"`
	Plugins []CatalogPlugin `json:"plugins"`
}

// InstanceResponse é o corpo de resposta de GET /api/v1/plugins/instance:
// {"instanceId":"INST-<ts>-<hash>"}.
type InstanceResponse struct {
	InstanceID string `json:"instanceId"`
}

// GetCatalog consulta GET /api/v1/plugins/catalog no plugin-manager e devolve o
// shape {offline, plugins}. Diferente de GetLicense, NÃO usa cache — é uma
// leitura simples e o controller decide a política de fail-safe em erro.
// Retorna erro em falha de rede ou status != 200.
func (c *Client) GetCatalog() (CatalogResponse, error) {
	resp, err := c.httpClient.Get(c.baseURL + "/api/v1/plugins/catalog")
	if err != nil {
		return CatalogResponse{}, fmt.Errorf("pluginlicense: erro ao consultar catálogo do plugin-manager: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return CatalogResponse{}, fmt.Errorf("pluginlicense: catálogo retornou status %d", resp.StatusCode)
	}

	var body CatalogResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return CatalogResponse{}, fmt.Errorf("pluginlicense: erro ao decodificar catálogo do plugin-manager: %w", err)
	}
	return body, nil
}

// GetInstance consulta GET /api/v1/plugins/instance no plugin-manager e devolve
// o instanceId da instância. Sem cache; retorna erro em falha de rede ou
// status != 200 (o controller decide o fail-safe).
func (c *Client) GetInstance() (InstanceResponse, error) {
	resp, err := c.httpClient.Get(c.baseURL + "/api/v1/plugins/instance")
	if err != nil {
		return InstanceResponse{}, fmt.Errorf("pluginlicense: erro ao consultar instância no plugin-manager: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return InstanceResponse{}, fmt.Errorf("pluginlicense: instância retornou status %d", resp.StatusCode)
	}

	var body InstanceResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return InstanceResponse{}, fmt.Errorf("pluginlicense: erro ao decodificar instância do plugin-manager: %w", err)
	}
	return body, nil
}

// checkoutRequestBody é o corpo enviado a POST /api/v1/plugins/checkout no
// plugin-manager -- {"slug": "..."}. O plugin-manager é quem traduz esse
// campo para {instanceId, pluginSlug} antes de chamar o Hub (essa tradução
// não é responsabilidade do business).
type checkoutRequestBody struct {
	Slug string `json:"slug"`
}

// CheckoutOrderResponse é o corpo devolvido por Checkout (Fase 2) — um
// PluginOrder pending, ainda sem licença. O valor já vem com o imposto
// embutido (congelado pelo Hub no momento da criação do pedido).
type CheckoutOrderResponse struct {
	OrderID     uint  `json:"orderId"`
	AmountCents int64 `json:"amountCents"`
}

// Checkout solicita ao plugin-manager a criação (ou reaproveitamento
// idempotente de um pending já existente) de um pedido de compra do plugin
// `slug` junto ao Hub (POST /api/v1/plugins/checkout). Sem cache -- é uma
// ação, não uma leitura.
//
// IMPORTANTE (Fase 2): isto NÃO cria licença — só um PluginOrder pending. A
// licença só nasce quando Pay confirma o pagamento (aprovado na hora, ou
// depois via webhook para PIX). O chamador usa o orderId devolvido aqui
// para montar o Payment Brick e depois chamar Pay.
func (c *Client) Checkout(slug string) (CheckoutOrderResponse, error) {
	payload, err := json.Marshal(checkoutRequestBody{Slug: slug})
	if err != nil {
		return CheckoutOrderResponse{}, fmt.Errorf("pluginlicense: erro ao montar payload de checkout: %w", err)
	}

	resp, err := c.httpClient.Post(c.baseURL+"/api/v1/plugins/checkout", "application/json", bytes.NewReader(payload))
	if err != nil {
		return CheckoutOrderResponse{}, fmt.Errorf("pluginlicense: erro ao solicitar checkout no plugin-manager: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return CheckoutOrderResponse{}, fmt.Errorf("pluginlicense: checkout retornou status %d", resp.StatusCode)
	}

	var body CheckoutOrderResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return CheckoutOrderResponse{}, fmt.Errorf("pluginlicense: erro ao decodificar resposta de checkout: %w", err)
	}
	return body, nil
}

// payRequestBody é o corpo enviado a POST
// /api/v1/plugins/checkout/orders/{id}/pay no plugin-manager.
type payRequestBody struct {
	FormData map[string]any `json:"formData"`
}

// PayResponse é o resultado do pagamento — approved já libera a licença
// (LicenseActive=true); pending (PIX) devolve o QR code para o usuário
// pagar fora do fluxo síncrono, aguardando o webhook confirmar; rejected
// traz uma mensagem para o usuário tentar de novo.
type PayResponse struct {
	Status        string `json:"status"`
	LicenseActive bool   `json:"licenseActive"`
	QRCode        string `json:"qrCode,omitempty"`
	QRCodeBase64  string `json:"qrCodeBase64,omitempty"`
	Message       string `json:"message,omitempty"`
}

// Pay envia o formData que o Payment Brick devolveu no onSubmit ao
// plugin-manager (POST /api/v1/plugins/checkout/orders/{id}/pay), que
// repassa ao Hub. Nunca loga formData — pode conter token de cartão.
func (c *Client) Pay(orderID uint, formData map[string]any) (PayResponse, error) {
	payload, err := json.Marshal(payRequestBody{FormData: formData})
	if err != nil {
		return PayResponse{}, fmt.Errorf("pluginlicense: erro ao montar payload de pagamento: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/plugins/checkout/orders/%d/pay", c.baseURL, orderID)
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		return PayResponse{}, fmt.Errorf("pluginlicense: erro ao processar pagamento no plugin-manager: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return PayResponse{}, fmt.Errorf("pluginlicense: pagamento retornou status %d", resp.StatusCode)
	}

	var body PayResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return PayResponse{}, fmt.Errorf("pluginlicense: erro ao decodificar resposta de pagamento: %w", err)
	}
	return body, nil
}
