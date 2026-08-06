package routes

import (
	"github.com/alltomatos/watinkdev/business/internal/application"
	"github.com/alltomatos/watinkdev/business/internal/controllers"
	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/mediawait"
	"github.com/alltomatos/watinkdev/business/internal/middleware"
	"github.com/alltomatos/watinkdev/business/internal/pluginlicense"
	"github.com/alltomatos/watinkdev/business/internal/plugins"
	"github.com/alltomatos/watinkdev/business/internal/saasclient"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/gin-gonic/gin"
)

type RouteRabbitMQ interface {
	domain.CommandPublisher
	domain.QueueMonitor
	domain.KnowledgeJobPublisher
}

// SetupRoutes wires all HTTP routes. ragRetriever/ragResponder are the
// native pgvector RAG (built once in main.go via
// knowledge.BuildRetrieverAndResponder and shared with the EventListener's
// flow.Skeleton too, so the on-demand endpoints here and the real inbound
// WhatsApp message path never disagree about which implementation answers a
// query).
func SetupRoutes(group *gin.RouterGroup, rabbitMQ RouteRabbitMQ, container *application.Container, s3Store domain.ObjectStore, build controllers.BuildInfo, ragRetriever flow.Retriever, ragResponder flow.AgentResponder, mediaWaiter *mediawait.Waiter) {
	db := container.DB
	messageController := controllers.NewMessageController(rabbitMQ, container.Broadcast, container.SessionService).WithTranscription(db, mediaWaiter)
	systemController := controllers.NewSystemController(container.SystemRepo, rabbitMQ)
	setupService := services.NewSetupService(container.DB)
	setupController := controllers.NewSetupController(setupService)
	saasInternalController := controllers.NewSaaSInternalController(db, setupService)
	pluginManagerInternalController := controllers.NewPluginManagerInternalController(db, build)
	registerController := controllers.NewRegisterController(saasclient.NewFromEnv(), saasclient.NewCaptchaVerifierFromEnv())
	userController := controllers.NewUserController(container.UserRepo, container.PlanLimitSvc)
	queueController := controllers.NewQueueController()
	contactController := controllers.NewContactController(container.ContactRepo, container.ChannelSessionRepo, rabbitMQ, container.Broadcast, container.IzapiaProvider)
	clientController := controllers.NewClientController()
	addressLookupController := controllers.NewAddressLookupController()
	activityController := controllers.NewActivityController(s3Store)
	sessionController := controllers.NewSessionController(container.ChannelSessionRepo, container.Broadcast, container.SessionService)
	ticketController := controllers.NewTicketController(container.UpdateTicket, container.Broadcast, container.MessageRepo, rabbitMQ)
	whatsappController := controllers.NewWhatsappController(container.ChannelSessionRepo, container.PlanLimitSvc, container.Broadcast, container.SessionService)
	proxyController := controllers.NewProxyController()
	proxyGroupController := controllers.NewProxyGroupController()
	izapiaConfigController := controllers.NewIzapiaConfigController()
	connectionGroupController := controllers.NewConnectionGroupController()
	setorController := controllers.NewSetorController()
	cargoController := controllers.NewCargoController()
	// Plugin licensing (ADR 0024): the business never talks to the Hub
	// directly -- only to the local plugin-manager, via pluginlicense.Client
	// (pull + cache ~60s). PluginRegistry crosses that license with the
	// PluginInstallations allocation table.
	pluginLicenseClient := pluginlicense.NewClient()
	pluginLicenseFetcher := plugins.NewLicenseFetcher(pluginLicenseClient)
	pluginCatalogFetcher := plugins.NewCatalogFetcher(pluginLicenseClient)
	pluginRegistry := plugins.NewPluginRegistry(db, pluginLicenseFetcher, pluginCatalogFetcher)
	pluginController := controllers.NewPluginController(container.PlanLimitSvc, db, pluginRegistry, pluginLicenseFetcher, pluginLicenseClient)
	authController := controllers.NewAuthController(container.UserRepo)
	settingController := controllers.NewSettingController(container.SettingRepo, container.Broadcast)
	tagController := controllers.NewTagController()
	pipelineController := controllers.NewPipelineController()
	dealController := controllers.NewDealController()
	kbController := controllers.NewKnowledgeBaseController(rabbitMQ, s3Store)
	kbInspectController := controllers.NewKnowledgeInspectController(ragRetriever)
	// FlowBuilder FASE 1: build a channel registry + runtime skeleton for the
	// on-demand run endpoint (POST /flows/:id/run). Uses the worker DB
	// (container.DB) with manual WHERE "tenantId"; RLS is inert in StartFlow.
	flowChannels := flow.NewChannelRegistry()
	flowChannels.Register(flow.NewWhatsAppAdapter(rabbitMQ, container.RedisSvc, flow.WhatsAppAdapterDeps{
		DB:      container.DB,
		Engines: container.SessionService,
	}))
	flowRuntime := flow.NewSkeleton(container.DB, flowChannels, container.RedisSvc)
	flowRuntime.SetRetriever(ragRetriever)
	flowRuntime.SetResponder(ragResponder)
	// Wires the "Assistentes de IA" plugin's runtime into the synthetic Flow's
	// "assistant" node (ADR 0027) — set post-construction since the
	// implementation lives in the plugins package (DI pura, no global).
	flowRuntime.SetAssistantRuntime(plugins.NewAssistantRuntime(container.DB, rabbitMQ, mediaWaiter))
	flowController := controllers.NewFlowController(flowRuntime)
	quickAnswerController := controllers.NewQuickAnswerController(rabbitMQ, container.Broadcast, db, container.SessionService)
	versionController := controllers.NewVersionController(container.VersionRepo)
	swaggerController := controllers.NewSwaggerController(container.SwaggerPermRepo)
	storageController := controllers.NewStorageController(s3Store)

	// Public Routes
	group.POST("/auth/login", authController.Login)
	group.POST("/auth/refresh_token", authController.RefreshToken)
	group.GET("/public-settings", settingController.GetPublicSettings)
	group.GET("/initial-setup/check", setupController.CheckSetup)
	group.POST("/initial-setup", setupController.InitialSetup)
	group.GET("/system/maintenance", controllers.GetMaintenanceStatus)

	// Registro self-service (Onda 6, ADR 0007 do Watink SaaS) — proxy público
	// que repassa a intenção do usuário ao control plane SaaS (nunca cria tenant
	// aqui). Só existe quando SAAS_BASE_URL/SAAS_INSTANCE_ID/SAAS_INTERNAL_TOKEN
	// estão setadas; sem elas, o grupo simplesmente não é montado — o frontend
	// esconde o botão "Registrar-se" e nada muda para quem não usa o Watink SaaS.
	if registerController.Enabled() {
		group.GET("/register/plans", registerController.Plans)
		group.POST("/register", registerController.Register)
		group.GET("/register/:id/status", registerController.Status)
	}

	// Swagger / API docs
	group.GET("/docs", swaggerController.SwaggerUI)
	group.GET("/swagger.json", swaggerController.SwaggerJSON)

	// Internal control-plane (Watink SaaS) — Trilha A. SEM JWT: protegido por
	// InternalSaaSOnly (X-Internal-Token vs env SAAS_INTERNAL_TOKEN, fail-closed
	// 503 quando ausente). Cross-tenant por natureza; montado FORA da cadeia
	// protegida (IsAuth/TenantMiddleware). Ver docs/integration-core.md §1.
	internalSaaS := group.Group("/internal/saas")
	internalSaaS.Use(middleware.InternalSaaSOnly())
	{
		internalSaaS.GET("/ping", saasInternalController.Ping)
		internalSaaS.POST("/tenants", saasInternalController.ProvisionTenant)
		internalSaaS.GET("/tenants", saasInternalController.ListTenants)
		internalSaaS.PATCH("/tenants/:tenantId/status", saasInternalController.SetStatus)
		internalSaaS.PUT("/tenants/:tenantId/subscription", saasInternalController.PushSubscription)
		internalSaaS.GET("/tenants/:tenantId/usage", saasInternalController.Usage)
	}

	// Internal control-plane (Watink Hub via plugin-manager local) — mesmo
	// padrão do bloco acima: SEM JWT, protegido por InternalPluginManagerOnly
	// (X-Internal-Token vs env PLUGIN_MANAGER_INTERNAL_TOKEN, fail-closed).
	// O plugin-manager consulta esses números pra popular `counters` no
	// heartbeat do Hub — soma TODOS os tenants da instância, sem filtro (o
	// Hub não conhece cada tenant em separado, ADR 0003).
	internalPluginManager := group.Group("/internal/plugin-manager")
	internalPluginManager.Use(middleware.InternalPluginManagerOnly())
	{
		internalPluginManager.GET("/instance-stats", pluginManagerInternalController.InstanceStats)
	}

	// Protected Routes (IsAuth + TenantMiddleware required)
	protected := group.Group("/")
	protected.Use(controllers.MaintenanceMiddleware())
	protected.Use(middleware.IsAuth(db))
	protected.Use(middleware.TenantMiddleware())
	{
		// System (superadmin only — exposes cross-tenant stats and infrastructure)
		system := protected.Group("/system")
		system.Use(middleware.SuperAdminOnly())
		{
			system.GET("/stats", systemController.GetSystemStats)
			system.GET("/storage", storageController.Status)
			system.GET("/rabbitmq/queues", systemController.GetRabbitMQQueues)
			system.GET("/latest-release", controllers.GetLatestRelease)
			system.GET("/version", versionController.GetVersion)
			system.GET("/version/postgres", versionController.GetPostgresVersion)
			system.GET("/version/rabbitmq", versionController.GetRabbitMQVersion)
			system.GET("/version/redis", versionController.GetRedisVersion)
			system.POST("/update", controllers.StartUpdate)
		}

		// Plugins (tenant-scoped — moved inside protected group)
		protected.GET("/plugins/catalog", pluginController.Catalog)
		protected.GET("/plugins/installed", pluginController.Installed)
		protected.POST("/plugins/checkout", pluginController.Checkout)
		protected.GET("/plugins/instance", pluginController.Instance)
		protected.POST("/plugins/:slug/activate", pluginController.Activate)
		protected.POST("/plugins/:slug/deactivate", pluginController.Deactivate)
		protected.POST("/plugins/:slug/checkout", pluginController.CreateCheckoutOrder)

		// Plugin CONTENT routes (helpdesk/webchat business routes, registered
		// via WatinkCore.RegisterRoute inside each plugin's OnActivate). router
		// MUST be `protected` (authenticated, tenant-scoped) — not the raw
		// `group` — or auth.TenantUUIDFromContext/GetScoped never resolve
		// inside a plugin's handlers. publicRouter is the raw `group`, for
		// RegisterPublicRoute (e.g. the helpdesk public share link, no login).
		// Reuses pluginRegistry (above) so gating is the exact same license x
		// allocation cross the marketplace endpoints above already use.
		pluginManager := plugins.NewPluginManagerWithRegistry(db, protected, group, pluginRegistry, container.Broadcast, rabbitMQ, container.RedisSvc)
		pluginManager.Register(&plugins.HelpdeskPlugin{})
		pluginManager.Register(&plugins.WebchatPlugin{})
		pluginManager.Register(&plugins.AssistantPlugin{})
		pluginManager.Register(&plugins.GroupsPlugin{Resolver: container.SessionService})

		// Auth
		protected.DELETE("/auth/logout", authController.Logout)

		// Settings
		protected.GET("/settings", settingController.ListSettings)
		protected.PUT("/settings/:key", settingController.UpdateSetting)

		// Tickets
		protected.GET("/tickets", ticketController.ListTickets)
		protected.GET("/tickets/", ticketController.ListTickets)
		protected.GET("/tickets/:ticketId", ticketController.ShowTicket)
		protected.PUT("/tickets/:ticketId", auth.RequirePermission("tickets", "update"), ticketController.UpdateTicket)
		protected.DELETE("/tickets/:ticketId", auth.RequirePermission("tickets", "delete"), ticketController.DeleteTicket)
		protected.GET("/tickets/:ticketId/logs", ticketController.ListTicketLogs)
		protected.POST("/tickets/:ticketId/history/recover", ticketController.RecoverHistory)

		// Dashboard
		protected.GET("/dashboard", controllers.GetDashboardData)

		// Messages
		protected.GET("/messages/:ticketId", messageController.ListMessages)
		protected.POST("/messages/:ticketId", messageController.SendMessage)
		// On-demand media download (separate path to avoid Gin wildcard conflict
		// with :ticketId at the same position)
		protected.POST("/media/:messageId/download", messageController.DownloadMedia)
		protected.POST("/messages/:messageId/transcribe", messageController.TranscribeAudio)
		// Nested under a distinct literal segment ("message", singular) --
		// gin's radix router panics at startup if two routes share a path
		// position with different wildcard names (":messageId" here vs the
		// existing ":ticketId" under "/messages/:ticketId").
		protected.POST("/message/:messageId/react", messageController.ReactToMessage)

		// WhatsApp Connections
		protected.GET("/whatsapp", auth.RequirePermission("connections", "read"), whatsappController.ListWhatsapps)
		protected.GET("/whatsapp/", auth.RequirePermission("connections", "read"), whatsappController.ListWhatsapps)
		protected.GET("/whatsapp/:id", auth.RequirePermission("connections", "read"), whatsappController.ShowWhatsapp)
		protected.POST("/whatsapp", auth.RequirePermission("connections", "create"), whatsappController.CreateWhatsapp)
		protected.PUT("/whatsapp/:id", auth.RequirePermission("connections", "update"), whatsappController.UpdateWhatsapp)
		protected.GET("/whatsapp/:id/stats", auth.RequirePermission("connections", "read"), whatsappController.StatsWhatsapp)
		protected.PUT("/whatsapp/:id/keepalive", auth.RequirePermission("connections", "update"), whatsappController.ToggleKeepAlive)
		protected.DELETE("/whatsapp/:id", auth.RequirePermission("connections", "delete"), whatsappController.DeleteWhatsapp)

		// Proxies (anti-ban) — mesmo domínio de acesso que as conexões
		// (Whatsapps): gated por connections:<ação> (P2-2). Antes as rotas eram
		// só tenant-scoped, então um usuário sem permissão de conexões podia
		// criar/importar/rotacionar e até zerar o pool (DELETE /proxies).
		protected.GET("/proxies", auth.RequirePermission("connections", "read"), proxyController.List)
		protected.POST("/proxies", auth.RequirePermission("connections", "create"), proxyController.Create)
		protected.POST("/proxies/import", auth.RequirePermission("connections", "create"), proxyController.Import)
		protected.POST("/proxies/test-all", auth.RequirePermission("connections", "update"), proxyController.TestAll)
		protected.POST("/proxies/assign-group", auth.RequirePermission("connections", "update"), proxyController.AssignGroup)
		protected.DELETE("/proxies", auth.RequirePermission("connections", "delete"), proxyController.DeleteAll)
		protected.PUT("/proxies/:id", auth.RequirePermission("connections", "update"), proxyController.Update)
		protected.DELETE("/proxies/:id", auth.RequirePermission("connections", "delete"), proxyController.Delete)
		protected.POST("/proxies/:id/isolate", auth.RequirePermission("connections", "update"), proxyController.Isolate)
		protected.POST("/proxies/:id/activate", auth.RequirePermission("connections", "update"), proxyController.Activate)
		protected.POST("/proxies/:id/test", auth.RequirePermission("connections", "update"), proxyController.Test)

		// Credencial izapia do tenant — mesmo domínio de acesso das conexões.
		protected.GET("/izapia-config", auth.RequirePermission("connections", "read"), izapiaConfigController.Get)
		protected.PUT("/izapia-config", auth.RequirePermission("connections", "update"), izapiaConfigController.Save)

		// Grupos de proxy (pool com rotação) e grupos de conexões — idem gate.
		protected.GET("/proxy-groups", auth.RequirePermission("connections", "read"), proxyGroupController.List)
		protected.POST("/proxy-groups", auth.RequirePermission("connections", "create"), proxyGroupController.Create)
		protected.PUT("/proxy-groups/:id", auth.RequirePermission("connections", "update"), proxyGroupController.Update)
		protected.DELETE("/proxy-groups/:id", auth.RequirePermission("connections", "delete"), proxyGroupController.Delete)
		protected.GET("/connection-groups", auth.RequirePermission("connections", "read"), connectionGroupController.List)
		protected.POST("/connection-groups", auth.RequirePermission("connections", "create"), connectionGroupController.Create)
		protected.PUT("/connection-groups/:id", auth.RequirePermission("connections", "update"), connectionGroupController.Update)
		protected.DELETE("/connection-groups/:id", auth.RequirePermission("connections", "delete"), connectionGroupController.Delete)

		// WhatsApp Sessions
		protected.POST("/whatsappsession/all", auth.RequirePermission("connections", "update"), sessionController.RestartAllSessions)
		protected.POST("/whatsappsession/:whatsappId", auth.RequirePermission("connections", "update"), sessionController.StartSession)
		protected.PUT("/whatsappsession/:whatsappId", auth.RequirePermission("connections", "update"), sessionController.StartSession)
		protected.DELETE("/whatsappsession/:whatsappId", auth.RequirePermission("connections", "update"), sessionController.StopSession)

		// Contacts
		protected.GET("/contacts", contactController.ListContacts)
		protected.GET("/contacts/", contactController.ListContacts)
		protected.GET("/contacts/:contactId", contactController.ShowContact)
		protected.POST("/contacts", contactController.CreateContact)
		protected.POST("/contacts/", contactController.CreateContact)
		protected.POST("/contacts/import", contactController.ImportContacts)
		protected.POST("/contacts/bulk-delete", contactController.BulkDeleteContacts)
		protected.DELETE("/contacts/all", contactController.DeleteAllContacts)
		protected.POST("/contacts/:contactId/sync", contactController.SyncContact)
		protected.PUT("/contacts/:contactId", contactController.UpdateContact)
		protected.DELETE("/contacts/:contactId", contactController.DeleteContact)

		// Clients (CRM) — ADR 0023. Rota nova, gateada desde o início
		// (invariante do módulo Acessos): nenhuma rota nova de escrita/leitura
		// entra sem auth.RequirePermission.
		protected.GET("/clients", auth.RequirePermission("clients", "read"), clientController.List)
		protected.GET("/clients/:id", auth.RequirePermission("clients", "read"), clientController.Show)
		protected.POST("/clients", auth.RequirePermission("clients", "create"), clientController.Create)
		protected.PUT("/clients/:id", auth.RequirePermission("clients", "update"), clientController.Update)
		protected.DELETE("/clients/:id", auth.RequirePermission("clients", "delete"), clientController.Delete)
		protected.GET("/clients/:id/history", auth.RequirePermission("clients", "read"), clientController.History)
		protected.GET("/clients/:id/addresses", auth.RequirePermission("clients", "read"), clientController.ListAddresses)
		protected.POST("/clients/:id/addresses", auth.RequirePermission("clients", "manage"), clientController.CreateAddress)
		protected.PUT("/clients/:id/addresses/:addressId", auth.RequirePermission("clients", "manage"), clientController.UpdateAddress)
		protected.DELETE("/clients/:id/addresses/:addressId", auth.RequirePermission("clients", "manage"), clientController.DeleteAddress)
		protected.POST("/clients/:id/contacts/:contactId/link", auth.RequirePermission("clients", "manage"), clientController.LinkContact)
		protected.DELETE("/clients/:id/contacts/:contactId", auth.RequirePermission("clients", "manage"), clientController.UnlinkContact)
		protected.GET("/addresses/lookup", auth.RequirePermission("clients", "read"), addressLookupController.Lookup)

		// Activities (Ordens de Serviço) — ADR 0029. Todas as rotas irmãs sob
		// /activities/ usam o MESMO nome de wildcard ":id" — dois nomes
		// diferentes na mesma posição de path fazem o Gin entrar em pânico no
		// boot. GET /my-activities é a visão do EXECUTOR (filtro incondicional
		// por assignee, mesmo pra alcance=tenant); GET /activities é a visão de
		// GESTÃO (tenant inteiro) — não confundir as duas.
		protected.GET("/activities/sla-config", auth.RequirePermission("activities", "manage"), activityController.GetSLAConfig)
		protected.PUT("/activities/sla-config", auth.RequirePermission("activities", "manage"), activityController.UpdateSLAConfig)
		protected.GET("/my-activities", auth.RequirePermission("activities", "read"), activityController.MyActivities)
		protected.GET("/my-activities/kpis", auth.RequirePermission("activities", "read"), activityController.MyActivitiesKPIs)
		protected.GET("/activities", auth.RequirePermission("activities", "read"), activityController.List)
		protected.POST("/activities", auth.RequirePermission("activities", "create"), activityController.Create)
		protected.GET("/activities/:id", auth.RequirePermission("activities", "read"), activityController.Show)
		protected.PUT("/activities/:id", auth.RequirePermission("activities", "update"), activityController.Update)
		protected.DELETE("/activities/:id", auth.RequirePermission("activities", "delete"), activityController.Delete)
		protected.PUT("/activities/:id/assignees", auth.RequirePermission("activities", "manage"), activityController.UpdateAssignees)
		protected.PUT("/activities/:id/start", auth.RequirePermission("activities", "update"), activityController.Start)
		protected.PUT("/activities/:id/items/:itemId", auth.RequirePermission("activities", "update"), activityController.UpdateItem)
		protected.POST("/activities/:id/items/:itemId/photo", auth.RequirePermission("activities", "update"), activityController.UploadItemPhoto)
		protected.POST("/activities/:id/finalize", auth.RequirePermission("activities", "update"), activityController.Finalize)
		protected.POST("/activities/:id/materials", auth.RequirePermission("activities", "update"), activityController.AddMaterial)
		protected.DELETE("/activities/:id/materials/:materialId", auth.RequirePermission("activities", "update"), activityController.DeleteMaterial)
		protected.POST("/activities/:id/occurrences", auth.RequirePermission("activities", "update"), activityController.AddOccurrence)
		protected.DELETE("/activities/:id/occurrences/:occurrenceId", auth.RequirePermission("activities", "update"), activityController.DeleteOccurrence)

		// Queues
		protected.GET("/queue", queueController.ListQueues)
		protected.GET("/queue/", queueController.ListQueues)
		protected.GET("/queue/:queueId", queueController.ShowQueue)
		protected.POST("/queue", queueController.CreateQueue)
		protected.POST("/queue/", queueController.CreateQueue)
		protected.PUT("/queue/:queueId", queueController.UpdateQueue)
		protected.DELETE("/queue/:queueId", queueController.DeleteQueue)

		// Quick Answers
		protected.GET("/quickAnswers", quickAnswerController.List)
		protected.GET("/quickAnswers/", quickAnswerController.List)
		protected.GET("/quickAnswers/:quickAnswerId", quickAnswerController.Show)
		protected.POST("/quickAnswers", quickAnswerController.Create)
		protected.POST("/quickAnswers/", quickAnswerController.Create)
		protected.PUT("/quickAnswers/:quickAnswerId", quickAnswerController.Update)
		protected.DELETE("/quickAnswers/:quickAnswerId", quickAnswerController.Delete)
		protected.POST("/quickAnswers/:quickAnswerId/send", quickAnswerController.Send)

		// Knowledge Bases
		// knowledgeBases:* — added retroactively (these routes shipped with no
		// gate at all, contrary to ADR 0022's "no new write route ships
		// ungated" invariant); see Seed() for the matching Permission rows.
		protected.GET("/knowledge-bases", auth.RequirePermission("knowledgeBases", "read"), kbController.List)
		protected.GET("/knowledge-bases/", auth.RequirePermission("knowledgeBases", "read"), kbController.List)
		protected.GET("/knowledge-bases/:knowledgeBaseId", auth.RequirePermission("knowledgeBases", "read"), kbController.Show)
		protected.POST("/knowledge-bases", auth.RequirePermission("knowledgeBases", "manage"), kbController.Create)
		protected.PUT("/knowledge-bases/:knowledgeBaseId", auth.RequirePermission("knowledgeBases", "manage"), kbController.Update)
		protected.DELETE("/knowledge-bases/:knowledgeBaseId", auth.RequirePermission("knowledgeBases", "manage"), kbController.Delete)
		protected.POST("/knowledge-bases/:knowledgeBaseId/sources", auth.RequirePermission("knowledgeBases", "manage"), kbController.CreateSource)
		protected.POST("/knowledge-bases/:knowledgeBaseId/sources/:sourceId/reingest", auth.RequirePermission("knowledgeBases", "manage"), kbController.ReingestSource)
		protected.DELETE("/knowledge-bases/:knowledgeBaseId/sources/:sourceId", auth.RequirePermission("knowledgeBases", "manage"), kbController.DeleteSource)
		// Inspeção read-only do conhecimento vetorizado (chunks + playground de recuperação).
		protected.GET("/knowledge-bases/:knowledgeBaseId/sources/:sourceId/chunks", auth.RequirePermission("knowledgeBases", "read"), kbInspectController.Chunks)
		protected.POST("/knowledge-bases/:knowledgeBaseId/query", auth.RequirePermission("knowledgeBases", "read"), kbInspectController.Query)

		// Self-service do próprio perfil — SEM RequirePermission: todo usuário
		// autenticado edita o próprio nome/email/senha/whatsapp (o gate users:*
		// é para gerir TERCEIROS). UpdateMe nunca aceita campos de RBAC
		// (alcance/cargoId/setores) — ver user_me.go.
		protected.GET("/me", userController.GetMe)
		protected.PUT("/me", userController.UpdateMe)

		// Users
		protected.GET("/users", auth.RequirePermission("users", "read"), userController.ListUsers)
		protected.GET("/users/", auth.RequirePermission("users", "read"), userController.ListUsers)
		protected.GET("/users/:userId", auth.RequirePermission("users", "read"), userController.ShowUser)
		protected.POST("/users", auth.RequirePermission("users", "create"), userController.CreateUser)
		protected.PUT("/users/:userId", auth.RequirePermission("users", "update"), userController.UpdateUser)
		protected.DELETE("/users/:userId", auth.RequirePermission("users", "delete"), userController.DeleteUser)

		// SaaS (superadmin only)
		saas := protected.Group("/saas")
		saas.Use(middleware.SuperAdminOnly())
		{
			saas.GET("/tenants", controllers.ListTenants)
			saas.GET("/tenants/:tenantId/plan", controllers.GetTenantPlan)
			saas.GET("/plans", controllers.ListPlans)
			saas.POST("/plans", controllers.CreatePlan)
		}

		// RBAC (Setor/Cargo/Permissions) — ADR 0022. Rotas /groups, /roles e
		// /permissions legadas removidas junto com o modelo antigo.
		// Enforcement real via RequirePermission (GAP-2b) — rollout faseado,
		// estas foram as primeiras rotas gateadas.
		protected.GET("/setores", auth.RequirePermission("setores", "read"), setorController.List)
		protected.POST("/setores", auth.RequirePermission("setores", "create"), setorController.Create)
		protected.GET("/setores/:setorId", auth.RequirePermission("setores", "read"), setorController.Show)
		protected.PUT("/setores/:setorId", auth.RequirePermission("setores", "update"), setorController.Update)
		protected.DELETE("/setores/:setorId", auth.RequirePermission("setores", "delete"), setorController.Delete)
		protected.POST("/setores/:setorId/members", auth.RequirePermission("setores", "manage"), setorController.AddMember)
		protected.PUT("/setores/:setorId/members/:userId", auth.RequirePermission("setores", "manage"), setorController.UpdateMember)
		protected.DELETE("/setores/:setorId/members/:userId", auth.RequirePermission("setores", "manage"), setorController.RemoveMember)
		protected.PUT("/setores/:setorId/queues", auth.RequirePermission("setores", "manage"), setorController.SetQueues)

		protected.GET("/cargos", auth.RequirePermission("cargos", "read"), cargoController.List)
		protected.POST("/cargos", auth.RequirePermission("cargos", "create"), cargoController.Create)
		protected.GET("/cargos/catalog/permissions", auth.RequirePermission("cargos", "read"), cargoController.ListPermissionsCatalog)
		protected.GET("/cargos/:cargoId", auth.RequirePermission("cargos", "read"), cargoController.Show)
		protected.PUT("/cargos/:cargoId", auth.RequirePermission("cargos", "update"), cargoController.Update)
		protected.DELETE("/cargos/:cargoId", auth.RequirePermission("cargos", "delete"), cargoController.Delete)

		// Flows
		protected.GET("/flows", flowController.List)
		protected.POST("/flows", flowController.Create)
		protected.POST("/flows/ai", flowController.AISuggest)
		protected.GET("/flows/:flowId", flowController.Show)
		protected.PUT("/flows/:flowId", flowController.Update)
		protected.DELETE("/flows/:flowId", flowController.Delete)
		protected.POST("/flows/:flowId/simulate", flowController.Simulate)
		protected.POST("/flows/:flowId/run", flowController.Run)
		protected.GET("/flowruns", flowController.ListFlowRuns)
		protected.DELETE("/flowruns/:id", flowController.AbortFlowRun)

		// Tags
		protected.GET("/tags", tagController.List)
		protected.POST("/tags", tagController.Create)
		protected.PUT("/tags/:id", tagController.Update)
		protected.DELETE("/tags/:id", tagController.Delete)
		protected.GET("/tag-groups", tagController.ListGroups)
		protected.GET("/entities/:entityType/:id/tags", tagController.GetEntityTags)
		protected.PUT("/entities/:entityType/:id/tags/sync", tagController.SyncEntityTags)

		// Deals
		protected.GET("/deals", dealController.List)
		protected.POST("/deals", dealController.Create)
		protected.PUT("/deals/:id", dealController.Update)

		// Pipelines
		protected.GET("/pipelines", pipelineController.List)
		protected.GET("/pipelines/", pipelineController.List)
		protected.POST("/pipelines", pipelineController.Create)
		protected.PUT("/pipelines/:pipelineId", pipelineController.Update)
		protected.DELETE("/pipelines/:pipelineId", pipelineController.Delete)
		protected.POST("/pipelines/import", pipelineController.Import)
		protected.GET("/pipelines/export/:pipelineId", pipelineController.Export)
		protected.POST("/pipelines/ai-suggest", pipelineController.AISuggest)
	}
}
