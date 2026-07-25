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
	Checkout(slug, returnURL string) (pluginlicense.CheckoutOrderResponse, error)
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
	ReturnURL string `json:"returnUrl" binding:"required"`
}

// @Summary      Iniciar checkout de plugin pro (Checkout Pro — pagamento real)
// @Description  Cria (ou reaproveita, idempotente) um pedido de compra pending para o plugin `pro` indicado e devolve a URL de redirect pro Checkout Pro do Mercado Pago — a licença só nasce quando o webhook confirma o pagamento.
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

	order, err := pc.pmProxy.Checkout(slug, req.ReturnURL)
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

	info, err := pc.license.GetLicense(slug)
	// Sem licença válida (indeterminado, unlicensed, blocked, readonly) nunca
	// autoriza uma NOVA ativação -- só "active" libera crescimento (ADR 0024,
	// fail-closed).
	if err != nil || info.Status != "active" {
		// A resposta continua sendo 402 SEMPRE neste branch -- a licença nunca é
		// concedida de forma síncrona aqui, então "unlicensed" permanece
		// verdade mesmo quando o checkout é disparado com sucesso.
		//
		// O Hub cria/reativa a domain.PluginLicense de forma síncrona no
		// checkout, mas o TOKEN Ed25519 só chega ao plugin-manager no
		// próximo heartbeat (até heartbeatIntervalMin minutos, default
		// 15min). Ou seja: mesmo um checkout bem-sucedido não ativa o
		// plugin nesta mesma requisição -- só na chamada seguinte de
		// /activate, depois que o plugin-manager absorver o novo token. Por
		// isso a resposta é sempre 402 aqui; checkoutRequested apenas
		// informa ao cliente se o pedido de licença foi disparado (e ele
		// deve tentar de novo depois, via poll) ou se falhou de fato.
		if pc.pmProxy == nil {
			// Sem proxy não há como pedir checkout -- preserva o
			// comportamento antigo (nenhuma tentativa).
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":             "plugin_unlicensed",
				"checkoutRequested": false,
				"message":           "Plugin sem licença e o serviço de checkout está indisponível.",
			})
			return
		}

		// Fluxo legado (fire-and-forget, nunca segue o checkoutUrl devolvido
		// aqui — o cliente só faz poll de /activate depois) ainda precisa de
		// um returnUrl não-vazio porque o Hub exige o campo pra montar as
		// back_urls da preferência; usa a própria origem da requisição como
		// melhor esforço, já que ninguém vai de fato seguir esse link aqui.
		legacyReturnURL := "https://" + c.Request.Host + "/admin/settings/marketplace/" + slug
		if _, checkoutErr := pc.pmProxy.Checkout(slug, legacyReturnURL); checkoutErr != nil {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":             "plugin_unlicensed",
				"checkoutRequested": false,
				"message":           "Não foi possível solicitar a licença: " + checkoutErr.Error(),
			})
			return
		}

		c.JSON(http.StatusPaymentRequired, gin.H{
			"error":             "plugin_unlicensed",
			"checkoutRequested": true,
			"message":           "Licença solicitada. Pode levar alguns minutos para ser confirmada — tente ativar novamente em breve.",
		})
		return
	}

	writeDB := db.Session(&gorm.Session{NewDB: true})

	if info.TenantCap > 0 {
		var existing models.PluginInstallation
		hasRow := true
		if err := writeDB.Session(&gorm.Session{NewDB: true}).
			Where(`"tenantId" = ? AND "pluginId" = ?`, tenantID, slug).
			First(&existing).Error; err != nil {
			if err != gorm.ErrRecordNotFound {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check allocation"})
				return
			}
			hasRow = false
		}

		if !hasRow {
			var count int64
			if err := writeDB.Session(&gorm.Session{NewDB: true}).
				Model(&models.PluginInstallation{}).
				Where(`"pluginId" = ? AND active = ?`, slug, true).
				Count(&count).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check tenant cap"})
				return
			}
			if count >= int64(info.TenantCap) {
				c.JSON(http.StatusPaymentRequired, gin.H{"error": "plugin_tenant_cap_reached"})
				return
			}
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

// Legacy stubs -- remove once all clients migrate to PluginController
func PluginsCatalog(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "migrate to PluginController"})
}
func PluginsInstalled(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "migrate to PluginController"})
}
func PluginsCheckout(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "migrate to PluginController"})
}
func PluginsInstance(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "migrate to PluginController"})
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
