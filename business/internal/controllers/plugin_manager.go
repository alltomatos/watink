package controllers

import (
	"net/http"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/pluginlicense"
	"github.com/alltomatos/watinkdev/business/internal/plugins"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PluginManagerProxy is the small port the controller needs from the local
// plugin-manager (via pluginlicense.Client) to serve the Marketplace catalog
// and the instance identity. Kept as an interface so tests can inject a fake
// and so the controller depends on a behaviour, not on *pluginlicense.Client.
// The business never talks to the Hub directly -- only to the plugin-manager
// (ADR 0024). *pluginlicense.Client satisfies this interface.
type PluginManagerProxy interface {
	GetCatalog() (pluginlicense.CatalogResponse, error)
	GetInstance() (pluginlicense.InstanceResponse, error)
	CheckoutCard(slug, cycle, returnURL string) (pluginlicense.CheckoutOrderResponse, error)
	CheckoutPix(slug, cycle, payerEmail string) (pluginlicense.CheckoutPixResponse, error)
	CartCheckoutCard(items []pluginlicense.CartItem, returnURL string) (pluginlicense.CartCheckoutResponse, error)
	CartCheckoutPix(items []pluginlicense.CartItem, payerEmail string) (pluginlicense.CartCheckoutResponse, error)
}

type PluginController struct {
	planLimitSvc domain.PlanLimitServiceInterface
	db           *gorm.DB
	registry     *plugins.PluginRegistry
	license      plugins.LicenseFetcher
	pmProxy      PluginManagerProxy
}

// NewPluginController is built via constructor injection (DI pura) -- db,
// registry, license and pmProxy are always passed in, never resolved through a
// global/service locator. registry/license/pmProxy may be nil in tests that
// only exercise a subset of handlers; the Catalog/Instance fail-safe covers a
// nil pmProxy.
func NewPluginController(planLimitSvc domain.PlanLimitServiceInterface, db *gorm.DB, registry *plugins.PluginRegistry, license plugins.LicenseFetcher, pmProxy PluginManagerProxy) *PluginController {
	return &PluginController{planLimitSvc: planLimitSvc, db: db, registry: registry, license: license, pmProxy: pmProxy}
}

type checkoutRequest struct {
	Slug string `json:"slug" binding:"required"`
}

// @Summary      Ativar/instalar plugin (legado)
// @Description  Endpoint legado -- superado por POST /plugins/:slug/activate.
// @Tags         plugins
// @Produce      json
// @Success      503  {object}  map[string]string
// @Security     BearerAuth
// @Router       /plugins/checkout [post]
func (pc *PluginController) Checkout(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "use POST /plugins/:slug/activate"})
}

type createCheckoutOrderRequest struct {
	// Cycle identifica o ciclo de recorrência escolhido (ver
	// pluginlicense.CatalogPlugin.PricingCycles) — vazio significa
	// pagamento único (exige CatalogPlugin.SinglePaymentEnabled).
	Cycle     string `json:"cycle"`
	ReturnURL string `json:"returnUrl" binding:"required"`
}

// @Summary      Iniciar checkout de plugin pro via Cartão (Checkout Pro — pagamento real)
// @Description  Cria (ou reaproveita, idempotente) um pedido de compra pending para o ciclo (ou pagamento único) escolhido do plugin `pro` indicado e devolve a URL de redirect pro Checkout Pro do Mercado Pago — a licença só nasce quando o webhook confirma o pagamento.
// @Tags         plugins
// @Produce      json
// @Success      201  {object}  pluginlicense.CheckoutOrderResponse
// @Security     BearerAuth
// @Router       /plugins/{slug}/checkout [post]
func (pc *PluginController) CreateCheckoutOrder(c *gin.Context) {
	slug := c.Param("slug")
	_, _, ok := auth.GetScoped(c, "Plugins")
	if !ok {
		return
	}

	var req createCheckoutOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "message": err.Error()})
		return
	}

	if pc.pmProxy == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "checkout service unavailable"})
		return
	}

	order, err := pc.pmProxy.CheckoutCard(slug, req.Cycle, req.ReturnURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "checkout_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, order)
}

type createPixCheckoutOrderRequest struct {
	Cycle      string `json:"cycle"`
	PayerEmail string `json:"payerEmail" binding:"required,email"`
}

// @Summary      Iniciar checkout de plugin pro via Pix
// @Description  Cria (ou reaproveita, idempotente) um pedido de compra pending para o ciclo (ou pagamento único) escolhido do plugin `pro` indicado e devolve o QR code/copia-e-cola — a licença só nasce quando o webhook confirma o pagamento (Pix não confirma na hora).
// @Tags         plugins
// @Produce      json
// @Success      201  {object}  pluginlicense.CheckoutPixResponse
// @Security     BearerAuth
// @Router       /plugins/{slug}/checkout/pix [post]
func (pc *PluginController) CreatePixCheckoutOrder(c *gin.Context) {
	slug := c.Param("slug")
	_, _, ok := auth.GetScoped(c, "Plugins")
	if !ok {
		return
	}

	var req createPixCheckoutOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "message": err.Error()})
		return
	}

	if pc.pmProxy == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "checkout service unavailable"})
		return
	}

	order, err := pc.pmProxy.CheckoutPix(slug, req.Cycle, req.PayerEmail)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "checkout_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, order)
}

// @Summary      Catálogo de plugins
// @Description  Proxy para GET /api/v1/plugins/catalog do plugin-manager (que proxeia o Hub). Fail-safe: em erro ou proxy ausente, responde 200 com {offline:true, plugins:[]}.
// @Tags         plugins
// @Produce      json
// @Success      200  {object}  pluginlicense.CatalogResponse
// @Security     BearerAuth
// @Router       /plugins/catalog [get]
func (pc *PluginController) Catalog(c *gin.Context) {
	// Fail-safe: proxy ausente (nil) ou plugin-manager fora do ar NUNCA
	// derruba a rota do Marketplace -- responde 200 com um catálogo vazio
	// marcado offline, deixando o frontend degradar graciosamente.
	if pc.pmProxy == nil {
		c.JSON(http.StatusOK, pluginlicense.CatalogResponse{Offline: true, Plugins: []pluginlicense.CatalogPlugin{}})
		return
	}

	catalog, err := pc.pmProxy.GetCatalog()
	if err != nil {
		c.JSON(http.StatusOK, pluginlicense.CatalogResponse{Offline: true, Plugins: []pluginlicense.CatalogPlugin{}})
		return
	}

	if catalog.Plugins == nil {
		catalog.Plugins = []pluginlicense.CatalogPlugin{}
	}
	c.JSON(http.StatusOK, catalog)
}

// @Summary      Plugins instalados
// @Tags         plugins
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /plugins/installed [get]
func (pc *PluginController) Installed(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Plugins")
	if !ok {
		return
	}

	var installs []models.PluginInstallation
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`"tenantId" = ? AND active = ?`, tenantID, true).
		Find(&installs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load plugin installations"})
		return
	}

	active := make([]string, 0, len(installs))
	statuses := make(map[string]string, len(installs))
	for _, inst := range installs {
		active = append(active, inst.PluginID)
		if pc.registry != nil {
			statuses[inst.PluginID] = string(pc.registry.GetStatus(tenantID, inst.PluginID))
		} else {
			statuses[inst.PluginID] = string(sdk.StatusBlocked)
		}
	}

	c.JSON(http.StatusOK, gin.H{"active": active, "statuses": statuses})
}

// isFreePlugin delega a pc.registry (mesmo cache de ~30s usado pelo
// gating de rota em RegisterRoute -> GetStatus, ver registry.go). Fail-safe
// para false quando registry é nil (algumas construções de teste) --
// na dúvida, segue o caminho normal de licença (pro), nunca o de "sempre
// ativo".
func (pc *PluginController) isFreePlugin(slug string) bool {
	if pc.registry == nil {
		return false
	}
	return pc.registry.IsFreePlugin(slug)
}

// @Summary      Ativar plugin
// @Description  Ativa/aloca um plugin para o tenant atual. 402 se sem licença válida (dispara checkout best-effort junto ao Hub via plugin-manager) ou se o teto de tenants foi atingido.
// @Tags         plugins
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      402  {object}  map[string]interface{}  "plugin_unlicensed (com checkoutRequested indicando se o pedido de licença foi disparado) ou plugin_tenant_cap_reached"
// @Security     BearerAuth
// @Router       /plugins/{slug}/activate [post]
func (pc *PluginController) Activate(c *gin.Context) {
	slug := c.Param("slug")
	db, tenantID, ok := auth.GetScoped(c, "Plugins")
	if !ok {
		return
	}

	if pc.license == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "license service unavailable"})
		return
	}

	// Plugin free NUNCA toca o Hub (docs/agents/plugins.md, CLAUDE.md
	// "Módulo: Plugins") -- o Hub não emite token pra ele, então
	// pc.license.GetLicense(slug) devolveria sempre "unlicensed" (nenhum
	// token cacheado pelo plugin-manager) e cairia no checkout, que o Hub
	// rejeita com 422 pra Type=free (checkout.Handler exige Type=pro). O
	// Type vem do catálogo (autoridade do Hub) via pmProxy -- nunca do
	// manifesto Go embarcado, que pode ficar desatualizado se o Tipo for
	// trocado depois no Console (Hub agora permite editar Type num plugin
	// já existente).
	var info plugins.LicenseInfo
	var err error
	isFree := pc.isFreePlugin(slug)
	if isFree {
		info = plugins.LicenseInfo{Status: "active", TenantCap: 0}
	} else {
		info, err = pc.license.GetLicense(slug)
	}

	// Gate 2/3 (ADR 0026): plugin free nunca passa por aqui -- o eixo
	// comercial de planEntitlements só existe pra plugins pagos. Numa
	// instância plan_only (Watink SaaS gerindo o comércio), o plano do
	// tenant é quem decide se ele PODE ter o plugin, antes mesmo de checar
	// se a instância TEM licença pra ele -- por isso este gate vem antes do
	// gate de licença (4).
	mode := marketplaceMode(db)
	if !isFree && mode == "plan_only" {
		entitlements := planEntitlements(db, tenantID)
		if !entitlementIncludes(entitlements, slug) {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":   "plugin_not_in_plan",
				"message": "O seu plano não inclui este recurso. Fale com o administrador da sua conta.",
			})
			return
		}
	}

	// Sem licença válida (indeterminado, unlicensed, blocked, readonly) nunca
	// autoriza uma NOVA ativação -- só "active" libera crescimento (ADR 0024,
	// fail-closed).
	if err != nil || info.Status != "active" {
		// Fora do modo self_service a instância é gerida pelo Watink SaaS
		// (plan_only/catalog_visible) -- não faz sentido disparar um
		// checkout individual do tenant direto no Hub; quem contrata a
		// licença da instância é o dono via SaaS (ADR 0026).
		if mode != "self_service" {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":   "plugin_managed_by_saas",
				"message": "Este recurso precisa ser contratado pelo administrador da sua conta.",
			})
			return
		}

		// Diferente do fluxo legado (que disparava um checkout de valor único
		// fire-and-forget aqui), o checkout agora exige escolher um ciclo de
		// recorrência ou pagamento único e, no caso de Pix, e-mail do
		// pagador — dados que só o cliente pode escolher. Não há mais um
		// checkout automático disparado por /activate: a resposta é sempre
		// 402 com checkoutRequested=false, orientando o cliente a completar
		// o checkout explicitamente no Marketplace (POST
		// /plugins/:slug/checkout ou /checkout/pix) e então tentar ativar de
		// novo.
		c.JSON(http.StatusPaymentRequired, gin.H{
			"error":             "plugin_unlicensed",
			"checkoutRequested": false,
			"message":           "Este plugin precisa de uma licença paga. Complete o checkout no Marketplace e tente ativar novamente.",
		})
		return
	}

	writeDB := db.Session(&gorm.Session{NewDB: true})

	if info.TenantCap > 0 {
		// O gate de teto SEMPRE roda, contando outros tenants (exclui o
		// próprio tenantID) -- upsertInstallation faz seu próprio
		// lookup/branch create-vs-update mais abaixo, então não precisamos
		// checar a existência da linha aqui. Antes este bloco era pulado
		// inteiro quando já existia uma linha com active=false, permitindo
		// reativar um plugin já desativado furando o tenantCap -- bug real:
		// reativação nunca deveria escapar do gate que uma nova ativação
		// respeita.
		var count int64
		if err := writeDB.Session(&gorm.Session{NewDB: true}).
			Model(&models.PluginInstallation{}).
			Where(`"pluginId" = ? AND active = ? AND "tenantId" <> ?`, slug, true, tenantID).
			Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check tenant cap"})
			return
		}
		if count >= int64(info.TenantCap) {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":   "plugin_tenant_cap_reached",
				"message": "O limite de contas com este recurso foi atingido nesta instalação. Fale com o administrador da sua conta.",
			})
			return
		}
	}

	now := time.Now()
	if err := upsertInstallation(writeDB, tenantID, slug, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to activate plugin"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"slug": slug, "active": true})
}

// @Summary      Desativar plugin
// @Tags         plugins
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /plugins/{slug}/deactivate [post]
func (pc *PluginController) Deactivate(c *gin.Context) {
	slug := c.Param("slug")
	db, tenantID, ok := auth.GetScoped(c, "Plugins")
	if !ok {
		return
	}

	// active=false preserva histórico/auditoria (ActivatedAt/By), preferível a
	// DELETE -- consistente com o padrão "suspensão nunca apaga" usado em
	// outras partes do projeto (watink-saas).
	if err := db.Session(&gorm.Session{NewDB: true}).
		Model(&models.PluginInstallation{}).
		Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, slug).
		Update("active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to deactivate plugin"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"slug": slug, "active": false})
}

// @Summary      ID da instância
// @Description  Proxy para GET /api/v1/plugins/instance do plugin-manager. Fail-safe: em erro ou proxy ausente, responde 200 com {"instanceId":""}.
// @Tags         plugins
// @Produce      json
// @Success      200  {object}  pluginlicense.InstanceResponse
// @Security     BearerAuth
// @Router       /plugins/instance [get]
func (pc *PluginController) Instance(c *gin.Context) {
	// Fail-safe: proxy ausente/erro degrada para instanceId vazio, nunca 500.
	if pc.pmProxy == nil {
		c.JSON(http.StatusOK, gin.H{"instanceId": ""})
		return
	}

	inst, err := pc.pmProxy.GetInstance()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"instanceId": ""})
		return
	}

	c.JSON(http.StatusOK, gin.H{"instanceId": inst.InstanceID})
}

// upsertInstallation creates or reactivates the (tenantId, pluginId) row.
// UNIQUE(tenantId, pluginId) on the model means a plain Create on an existing
// row would violate the constraint -- use ON CONFLICT DO UPDATE instead so
// re-activating an already-existing (possibly inactive) row never duplicates
// it.
//
// Note on ActivatedBy: models.PluginInstallation.ActivatedBy is *uuid.UUID,
// but the authenticated userId injected by middleware.IsAuth is a numeric
// Users.ID (int), not a UUID (see pkg/auth/permission.go userIDFromContext,
// unexported). There is no safe conversion between the two types, so
// ActivatedBy is intentionally left NULL by this upsert rather than
// fabricating a UUID from an int or reinterpreting the column. This is a
// pre-existing model/context type mismatch; fixing it would mean changing
// the model (models/plugin_installation.go), which is out of scope for this
// endpoint slice per task instructions.
func upsertInstallation(db *gorm.DB, tenantID interface{}, slug string, now time.Time) error {
	// A plain GORM Create would violate UNIQUE(tenantId, pluginId) (added via
	// raw SQL migration in database.go -- not expressed as a GORM tag on the
	// model, see models/plugin_installation.go) if the row already exists
	// (e.g. reactivating a previously deactivated allocation). Look the row
	// up first and branch explicitly instead of relying on a named ON
	// CONFLICT target, since the constraint's existence differs between the
	// production migration and the test schema (AutoMigrate does not create
	// it from the model tags).
	var existing models.PluginInstallation
	err := db.Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, slug).First(&existing).Error
	if err == nil {
		return db.Model(&existing).Updates(map[string]interface{}{
			"active":      true,
			"activatedAt": now,
		}).Error
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}

	inst := models.PluginInstallation{
		TenantID:    tenantID.(uuid.UUID),
		PluginID:    slug,
		Active:      true,
		ActivatedAt: &now,
	}
	return db.Create(&inst).Error
}
