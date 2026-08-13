package pluginlicense

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// CartItem é um item do carrinho — mesmo par slug/cycle do checkout
// individual (ver cardCheckoutRequestBody), um por plugin selecionado.
type CartItem struct {
	Slug  string `json:"slug"`
	Cycle string `json:"cycle"`
}

type cartCardCheckoutRequestBody struct {
	Items     []CartItem `json:"items"`
	ReturnURL string     `json:"returnUrl"`
}

type cartPixCheckoutRequestBody struct {
	Items      []CartItem `json:"items"`
	PayerEmail string     `json:"payerEmail"`
}

// CartItemResult reflete o item resolvido pelo Hub — Trial=true quando foi
// ativado direto por vaga promocional (nunca entrou na cobrança).
type CartItemResult struct {
	PluginSlug  string `json:"pluginSlug"`
	Cycle       string `json:"cycle"`
	AmountCents int64  `json:"amountCents"`
	Trial       bool   `json:"trial"`
}

// CartCheckoutResponse é o corpo devolvido por CartCheckoutCard/Pix — a
// soma de todos os itens pagos numa preferência/pagamento MP só. AllTrial
// indica que todo o carrinho foi resolvido por trial, sem cobrança
// nenhuma (CheckoutURL/QRCode ficam vazios nesse caso).
type CartCheckoutResponse struct {
	CartID       string           `json:"cartId"`
	AmountCents  int64            `json:"amountCents"`
	CheckoutURL  string           `json:"checkoutUrl,omitempty"`
	QRCode       string           `json:"qrCode,omitempty"`
	QRCodeBase64 string           `json:"qrCodeBase64,omitempty"`
	AllTrial     bool             `json:"allTrial"`
	Items        []CartItemResult `json:"items"`
}

// CartCheckoutCard solicita ao plugin-manager um checkout de carrinho via
// Cartão (POST /api/v1/plugins/cart/checkout/card) — vários plugins/ciclos
// resolvidos e cobrados numa preferência Checkout Pro só. Mesmo invariante
// do checkout individual: não cria licença, só PluginOrder(s) pending — a
// licença de cada item só nasce quando o webhook confirma o pagamento.
func (c *Client) CartCheckoutCard(items []CartItem, returnURL string) (CartCheckoutResponse, error) {
	payload, err := json.Marshal(cartCardCheckoutRequestBody{Items: items, ReturnURL: returnURL})
	if err != nil {
		return CartCheckoutResponse{}, fmt.Errorf("pluginlicense: erro ao montar payload de checkout de carrinho: %w", err)
	}

	resp, err := c.httpClient.Post(c.baseURL+"/api/v1/plugins/cart/checkout/card", "application/json", bytes.NewReader(payload))
	if err != nil {
		return CartCheckoutResponse{}, fmt.Errorf("pluginlicense: erro ao solicitar checkout de carrinho no plugin-manager: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return CartCheckoutResponse{}, fmt.Errorf("pluginlicense: checkout de carrinho retornou status %d", resp.StatusCode)
	}

	var body CartCheckoutResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return CartCheckoutResponse{}, fmt.Errorf("pluginlicense: erro ao decodificar resposta de checkout de carrinho: %w", err)
	}
	return body, nil
}

// CartCheckoutPix é o equivalente Pix de CartCheckoutCard.
func (c *Client) CartCheckoutPix(items []CartItem, payerEmail string) (CartCheckoutResponse, error) {
	payload, err := json.Marshal(cartPixCheckoutRequestBody{Items: items, PayerEmail: payerEmail})
	if err != nil {
		return CartCheckoutResponse{}, fmt.Errorf("pluginlicense: erro ao montar payload de checkout de carrinho pix: %w", err)
	}

	resp, err := c.httpClient.Post(c.baseURL+"/api/v1/plugins/cart/checkout/pix", "application/json", bytes.NewReader(payload))
	if err != nil {
		return CartCheckoutResponse{}, fmt.Errorf("pluginlicense: erro ao solicitar checkout de carrinho pix no plugin-manager: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return CartCheckoutResponse{}, fmt.Errorf("pluginlicense: checkout de carrinho pix retornou status %d", resp.StatusCode)
	}

	var body CartCheckoutResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return CartCheckoutResponse{}, fmt.Errorf("pluginlicense: erro ao decodificar resposta de checkout de carrinho pix: %w", err)
	}
	return body, nil
}
