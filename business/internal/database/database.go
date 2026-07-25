package database

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASS"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	fmt.Println("Connected to database successfully")
}

func Migrate() {
	if err := dropLegacyRBAC(); err != nil {
		log.Printf("Warning: failed to drop legacy RBAC schema: %v", err)
	}

	err := DB.AutoMigrate(
		&models.Plan{},
		&models.Tenant{},
		&models.TenantSubscription{},
		&models.User{},
		&models.Setting{},
		&models.Contact{},
		&models.Client{},
		&models.ClientAddress{},
		&models.Whatsapp{},
		&models.Queue{},
		&models.Ticket{},
		&models.Message{},
		&models.Setor{},
		&models.Cargo{},
		&models.Permission{},
		&models.CargoPermissao{},
		&models.UserSetor{},
		&models.SetorFila{},
		&models.Flow{},
		&models.FlowRun{},
		&models.FlowRunLog{},
		&models.QuickAnswer{},
		&models.KnowledgeBase{},
		&models.KnowledgeBaseSource{},
		&models.Pipeline{},
		&models.PipelineStage{},
		&models.Deal{},
		&models.TagGroup{},
		&models.Tag{},
		&models.EntityTag{},
		&models.TicketLog{},
		&models.ConversationEmbedding{},
		&models.PollResult{},
		&models.Proxy{},
		&models.ProxyGroup{},
		&models.ConnectionGroup{},
		&models.PluginInstallation{},
		&models.Protocol{},
		&models.ProtocolLog{},
		&models.ProtocolAttachment{},
	)

	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	if err := applyRLS(); err != nil {
		log.Printf("Warning: failed to apply RLS policies: %v", err)
	}

	if err := addCustomIndexes(); err != nil {
		log.Printf("Warning: failed to create custom indexes: %v", err)
	}

	addClientAddressGeography()

	fmt.Println("Database migration completed")
	Seed()
}

// addClientAddressGeography adds the PostGIS spatial column backing
// ClientAddress (ADR 0023) via raw SQL — GORM does not model the `geography`
// type natively. Best-effort: the PostGIS extension may be absent in some dev
// environments, so a failure is logged and never blocks boot (log.Fatalf is
// deliberately not used here).
func addClientAddressGeography() {
	if err := DB.Exec(`ALTER TABLE "ClientAddresses" ADD COLUMN IF NOT EXISTS geog geography(Point,4326)`).Error; err != nil {
		log.Printf("Warning: failed to add ClientAddresses.geog (PostGIS extension may be missing): %v", err)
	}
}

// Seed recria o catálogo de Permissions em granularidade recurso:ação
// (ADR 0022) — não mais resource:view de menu. Cargos-padrão e o primeiro
// Administrador são criados por SetupService.InitializeTenant, não aqui.
func Seed() {
	permissions := []models.Permission{
		// users
		{Resource: "users", Action: "read", Description: "Visualizar Usuários"},
		{Resource: "users", Action: "create", Description: "Criar Usuários"},
		{Resource: "users", Action: "update", Description: "Editar Usuários"},
		{Resource: "users", Action: "delete", Description: "Excluir Usuários"},
		{Resource: "users", Action: "manage", Description: "Gerenciar Cargo/Setor de outros usuários"},
		// setores
		{Resource: "setores", Action: "read", Description: "Visualizar Setores"},
		{Resource: "setores", Action: "create", Description: "Criar Setores"},
		{Resource: "setores", Action: "update", Description: "Editar Setores"},
		{Resource: "setores", Action: "delete", Description: "Excluir Setores"},
		{Resource: "setores", Action: "manage", Description: "Gerenciar membros/gestores de Setores"},
		// cargos
		{Resource: "cargos", Action: "read", Description: "Visualizar Cargos"},
		{Resource: "cargos", Action: "create", Description: "Criar Cargos"},
		{Resource: "cargos", Action: "update", Description: "Editar Cargos"},
		{Resource: "cargos", Action: "delete", Description: "Excluir Cargos"},
		{Resource: "cargos", Action: "manage", Description: "Gerenciar permissões de Cargos"},
		// tickets
		{Resource: "tickets", Action: "read", Description: "Visualizar Tickets"},
		{Resource: "tickets", Action: "create", Description: "Criar Tickets"},
		{Resource: "tickets", Action: "update", Description: "Editar Tickets"},
		{Resource: "tickets", Action: "delete", Description: "Excluir Tickets"},
		{Resource: "tickets", Action: "reassign", Description: "Transferir/reatribuir Tickets"},
		{Resource: "tickets", Action: "close", Description: "Encerrar Tickets"},
		{Resource: "tickets", Action: "export", Description: "Exportar Tickets"},
		// contacts
		{Resource: "contacts", Action: "read", Description: "Visualizar Contatos"},
		{Resource: "contacts", Action: "create", Description: "Criar Contatos"},
		{Resource: "contacts", Action: "update", Description: "Editar Contatos"},
		{Resource: "contacts", Action: "delete", Description: "Excluir Contatos"},
		// clients (CRM)
		{Resource: "clients", Action: "read", Description: "Visualizar Clientes"},
		{Resource: "clients", Action: "create", Description: "Criar Clientes"},
		{Resource: "clients", Action: "update", Description: "Editar Clientes"},
		{Resource: "clients", Action: "delete", Description: "Excluir Clientes"},
		{Resource: "clients", Action: "manage", Description: "Gerenciar vínculos de Contato e Endereços de Clientes"},
		// connections (WhatsApp/Conexões)
		{Resource: "connections", Action: "read", Description: "Visualizar Conexões"},
		{Resource: "connections", Action: "create", Description: "Criar Conexões"},
		{Resource: "connections", Action: "update", Description: "Editar Conexões"},
		{Resource: "connections", Action: "delete", Description: "Excluir Conexões"},
		// pipelines
		{Resource: "pipelines", Action: "read", Description: "Visualizar Pipelines"},
		{Resource: "pipelines", Action: "create", Description: "Criar Pipelines"},
		{Resource: "pipelines", Action: "update", Description: "Editar Pipelines"},
		{Resource: "pipelines", Action: "delete", Description: "Excluir Pipelines"},
		// flows
		{Resource: "flows", Action: "read", Description: "Visualizar/gerenciar Flows (Automação)"},
		{Resource: "flows", Action: "create", Description: "Criar Flows"},
		{Resource: "flows", Action: "update", Description: "Editar Flows"},
		{Resource: "flows", Action: "delete", Description: "Excluir Flows"},
		// settings (inclui faturamento/billing por ora)
		{Resource: "settings", Action: "read", Description: "Visualizar Configurações"},
		{Resource: "settings", Action: "update", Description: "Editar Configurações"},
		// reports (escopo distinto)
		{Resource: "reports", Action: "view-sector", Description: "Visualizar Relatórios do Setor"},
		{Resource: "reports", Action: "view-tenant", Description: "Visualizar Relatórios do Tenant"},
		// queues
		{Resource: "queues", Action: "read", Description: "Visualizar Filas"},
		{Resource: "queues", Action: "create", Description: "Criar Filas"},
		{Resource: "queues", Action: "update", Description: "Editar Filas"},
		{Resource: "queues", Action: "delete", Description: "Excluir Filas"},
		// swagger
		{Resource: "swagger", Action: "view", Description: "Visualizar documentação Swagger"},
	}

	for _, p := range permissions {
		DB.FirstOrCreate(&p, models.Permission{Resource: p.Resource, Action: p.Action})
	}

	fmt.Println("Database seeding completed")
}

// dropLegacyRBAC remove o schema RBAC legado (Group/Role/RolePermission +
// tabelas de junção mortas) num reset destrutivo autorizado em dev — sem
// migração de dado (ADR 0022). Cada statement roda isolado; erros de
// "does not exist" são esperados e ignorados, outros erros são logados mas
// não interrompem a migração (fail-forward para não travar boot em dev).
func dropLegacyRBAC() error {
	statements := []string{
		`DROP TABLE IF EXISTS group_permissions CASCADE`,
		`DROP TABLE IF EXISTS group_roles CASCADE`,
		`DROP TABLE IF EXISTS user_permissions CASCADE`,
		`DROP TABLE IF EXISTS user_roles CASCADE`,
		`DROP TABLE IF EXISTS role_permissions CASCADE`,
		`ALTER TABLE "Users" DROP COLUMN IF EXISTS profile`,
		`ALTER TABLE "Users" DROP COLUMN IF EXISTS "groupId"`,
		`DROP TABLE IF EXISTS "Groups" CASCADE`,
		`DROP TABLE IF EXISTS "Roles" CASCADE`,
		`DROP TABLE IF EXISTS "RolePermissions" CASCADE`,
		// Catálogo legado de granularidade MENU (resource:view) — Seed() só usa
		// FirstOrCreate (nunca remove), então sem isso essas entradas ficam
		// poluindo o catálogo novo recurso:ação para sempre. DELETE seletivo (não
		// TRUNCATE da tabela toda) para não apagar cargo_permissoes já associadas
		// ao catálogo novo em bootups subsequentes.
		//
		// NOTA: ('flows','read') do catálogo antigo NÃO entra aqui — colide
		// (mesmo resource+action) com a permissão nova 'flows:read' (ação real,
		// não menu) criada pelo Seed(). Incluí-la aqui apagava a permissão nova
		// a cada boot (DELETE por resource+action, sem distinguir a intenção),
		// e a cascata removia o vínculo cargo_permissoes do Administrador —
		// bug real observado: Administrador ficava com 3/4 permissions de
		// flows após um segundo restart do servidor.
		`DELETE FROM "Permissions" WHERE (resource, action) IN (
			('admin','view'), ('chats','view'), ('groups','view'), ('pipelines','view'),
			('queues','view'), ('settings','view'), ('view','swagger')
		)`,
	}

	for _, stmt := range statements {
		if err := DB.Exec(stmt).Error; err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "does not exist") {
				continue
			}
			log.Printf("dropLegacyRBAC: statement failed (%s): %v", stmt, err)
		}
	}
	return nil
}

func addCustomIndexes() error {
	// Migração multi-tenant: Queue.name/color eram unique GLOBAL
	// (uni_Queues_name/uni_Queues_color) — o unique global quebrava o
	// provisionamento do 2º tenant (dois tenants não podiam ter uma fila
	// "Atendimento Inicial" nem a mesma cor). Agora name é único por-tenant
	// (idx_queues_tenant_name, criado pelo AutoMigrate) e color não é único.
	// Dropa as constraints antigas (best-effort; ausência é esperada em banco novo).
	for _, ddl := range []string{
		`ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS uni_Queues_name`,
		`ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS uni_Queues_color`,
	} {
		if err := DB.Exec(ddl).Error; err != nil {
			log.Printf("addCustomIndexes (drop legacy Queue uniques): %q: %v", ddl, err)
		}
	}

	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status ON "Tickets" ("tenantId", "status")`,
		`CREATE INDEX IF NOT EXISTS idx_tickets_tenant_queue_status ON "Tickets" ("tenantId", "queueId", "status")`,
		`CREATE INDEX IF NOT EXISTS idx_messages_tenant_ticket_fromme ON "Messages" ("tenantId", "ticketId", "fromMe")`,
		`CREATE INDEX IF NOT EXISTS idx_messages_tenant_fromme_createdat ON "Messages" ("tenantId", "fromMe", "createdAt")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_answers_tenant_shortcut ON "QuickAnswers" ("tenantId", shortcut)`,
		// FlowRun scheduler/cleanup read-paths: resume-due and expire-due sweeps
		// are tenant-scoped, status-filtered range scans on resumeAt/expiresAt.
		`CREATE INDEX IF NOT EXISTS idx_flow_runs_tenant_status_resumeat ON "FlowRuns" ("tenantId", "status", "resumeAt")`,
		`CREATE INDEX IF NOT EXISTS idx_flow_runs_tenant_status_expiresat ON "FlowRuns" ("tenantId", "status", "expiresAt")`,
		// Resume-first lookup: an inbound message resolves the active run for a
		// ticket via (tenantId, ticketId, status=waiting_*).
		`CREATE INDEX IF NOT EXISTS idx_flow_runs_tenant_ticket_status ON "FlowRuns" ("tenantId", "ticketId", "status")`,
		// Deal board render is tenant-scoped: kanban/funil lists by stage and the
		// ticket sidebar lists by ticket — both filter (tenantId, stageId|ticketId).
		`CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage ON "Deals" ("tenantId", "stageId")`,
		`CREATE INDEX IF NOT EXISTS idx_deals_tenant_ticket ON "Deals" ("tenantId", "ticketId")`,
		// KnowledgeBaseSources: the Show preload lists sources by knowledgeBaseId
		// and mutations/status updates scope by (tenantId, knowledgeBaseId).
		`CREATE INDEX IF NOT EXISTS idx_kb_sources_tenant_kb ON "KnowledgeBaseSources" ("tenantId", "knowledgeBaseId")`,
		// Proxy pool reads are tenant-scoped and filter by status (active pool,
		// isolated list) for assignment and the anti-ban isolation guard.
		`CREATE INDEX IF NOT EXISTS idx_proxies_tenant_status ON "Proxies" ("tenantId", "status")`,
		// Clients (CRM, ADR 0023): most Contacts have no Client, so a partial
		// index on the non-null subset keeps the "resolve Client from Contact"
		// lookup and the reverse "Contacts of a Client" join cheap.
		`CREATE INDEX IF NOT EXISTS idx_contacts_client ON "Contacts" ("clientId") WHERE "clientId" IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_client_addresses_tenant_client ON "ClientAddresses" ("tenantId", "clientId")`,
		// PluginInstallations (ADR 0024): activation lookup is always
		// (tenantId, pluginId) — the UNIQUE also enforces one allocation row
		// per plugin per tenant. idx_plugin_installations_tenant backs the
		// "list installed plugins for tenant" read-path independently.
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_installations_tenant_plugin ON "PluginInstallations" ("tenantId", "pluginId")`,
		`CREATE INDEX IF NOT EXISTS idx_plugin_installations_tenant ON "PluginInstallations" ("tenantId")`,
		// Idempotência do provisionamento pelo control plane SaaS (rota interna
		// POST /internal/saas/tenants): único parcial sobre a chave, ignorando os
		// tenants criados por fora (initial-setup público) cujo provisionKey é NULL.
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_provision_key ON "Tenants" ("provisionKey") WHERE "provisionKey" IS NOT NULL`,
		// Protocol (plugin Helpdesk): Kanban/lista filtram por (tenantId, status);
		// o link público resolve por token isoladamente (já UNIQUE no model).
		`CREATE INDEX IF NOT EXISTS idx_protocols_tenant_status ON "Protocols" ("tenantId", "status")`,
		`CREATE INDEX IF NOT EXISTS idx_protocol_logs_protocol ON "ProtocolLogs" ("protocolId")`,
		`CREATE INDEX IF NOT EXISTS idx_protocol_attachments_protocol ON "ProtocolAttachments" ("protocolId")`,
	}

	// Best-effort: um índice que falha (ex.: tabela de plugin ainda não migrada
	// naquele banco) NÃO deve abortar a criação dos demais — antes um único erro
	// (ex.: "Deals" não existe) pulava todos os índices seguintes, inclusive o de
	// idempotência do provisionamento.
	for _, ddl := range indexes {
		if err := DB.Exec(ddl).Error; err != nil {
			log.Printf("addCustomIndexes: %q falhou (best-effort, seguindo): %v", ddl, err)
		}
	}

	// RBAC (ADR 0022): índices de lookup por request + integridade.
	//  - user_setores(setorId): lookup reverso no Setor.List (agrega membros/
	//    gestores) e nos joins de permissão; sem ele é seq scan na junção.
	//  - Cargos(tenantId,name) UNIQUE: serve o lookup do Cargo "Gestor" por
	//    request E garante nome único por tenant (reforça o anti-lockout).
	//  - Setores(tenantId,name) UNIQUE: nome de Setor único por tenant.
	//  - Permissions(resource,action) UNIQUE: uma linha por permissão — impede
	//    duplicação no Seed concorrente (Swarm multi-node) e casa o read-path.
	// As UNIQUE são BEST-EFFORT: num banco legado que já tenha linhas repetidas
	// a criação falha; logamos e seguimos (não travar o boot). No fluxo de reset
	// do projeto o banco está limpo e todas passam — e como addCustomIndexes
	// roda ANTES do Seed(), a UNIQUE de Permissions já existe quando o catálogo
	// é populado.
	rbacIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_user_setores_setor ON user_setores ("setorId")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_cargos_tenant_name ON "Cargos" ("tenantId", name)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_setores_tenant_name ON "Setores" ("tenantId", name)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_resource_action ON "Permissions" (resource, action)`,
	}
	for _, ddl := range rbacIndexes {
		if err := DB.Exec(ddl).Error; err != nil {
			log.Printf("addCustomIndexes (RBAC best-effort): %q falhou (provável dado repetido legado): %v", ddl, err)
		}
	}
	return nil
}

func applyRLS() error {
	tables := []string{"Users", "Tickets", "Messages", "Contacts", "Settings", "ConversationEmbeddings", "FlowRuns", "FlowRunLogs", "Clients", "ClientAddresses"}

	for _, t := range tables {
		if err := DB.Exec(fmt.Sprintf("ALTER TABLE \"%s\" ENABLE ROW LEVEL SECURITY", t)).Error; err != nil {
			return fmt.Errorf("enable rls %s: %w", t, err)
		}
		if err := DB.Exec(fmt.Sprintf("ALTER TABLE \"%s\" FORCE ROW LEVEL SECURITY", t)).Error; err != nil {
			return fmt.Errorf("force rls %s: %w", t, err)
		}

		policy := fmt.Sprintf("%s_tenant_isolation", strings.ToLower(t))
		if err := DB.Exec(fmt.Sprintf("DROP POLICY IF EXISTS \"%s\" ON \"%s\"", policy, t)).Error; err != nil {
			return fmt.Errorf("drop policy %s: %w", t, err)
		}
		if err := DB.Exec(fmt.Sprintf(
			"CREATE POLICY \"%s\" ON \"%s\" USING ((\"tenantId\")::text = current_setting('app.current_tenant', true))",
			policy, t,
		)).Error; err != nil {
			return fmt.Errorf("policy %s: %w", t, err)
		}
	}

	return nil
}
