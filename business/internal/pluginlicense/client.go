// Package pluginlicense é o cliente HTTP que o business usa para consultar o
// status de licença dos plugins junto ao plugin-manager local (porta 8081).
//
// O business NUNCA fala com o Hub central diretamente (docs/agents/plugins.md,
// ADR 0024) — a única fonte consultada aqui é o plugin-manager, via
// GET /internal/licenses, com um cache em memória de curto TTL para evitar
// bater no plugin-manager a cada requisição.
package pluginlicense

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

// LicenseInfo é o status de licença de um plugin, espelhando o contrato de
// GET /internal/licenses exposto pelo plugin-manager
// (plugin-manager/licenses.go).
type LicenseInfo struct {
	Status    string `json:"status"`
	TenantCap int    `json:"tenantCap"`
	Exp       int64  `json:"exp"`
}

// licensesResponse é o corpo de resposta de GET /internal/licenses.
type licensesResponse struct {
	Licenses map[string]LicenseInfo `json:"licenses"`
}

const (
	defaultBaseURL  = "http://localhost:8081"
	defaultTTLSecs  = 60
	defaultTimeout  = 3 * time.Second
	envCacheTTLSecs = "PLUGIN_LICENSE_CACHE_TTL_SECONDS"

	// pluginManagerBaseURL é a URL FIXA do plugin-manager local, dentro da
	// rede Docker/Swarm do ecossistema. NÃO é lida do ambiente de propósito:
	// o plugin-manager é a trava de licença (ADR 0024) — se fosse
	// configurável via .env, um operador self-hosted poderia redirecioná-la
	// para um servidor falso que sempre responde "active", contornando o
	// licenciamento inteiro. Fixa em código, sem override possível.
	pluginManagerBaseURL = "http://plugin-manager:8081"
)

// Client consulta o plugin-manager para obter o status de licença de
// plugins, com cache em memória (TTL configurável) para não bater no
// plugin-manager a cada requisição.
type Client struct {
	baseURL    string
	httpClient *http.Client
	ttl        time.Duration

	mu        sync.Mutex
	cache     map[string]LicenseInfo
	fetchedAt time.Time
	hasCache  bool
}

// NewClient constrói o Client apontado para o plugin-manager na URL FIXA
// pluginManagerBaseURL (não configurável — ver comentário na constante) e
// lendo PLUGIN_LICENSE_CACHE_TTL_SECONDS (default 60) do ambiente. Injetado
// via construtor em main.go (DI pura) — nunca Singleton/Service Locator.
func NewClient() *Client {
	ttl := defaultTTLSecs * time.Second
	if raw := os.Getenv(envCacheTTLSecs); raw != "" {
		if secs, err := strconv.Atoi(raw); err == nil && secs > 0 {
			ttl = time.Duration(secs) * time.Second
		}
	}

	return newClient(pluginManagerBaseURL, ttl)
}

// NewClientWithBaseURL constrói o Client apontado para uma baseURL explícita
// (sem ler o ambiente), usando o TTL default. Útil para testes que sobem um
// httptest.Server e para composição em DI quando a URL vem de outra fonte.
func NewClientWithBaseURL(baseURL string) *Client {
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	return newClient(baseURL, defaultTTLSecs*time.Second)
}

// newClient é o construtor interno compartilhado por NewClient e
// NewClientWithBaseURL — centraliza os defaults do http.Client e do cache.
func newClient(baseURL string, ttl time.Duration) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultTimeout},
		ttl:        ttl,
		cache:      make(map[string]LicenseInfo),
	}
}

// GetLicense devolve o LicenseInfo do plugin `pluginSlug`. Primeiro checa o
// cache em memória (se ainda dentro do TTL, devolve dali). Se expirado ou
// ausente, consulta GET /internal/licenses no plugin-manager e atualiza o
// cache inteiro (todos os slugs vêm na mesma resposta).
//
// Fallback de indisponibilidade (grace): se o plugin-manager estiver fora do
// ar (timeout, conexão recusada, erro HTTP) e já existir cache — mesmo
// expirado — o cache antigo é servido em vez de propagar o erro. Só retorna
// erro quando NÃO há cache algum e o plugin-manager está inacessível; cabe
// ao chamador (P-7) decidir a política fail-closed nesse caso.
func (c *Client) GetLicense(pluginSlug string) (LicenseInfo, error) {
	c.mu.Lock()
	if time.Since(c.fetchedAt) < c.ttl && c.hasCache {
		info, ok := c.cache[pluginSlug]
		c.mu.Unlock()
		if ok {
			return info, nil
		}
		return LicenseInfo{}, fmt.Errorf("pluginlicense: plugin %q não encontrado na resposta do plugin-manager", pluginSlug)
	}
	c.mu.Unlock()

	fresh, err := c.fetchLicenses()
	if err != nil {
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.hasCache {
			// Grace: plugin-manager indisponível, mas ainda há cache (mesmo
			// vencido) — serve o último estado conhecido em vez de falhar.
			info, ok := c.cache[pluginSlug]
			if ok {
				return info, nil
			}
		}
		return LicenseInfo{}, fmt.Errorf("pluginlicense: plugin-manager indisponível e sem cache: %w", err)
	}

	c.mu.Lock()
	c.cache = fresh
	c.fetchedAt = time.Now()
	c.hasCache = true
	info, ok := c.cache[pluginSlug]
	c.mu.Unlock()

	if !ok {
		return LicenseInfo{}, fmt.Errorf("pluginlicense: plugin %q não encontrado na resposta do plugin-manager", pluginSlug)
	}
	return info, nil
}

// fetchLicenses faz o GET /internal/licenses no plugin-manager e decodifica
// a resposta completa (todos os slugs).
func (c *Client) fetchLicenses() (map[string]LicenseInfo, error) {
	resp, err := c.httpClient.Get(c.baseURL + "/internal/licenses")
	if err != nil {
		return nil, fmt.Errorf("erro ao consultar plugin-manager: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("plugin-manager retornou status %d", resp.StatusCode)
	}

	var body licensesResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("erro ao decodificar resposta do plugin-manager: %w", err)
	}
	return body.Licenses, nil
}
