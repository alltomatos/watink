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
	// SinglePaymentEnabled indica se o cliente pode comprar este plugin com
	// pagamento único (licença perpétua, Price) além de/ao invés dos
	// PricingCycles — as duas opções podem coexistir; o cliente escolhe no
	// checkout (cycle="" para pagamento único).
	SinglePaymentEnabled bool `json:"singlePaymentEnabled"`
	// PricingCycles são os ciclos de recorrência cadastrados no Hub (mensal,
	// anual, o que o dono cadastrar) — o frontend usa isto pra deixar o
	// cliente escolher o ciclo antes de chamar Checkout(Card|Pix). Vazio
	// para plugin free.
	PricingCycles []PricingCycleEntry `json:"pricingCycles,omitempty"`
}

// PricingCycleEntry espelha o mesmo shape do Hub/plugin-manager (ver
// hub/api/internal/server/catalog.PricingCycleEntry).
type PricingCycleEntry struct {
	Cycle      string `json:"cycle"`
	PriceCents int64  `json:"priceCents"`
	PeriodDays int64  `json:"periodDays"`
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

// cardCheckoutRequestBody é o corpo enviado a POST
// /api/v1/plugins/checkout/card no plugin-manager -- {"slug", "cycle",
// "returnUrl"}. O plugin-manager é quem traduz `slug` para `pluginSlug`
// antes de chamar o Hub (essa tradução não é responsabilidade do business).
// cycle identifica qual PluginPricingCycle foi escolhido (ver
// CatalogPlugin.PricingCycles) — vazio significa pagamento único (exige
// CatalogPlugin.SinglePaymentEnabled). returnUrl é a página do plugin no
// domínio da própria instância — usada pelo Hub pra montar as back_urls do
// Checkout Pro.
type cardCheckoutRequestBody struct {
	Slug      string `json:"slug"`
	Cycle     string `json:"cycle"`
	ReturnURL string `json:"returnUrl"`
}

// pixCheckoutRequestBody é o corpo enviado a POST
// /api/v1/plugins/checkout/pix -- {"slug", "cycle", "payerEmail"}. cycle
// vazio significa pagamento único, mesma convenção de cardCheckoutRequestBody.
type pixCheckoutRequestBody struct {
	Slug       string `json:"slug"`
	Cycle      string `json:"cycle"`
	PayerEmail string `json:"payerEmail"`
}

// CheckoutOrderResponse é o corpo devolvido por CheckoutCard — um
// PluginOrder pending, ainda sem licença, junto com a URL de redirect pro
// Checkout Pro. O valor já vem com o imposto embutido (congelado pelo Hub
// na criação do pedido).
type CheckoutOrderResponse struct {
	OrderID     uint   `json:"orderId"`
	AmountCents int64  `json:"amountCents"`
	CheckoutURL string `json:"checkoutUrl"`
}

// CheckoutPixResponse é o corpo devolvido por CheckoutPix — o mesmo
// PluginOrder pending, mas com o QR code (imagem base64) e o copia-e-cola
// em vez de uma URL de redirect (Pix não passa pelo Checkout Pro).
type CheckoutPixResponse struct {
	OrderID      uint   `json:"orderId"`
	AmountCents  int64  `json:"amountCents"`
	QRCode       string `json:"qrCode"`
	QRCodeBase64 string `json:"qrCodeBase64"`
}

// CheckoutCard solicita ao plugin-manager a criação (ou reaproveitamento
// idempotente de um pending já existente) de um pedido de compra via Cartão
// do ciclo `cycle` (ou pagamento único, se cycle=="") do plugin `slug`
// junto ao Hub (POST /api/v1/plugins/checkout/card). Sem cache -- é uma
// ação, não uma leitura.
//
// IMPORTANTE: isto NÃO cria licença — só um PluginOrder pending. A licença
// só nasce quando o webhook do Mercado Pago confirma o pagamento (não há
// chamada síncrona de pagamento no nosso backend — o Checkout Pro processa
// o cartão inteiramente na página hospedada pelo MP). O chamador usa o
// checkoutUrl devolvido aqui pra redirecionar o usuário.
func (c *Client) CheckoutCard(slug, cycle, returnURL string) (CheckoutOrderResponse, error) {
	payload, err := json.Marshal(cardCheckoutRequestBody{Slug: slug, Cycle: cycle, ReturnURL: returnURL})
	if err != nil {
		return CheckoutOrderResponse{}, fmt.Errorf("pluginlicense: erro ao montar payload de checkout: %w", err)
	}

	resp, err := c.httpClient.Post(c.baseURL+"/api/v1/plugins/checkout/card", "application/json", bytes.NewReader(payload))
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

// CheckoutPix solicita ao plugin-manager um pagamento Pix direto (POST
// /api/v1/plugins/checkout/pix) do ciclo `cycle` (ou pagamento único, se
// cycle=="") do plugin `slug` — devolve o QR code pro frontend renderizar.
// Mesmo invariante do CheckoutCard: não cria licença, só um PluginOrder
// pending; a licença só nasce quando o webhook confirma o pagamento como
// approved.
func (c *Client) CheckoutPix(slug, cycle, payerEmail string) (CheckoutPixResponse, error) {
	payload, err := json.Marshal(pixCheckoutRequestBody{Slug: slug, Cycle: cycle, PayerEmail: payerEmail})
	if err != nil {
		return CheckoutPixResponse{}, fmt.Errorf("pluginlicense: erro ao montar payload de checkout pix: %w", err)
	}

	resp, err := c.httpClient.Post(c.baseURL+"/api/v1/plugins/checkout/pix", "application/json", bytes.NewReader(payload))
	if err != nil {
		return CheckoutPixResponse{}, fmt.Errorf("pluginlicense: erro ao solicitar checkout pix no plugin-manager: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return CheckoutPixResponse{}, fmt.Errorf("pluginlicense: checkout pix retornou status %d", resp.StatusCode)
	}

	var body CheckoutPixResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return CheckoutPixResponse{}, fmt.Errorf("pluginlicense: erro ao decodificar resposta de checkout pix: %w", err)
	}
	return body, nil
}
