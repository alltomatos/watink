// Package saasclient é o canal reverso core→Watink SaaS do registro
// self-service (Onda 6, ADR 0007 do watink-saas). Espelha o padrão já usado
// pelo coreclient do lado do SaaS (X-Internal-Token) e pelo
// business/internal/flow.HTTPAgentClient (URL fixa do env, sem fallback de
// segredo, timeout curto, nunca loga token nem corpo).
//
// Segurança: para NewFromEnv, a URL é FIXA (lida do env, nunca do request).
// controllers.SaaSModeController.Pair (pareamento manual de instância
// adicional) é a única exceção — ali a baseURL vem de um admin autenticado
// via formulário — por isso httpClient() sempre usa netguard.SafeDialContext
// como defesa em profundidade, mesmo nos caminhos com URL fixa: nunca conecta
// a IP privado/loopback/link-local, incluindo o endpoint de metadados de
// nuvem. O token nunca sai deste processo rumo ao navegador; o handler
// público (controllers.RegisterController) só repassa um allowlist estrito
// de campos do formulário, nunca o token. Sem SAAS_BASE_URL/SAAS_INSTANCE_ID/
// SAAS_INTERNAL_TOKEN no env, Enabled() é false e o registro fica desligado —
// fail-closed, nenhuma instalação que não usa o Watink SaaS é afetada.
package saasclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/alltomatos/watinkdev/business/pkg/netguard"
)

// Client fala com o grupo /api/v1/instance/* do Watink SaaS.
type Client struct {
	baseURL    string
	instanceID string
	token      string
	http       *http.Client
}

// httpClient constrói o *http.Client compartilhado por NewFromEnv e New —
// honra HTTPS_PROXY/HTTP_PROXY/NO_PROXY via http.ProxyFromEnvironment
// (issue #631): um core on-premises atrás de proxy corporativo precisa
// funcionar sem editar código, só configurando a env padrão do SO/container.
func httpClient() *http.Client {
	return &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			Proxy:       http.ProxyFromEnvironment,
			DialContext: DialContext,
		},
	}
}

// DialContext é o dialer usado por httpClient — por padrão o guard de SSRF
// (netguard.SafeDialContext). Exportado só para testes (deste pacote e de
// consumidores, ex. controllers.SaaSModeController) sobrescreverem por um
// dialer comum: httptest.NewServer liga em 127.0.0.1 (loopback), que o guard
// corretamente recusa em produção. Nenhum código de produção reatribui isto.
var DialContext = netguard.SafeDialContext

// NewFromEnv lê SAAS_BASE_URL, SAAS_INSTANCE_ID e SAAS_INTERNAL_TOKEN do
// ambiente. Sem fallback hardcoded — instalações que não usam o Watink SaaS
// simplesmente não setam as envs e Enabled() fica false.
func NewFromEnv() *Client {
	return &Client{
		baseURL:    os.Getenv("SAAS_BASE_URL"),
		instanceID: os.Getenv("SAAS_INSTANCE_ID"),
		token:      os.Getenv("SAAS_INTERNAL_TOKEN"),
		http:       httpClient(),
	}
}

// New constrói o Client a partir do contrato de pareamento lido do banco
// (services.SaaSContractService, issue #628) — usado pelo worker de sync
// (issue #631), que não depende de env/restart para (re)configurar o
// pareamento com o Watink SaaS hospedado.
func New(baseURL, instanceID, token string) *Client {
	return &Client{baseURL: baseURL, instanceID: instanceID, token: token, http: httpClient()}
}

// Enabled reporta se as três envs necessárias estão presentes. O chamador
// (RegisterController) usa isso para decidir se expõe as rotas de registro —
// sem elas, o botão "Registrar-se" nunca aparece no core.
func (c *Client) Enabled() bool {
	return c.baseURL != "" && c.instanceID != "" && c.token != ""
}

// do executa a chamada UMA vez e devolve o corpo cru — nunca decodifica
// internamente, para o chamador poder escolher o formato de destino (sucesso
// vs. erro) sem uma segunda ida à rede (que duplicaria efeitos colaterais como
// um registro em POST /register).
func (c *Client) do(ctx context.Context, method, path string, body any) (int, []byte, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Instance-Id", c.instanceID)
	req.Header.Set("X-Internal-Token", c.token)

	resp, err := c.http.Do(req)
	if err != nil {
		// Erro de transporte — nunca inclui o token (err de net/http não o carrega).
		return 0, nil, fmt.Errorf("saasclient: %s %s: %w", method, path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	return resp.StatusCode, respBody, nil
}

// Plan é a projeção pública de um plano elegível ao self-service.
type Plan struct {
	ID               string          `json:"id"`
	Name             string          `json:"name"`
	Slug             string          `json:"slug"`
	Description      string          `json:"description"`
	PriceCents       int64           `json:"priceCents"`
	BillingCycle     string          `json:"billingCycle"`
	TrialDays        int             `json:"trialDays"`
	UsersLimit       int             `json:"usersLimit"`
	ConnectionsLimit int             `json:"connectionsLimit"`
	QueuesLimit      int             `json:"queuesLimit"`
	PluginQuota      int             `json:"pluginQuota"`
	Features         json.RawMessage `json:"features,omitempty"`
	SortOrder        int             `json:"sortOrder"`
}

// PlansResponse é o corpo de GET /instance/plans.
type PlansResponse struct {
	RegistrationOpen bool   `json:"registrationOpen"`
	Plans            []Plan `json:"plans"`
}

// Plans busca o catálogo público de planos elegíveis ao self-service.
func (c *Client) Plans(ctx context.Context) (*PlansResponse, error) {
	status, body, err := c.do(ctx, http.MethodGet, "/api/v1/instance/plans", nil)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("saasclient: plans: status %d", status)
	}
	var out PlansResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// RegisterRequest é o formulário de registro repassado ao SaaS — SOMENTE estes
// campos, nunca o token nem qualquer outro dado do request original.
type RegisterRequest struct {
	PlanID      string `json:"planId"`
	CompanyName string `json:"companyName"`
	Document    string `json:"document"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

// RegisterResult é o corpo 202 do registro.
type RegisterResult struct {
	RegistrationID string `json:"registrationId"`
	Status         string `json:"status"`
}

// RegisterError carrega o status HTTP e o corpo de erro do SaaS, para o
// controller mapear a resposta sem expor detalhes internos.
type RegisterError struct {
	Status int
	Code   string
}

func (e *RegisterError) Error() string {
	return fmt.Sprintf("saasclient: register: status %d: %s", e.Status, e.Code)
}

// Register envia o formulário de registro — UMA única chamada de rede (um
// retry aqui poderia duplicar o registro do lado do SaaS). Em erro de negócio
// (400/409/422) o SaaS devolve {"error":"<code>"}, decodificado em
// RegisterError para o controller repassar o código sem vazar detalhes internos.
func (c *Client) Register(ctx context.Context, req RegisterRequest) (*RegisterResult, error) {
	status, body, err := c.do(ctx, http.MethodPost, "/api/v1/instance/register", req)
	if err != nil {
		return nil, err
	}
	if status == http.StatusAccepted {
		var out RegisterResult
		if err := json.Unmarshal(body, &out); err != nil {
			return nil, err
		}
		return &out, nil
	}
	var errBody struct {
		Error string `json:"error"`
	}
	_ = json.Unmarshal(body, &errBody)
	return nil, &RegisterError{Status: status, Code: errBody.Error}
}

// StatusResult é o corpo de GET /instance/register/:id/status.
type StatusResult struct {
	RegistrationID string `json:"registrationId"`
	Status         string `json:"status"`
}

// RegisterStatus consulta o andamento de um registro (poll do frontend).
func (c *Client) RegisterStatus(ctx context.Context, registrationID string) (*StatusResult, error) {
	status, body, err := c.do(ctx, http.MethodGet, "/api/v1/instance/register/"+registrationID+"/status", nil)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("saasclient: register status: status %d", status)
	}
	var out StatusResult
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// SyncCommand é um comando pendente devolvido pelo sync — mesmo shape do
// core_commands do Watink SaaS (watink-saas#28), só os campos que o core
// precisa para executar.
type SyncCommand struct {
	ID       string          `json:"id"`
	Command  string          `json:"command"`
	Payload  json.RawMessage `json:"payload"`
	TenantID string          `json:"tenantId,omitempty"`
}

// SyncRequest é o corpo de POST /instance/sync (issue #631/watink-saas#28).
type SyncRequest struct {
	CoreVersion string   `json:"coreVersion"`
	Acks        []string `json:"acks,omitempty"`
	Usage       any      `json:"usage,omitempty"`
	Tenants     any      `json:"tenants,omitempty"`
}

// SyncResponse é o corpo 200 de POST /instance/sync.
type SyncResponse struct {
	Commands []SyncCommand `json:"commands"`
}

// Sync chama POST /instance/sync (contrato de pull, issue #631) — o worker
// no core inicia a conexão, nunca o Watink SaaS: resolve o caso de core
// atrás de NAT/firewall corporativo sem porta de entrada. NUNCA loga req nem
// resp (podem carregar payload de provisionamento com senha temporária).
func (c *Client) Sync(ctx context.Context, req SyncRequest) (*SyncResponse, error) {
	status, body, err := c.do(ctx, http.MethodPost, "/api/v1/instance/sync", req)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("saasclient: sync: status %d", status)
	}
	var out SyncResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
