package plugins

import (
	"log"
	"sync"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CatalogEntry é a fatia mínima do catálogo (Hub, via plugin-manager) que
// este pacote precisa — só slug+type. Mantido local (não importa
// pluginlicense.CatalogPlugin) pelo mesmo motivo do LicenseInfo acima:
// evitar acoplamento reverso, só a interface CatalogFetcher é exposta.
type CatalogEntry struct {
	Slug string
	Type string
}

// CatalogFetcher é a fatia do pluginlicense.Client que PluginRegistry
// precisa pra saber se um plugin é Type=free -- ver NewCatalogFetcher em
// license_adapter.go.
type CatalogFetcher interface {
	GetCatalog() ([]CatalogEntry, error)
}

// freeSlugsCacheTTL evita bater no plugin-manager (que por sua vez cacheia
// o Hub por ~20s) a cada chamada de rota gateada -- GetStatus roda em TODA
// requisição de plugin, não só na ativação. TTL curto o bastante pra uma
// troca pro<->free no Console refletir em runtime rápido, sem virar um
// round-trip de rede síncrono por request.
const freeSlugsCacheTTL = 30 * time.Second

// LicenseFetcher is the small interface PluginRegistry needs from
// pluginlicense.Client — only GetLicense. Kept separate from the concrete
// client so tests can supply a local fake without a global mock
// (docs/agents/plugins.md, CLAUDE.md "Testes: Mocks em structs locais").
type LicenseFetcher interface {
	GetLicense(pluginSlug string) (LicenseInfo, error)
}

// LicenseInfo mirrors pluginlicense.LicenseInfo (status/tenantCap/exp) so
// this package does not need to import pluginlicense directly — it depends
// only on the LicenseFetcher interface, satisfied by *pluginlicense.Client
// via the adapter in main.go.
type LicenseInfo struct {
	Status    string
	TenantCap int
	Exp       int64
}

// PluginRegistry implements the real GetStatus(tenantId, pluginSlug) cross
// of LICENSE (via LicenseFetcher, backed by the plugin-manager) x ALLOCATION
// (PluginInstallations in the core DB). See docs/adr/0024 and
// docs/agents/plugins.md § "Gating em runtime".
type PluginRegistry struct {
	db      *gorm.DB
	license LicenseFetcher
	catalog CatalogFetcher

	freeSlugsMu       sync.RWMutex
	freeSlugs         map[string]bool
	freeSlugsCachedAt time.Time
}

// NewPluginRegistry builds the registry via constructor injection (DI pura)
// — db, license and catalog clients are always passed in, never resolved
// through a global/service locator. catalog may be nil (some test
// constructions) -- IsFreePlugin then always returns false, same fail-safe
// as license-fetch errors.
func NewPluginRegistry(db *gorm.DB, license LicenseFetcher, catalog CatalogFetcher) *PluginRegistry {
	return &PluginRegistry{db: db, license: license, catalog: catalog}
}

// IsFreePlugin reports whether pluginSlug is catalogued as Type=free (Hub
// is the authority, ADR 0024/0001 do Hub — nunca o manifesto Go embarcado,
// que pode ficar desatualizado se o Tipo for trocado depois no Console).
// Cacheia o catálogo por freeSlugsCacheTTL porque GetStatus roda em toda
// requisição de rota de plugin. Fail-safe: catalog nil, erro de rede ou
// slug ausente do catálogo -> false (segue o caminho normal de licença).
func (r *PluginRegistry) IsFreePlugin(pluginSlug string) bool {
	if r.catalog == nil {
		return false
	}

	r.freeSlugsMu.RLock()
	fresh := time.Since(r.freeSlugsCachedAt) < freeSlugsCacheTTL
	slugs := r.freeSlugs
	r.freeSlugsMu.RUnlock()

	if !fresh {
		entries, err := r.catalog.GetCatalog()
		if err != nil {
			log.Printf("[plugins] falha ao consultar catálogo para checar Type=free (fail-safe: trata como pro): %v", err)
		} else {
			next := make(map[string]bool, len(entries))
			for _, e := range entries {
				if e.Type == "free" {
					next[e.Slug] = true
				}
			}
			r.freeSlugsMu.Lock()
			r.freeSlugs = next
			r.freeSlugsCachedAt = time.Now()
			slugs = next
			r.freeSlugsMu.Unlock()
		}
	}

	return slugs[pluginSlug]
}

// GetStatus crosses allocation x license for (tenantId, pluginSlug):
//
//   - Not allocated (no active PluginInstallation row) -> StatusBlocked.
//     Allocation is never treated as license authority (ADR 0024) but the
//     absence of it is a hard gate regardless of license state.
//   - Allocated + license "active"    -> StatusActive.
//   - Allocated + license "readonly"  -> StatusReadOnly.
//   - Allocated + license "blocked"/"unlicensed" (or anything unrecognized)
//     -> StatusBlocked.
//   - Allocated but the license query itself failed (plugin-manager down,
//     no cache) -> StatusBlocked. This is a deliberate fail-closed choice:
//     an indeterminate license must never be treated as valid (ADR 0024,
//     "Edge cases": ações de crescimento e runtime ficam fail-closed quando
//     o status é indeterminado).
func (r *PluginRegistry) GetStatus(tenantID uuid.UUID, pluginSlug string) sdk.PluginStatus {
	allocated, err := r.isAllocated(tenantID, pluginSlug)
	if err != nil {
		log.Printf("[plugins] erro ao consultar alocação de %s para tenant %s: %v", pluginSlug, tenantID, err)
		return sdk.StatusBlocked
	}
	if !allocated {
		return sdk.StatusBlocked
	}

	// Plugin free não toca o Hub (nunca recebe token) -- checar licença
	// aqui devolveria sempre "unlicensed" e bloquearia toda rota do plugin
	// mesmo já alocado/ativado. A alocação acima já é o único gate real
	// para free; a licença só se aplica a pro.
	if r.IsFreePlugin(pluginSlug) {
		return sdk.StatusActive
	}

	info, err := r.license.GetLicense(pluginSlug)
	if err != nil {
		// Fail-closed: plugin-manager indisponível e sem cache. Nunca liberar
		// uma licença indeterminada.
		log.Printf("[plugins] licença indeterminada para %s (fail-closed): %v", pluginSlug, err)
		return sdk.StatusBlocked
	}

	switch info.Status {
	case "active":
		return sdk.StatusActive
	case "readonly":
		return sdk.StatusReadOnly
	default:
		// "blocked", "unlicensed" ou qualquer status desconhecido.
		return sdk.StatusBlocked
	}
}

// isAllocated checks PluginInstallations for an active row (tenantId,
// pluginId=slug). A missing row or active=false both mean "not allocated".
func (r *PluginRegistry) isAllocated(tenantID uuid.UUID, pluginSlug string) (bool, error) {
	if r.db == nil {
		return false, nil
	}
	var count int64
	err := r.db.Session(&gorm.Session{NewDB: true}).
		Model(&models.PluginInstallation{}).
		Where(`"tenantId" = ? AND "pluginId" = ? AND active = ?`, tenantID, pluginSlug, true).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
