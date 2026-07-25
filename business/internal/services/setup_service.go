package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ErrAlreadyInitialized é retornado quando InitializeTenant corre contra um
// sistema que já tem tenant — a barreira concorrente do setup (P3-3).
var ErrAlreadyInitialized = errors.New("system already initialized")

// ErrEmailAlreadyExists é retornado por ProvisionTenant quando o e-mail do dono
// já pertence a outro usuário (Users.email é único global). O control plane SaaS
// trata isso como falha permanente do outbox (409, não re-tenta).
var ErrEmailAlreadyExists = errors.New("email_already_exists")

// ErrTenantNotFound é retornado por PushSubscription quando o tenant alvo não
// existe no core (404 na rota interna).
var ErrTenantNotFound = errors.New("tenant_not_found")

type SetupService struct {
	db *gorm.DB
}

func NewSetupService(db *gorm.DB) *SetupService {
	return &SetupService{db: db}
}

// TenantSeedData is an alias kept for backwards compat with callers inside this package.
type TenantSeedData = domain.TenantSeedData

func (s *SetupService) NeedsSetup(ctx context.Context) (bool, error) {
	var usersCount, tenantsCount int64
	if err := s.db.WithContext(ctx).Model(&models.User{}).Count(&usersCount).Error; err != nil {
		return false, err
	}
	if err := s.db.WithContext(ctx).Model(&models.Tenant{}).Count(&tenantsCount).Error; err != nil {
		return false, err
	}
	return usersCount == 0 && tenantsCount == 0, nil
}

// InitializeTenant é o setup público one-shot (POST /initial-setup): aplica a
// barreira single-tenant e usa o plano "Community" fixo. O seed em si vive em
// seedTenant, compartilhado com ProvisionTenant (control plane SaaS).
func (s *SetupService) InitializeTenant(data TenantSeedData) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 0. Barreira concorrente (P3-3): NeedsSetup no controller é
		// check-then-act fora de transação — dois POST /initial-setup
		// simultâneos numa instalação virgem (emails diferentes) escapariam e
		// criariam 2 tenants. pg_advisory_xact_lock serializa os setups (o lock
		// é liberado no commit/rollback desta tx) e o re-check dentro da tx
		// aborta o segundo. Best-effort no lock: bancos sem suporte (ex.: SQLite)
		// só perdem a serialização, não a corretude do re-check.
		_ = tx.Exec(`SELECT pg_advisory_xact_lock(742042742042)`).Error
		var tenantCount int64
		if err := tx.Model(&models.Tenant{}).Count(&tenantCount).Error; err != nil {
			return err
		}
		if tenantCount > 0 {
			return ErrAlreadyInitialized
		}

		// 1. Plan
		var plan models.Plan
		err := tx.Where("name = ?", "Community").First(&plan).Error
		if err != nil {
			if err != gorm.ErrRecordNotFound {
				return err
			}
			plan = models.Plan{Name: "Community", PluginQuota: 10, Active: true}
			if err := tx.Create(&plan).Error; err != nil {
				return err
			}
		}

		_, _, err = seedTenant(tx, data, &plan, nil)
		return err
	})
}

// ProvisionTenant provisiona um tenant a mando do control plane SaaS (rota
// interna POST /internal/saas/tenants). Diferente de InitializeTenant: SEM a
// barreira single-tenant, com o plano vindo do snapshot do SaaS (upsert por
// nome, padrão ADR 0009) e idempotente pela chave — um retry do outbox com a
// MESMA chave devolve o tenant já criado em vez de duplicar ou estourar 409.
func (s *SetupService) ProvisionTenant(data TenantSeedData, spec domain.ProvisionPlanSpec, idempotencyKey string) (domain.ProvisionResult, error) {
	var result domain.ProvisionResult
	err := s.db.Transaction(func(tx *gorm.DB) error {
		// Idempotência: serializa provisões com a MESMA chave e devolve o tenant
		// existente se já houver. Best-effort no advisory lock (bancos sem
		// suporte só perdem a serialização, não o pre-check). No Postgres o lock
		// garante que uma segunda chamada com a mesma chave enxergue a linha já
		// commitada antes de tentar qualquer insert.
		if idempotencyKey != "" {
			_ = tx.Exec(`SELECT pg_advisory_xact_lock(hashtext(?)::bigint)`, "saas_provision:"+idempotencyKey).Error
			var existing models.Tenant
			err := tx.Where(`"provisionKey" = ?`, idempotencyKey).First(&existing).Error
			if err == nil {
				result = tenantToResult(existing)
				return nil
			}
			if err != gorm.ErrRecordNotFound {
				return err
			}
		}

		plan, err := upsertProvisionPlan(tx, spec)
		if err != nil {
			return err
		}

		var key *string
		if idempotencyKey != "" {
			key = &idempotencyKey
		}
		tenantID, ownerUserID, err := seedTenant(tx, data, plan, key)
		if err != nil {
			if isDuplicateKey(err) {
				return ErrEmailAlreadyExists
			}
			return err
		}
		result = domain.ProvisionResult{TenantID: tenantID.String(), OwnerUserID: ownerUserID}
		return nil
	})
	return result, err
}

// PushSubscription aplica o snapshot da assinatura vindo do control plane SaaS
// (rota interna PUT /internal/saas/tenants/:id/subscription): upsert do Plano por
// nome (ADR 0009) + upsert da TenantSubscription por tenantId. `status` já chega
// no vocabulário do core (active/trialing/expired/canceled) — o mapeamento é
// feito no lado do SaaS. Idempotente por construção.
func (s *SetupService) PushSubscription(tenantID uuid.UUID, spec domain.ProvisionPlanSpec, status string, expiresAt *time.Time) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&models.Tenant{}).Where("id = ?", tenantID).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return ErrTenantNotFound
		}

		plan, err := upsertProvisionPlan(tx, spec)
		if err != nil {
			return err
		}

		var sub models.TenantSubscription
		err = tx.Where(`"tenantId" = ?`, tenantID).First(&sub).Error
		if err != nil {
			if err != gorm.ErrRecordNotFound {
				return err
			}
			sub = models.TenantSubscription{
				TenantID:  tenantID,
				PlanID:    plan.ID,
				Status:    status,
				ExpiresAt: expiresAt,
			}
			return tx.Create(&sub).Error
		}
		sub.PlanID = plan.ID
		sub.Status = status
		sub.ExpiresAt = expiresAt
		return tx.Save(&sub).Error
	})
}

func tenantToResult(t models.Tenant) domain.ProvisionResult {
	r := domain.ProvisionResult{TenantID: t.ID.String()}
	if t.OwnerID != nil {
		r.OwnerUserID = *t.OwnerID
	}
	return r
}

// upsertProvisionPlan faz upsert do Plano por nome (ADR 0009) com os limites do
// snapshot do SaaS: cria se não existe, atualiza limites/preço/ativo se existe.
func upsertProvisionPlan(tx *gorm.DB, spec domain.ProvisionPlanSpec) (*models.Plan, error) {
	name := spec.Name
	if strings.TrimSpace(name) == "" {
		name = "Community"
	}
	var plan models.Plan
	err := tx.Where("name = ?", name).First(&plan).Error
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			return nil, err
		}
		plan = models.Plan{
			Name:             name,
			UsersLimit:       spec.UsersLimit,
			ConnectionsLimit: spec.ConnectionsLimit,
			QueuesLimit:      spec.QueuesLimit,
			PluginQuota:      spec.PluginQuota,
			Price:            spec.Price,
			Active:           spec.Active,
		}
		if err := tx.Session(&gorm.Session{CreateBatchSize: 1}).Create(&plan).Error; err != nil {
			return nil, err
		}
		return &plan, nil
	}
	plan.UsersLimit = spec.UsersLimit
	plan.ConnectionsLimit = spec.ConnectionsLimit
	plan.QueuesLimit = spec.QueuesLimit
	plan.PluginQuota = spec.PluginQuota
	plan.Price = spec.Price
	plan.Active = spec.Active
	if err := tx.Save(&plan).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func isDuplicateKey(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") || strings.Contains(msg, "23505")
}

// seedTenant cria o tenant e todos os ativos day-0 (assinatura, cargos-padrão,
// usuário dono, queue, setor, tag, settings) dentro da transação `tx`, associado
// ao `plan` já resolvido. Retorna o id do tenant e o id do usuário dono. NÃO
// aplica barreira single-tenant nem escolhe o plano — isso é do chamador
// (InitializeTenant, one-shot público; ProvisionTenant, control plane SaaS).
func seedTenant(tx *gorm.DB, data TenantSeedData, plan *models.Plan, provisionKey *string) (uuid.UUID, int, error) {
	// 2. Tenant
	tenant := models.Tenant{
		Name:         data.CompanyName,
		Status:       "active",
		Document:     data.Document,
		ProvisionKey: provisionKey,
	}
	// Helper para GORM com SQLite: desabilita RETURNING (incompatível)
	// Em produção PG funciona nativamente, aqui forçamos insert básico
	if err := tx.Session(&gorm.Session{CreateBatchSize: 1}).Create(&tenant).Error; err != nil {
		return uuid.Nil, 0, err
	}

	// 3. Subscription
	sub := models.TenantSubscription{
		TenantID: tenant.ID,
		PlanID:   plan.ID,
		Status:   "active",
	}
	if err := tx.Create(&sub).Error; err != nil {
		return uuid.Nil, 0, err
	}

	// 4. Cargos-padrão do tenant (ADR 0022): Atendente, Gestor, Gerente Geral,
	// Administrador. Cada um herda o conjunto do anterior + permissões extras.
	var allPerms []models.Permission
	if err := tx.Find(&allPerms).Error; err != nil {
		return uuid.Nil, 0, err
	}
	permByName := make(map[string]models.Permission, len(allPerms))
	for _, p := range allPerms {
		permByName[p.GetName()] = p
	}
	lookupPerms := func(names ...string) []models.Permission {
		out := make([]models.Permission, 0, len(names))
		for _, n := range names {
			if p, ok := permByName[n]; ok {
				out = append(out, p)
			}
		}
		return out
	}

	atendentePermNames := []string{
		"tickets:read", "tickets:create", "tickets:update",
		"contacts:read", "contacts:create", "contacts:update",
	}
	atendenteCargo := models.Cargo{
		Name:        "Atendente",
		Description: "Atende tickets e contatos do dia a dia — cria, lê e atualiza, sem acesso a configurações do sistema.",
		TenantID:    tenant.ID,
	}
	if err := tx.Create(&atendenteCargo).Error; err != nil {
		return uuid.Nil, 0, err
	}
	if err := attachCargoPermissions(tx, atendenteCargo.ID, lookupPerms(atendentePermNames...)); err != nil {
		return uuid.Nil, 0, err
	}

	gestorPermNames := append(append([]string{}, atendentePermNames...),
		"tickets:reassign", "tickets:close", "tickets:export",
		"reports:view-sector", "users:read", "setores:read",
	)
	gestorCargo := models.Cargo{
		Name:        "Gestor",
		Description: "Tudo do Atendente, mais reatribuir/fechar/exportar tickets e ver relatórios do(s) setor(es) que gerencia.",
		TenantID:    tenant.ID,
	}
	if err := tx.Create(&gestorCargo).Error; err != nil {
		return uuid.Nil, 0, err
	}
	if err := attachCargoPermissions(tx, gestorCargo.ID, lookupPerms(gestorPermNames...)); err != nil {
		return uuid.Nil, 0, err
	}

	gerenteGeralPermNames := append(append([]string{}, gestorPermNames...),
		"reports:view-tenant", "users:manage", "setores:manage", "cargos:read",
	)
	gerenteGeralCargo := models.Cargo{
		Name:        "Gerente Geral",
		Description: "Tudo do Gestor, mas para TODOS os setores da empresa — vê relatórios do tenant inteiro e gerencia usuários/setores/cargos.",
		TenantID:    tenant.ID,
	}
	if err := tx.Create(&gerenteGeralCargo).Error; err != nil {
		return uuid.Nil, 0, err
	}
	if err := attachCargoPermissions(tx, gerenteGeralCargo.ID, lookupPerms(gerenteGeralPermNames...)); err != nil {
		return uuid.Nil, 0, err
	}

	adminCargo := models.Cargo{
		Name:        "Administrador",
		Description: "Acesso total ao sistema — configurações, conexões, faturamento e todas as permissões do catálogo.",
		TenantID:    tenant.ID,
	}
	if err := tx.Create(&adminCargo).Error; err != nil {
		return uuid.Nil, 0, err
	}
	if err := attachCargoPermissions(tx, adminCargo.ID, allPerms); err != nil {
		return uuid.Nil, 0, err
	}

	// 5. Administrador User
	user := models.User{
		Name:     data.FirstName + " " + data.LastName,
		Email:    data.Email,
		CargoID:  &adminCargo.ID,
		Alcance:  "tenant",
		TenantID: tenant.ID,
		Configs:  `{"dashboard":{"widgets":[{"id":"tickets_info","visible":true,"width":4,"order":1},{"id":"attendance_chart","visible":true,"width":8,"order":2}]}}`,
	}
	if err := user.HashPassword(data.Password); err != nil {
		return uuid.Nil, 0, err
	}
	if err := tx.Create(&user).Error; err != nil {
		return uuid.Nil, 0, err
	}

	// 6. Update Tenant Owner
	if err := tx.Model(&tenant).Update("ownerId", user.ID).Error; err != nil {
		return uuid.Nil, 0, err
	}

	// 7. Day-0 Assets: Queue (criada antes do Setor para vincular via SetorFila)
	queue := models.Queue{
		Name:                 "Atendimento Inicial",
		Color:                "#000000",
		GreetingMessage:      "Olá! Recebemos sua mensagem e em breve um de nossos atendentes vai falar com você.",
		TenantID:             tenant.ID,
		DistributionStrategy: "MANUAL",
	}
	if err := tx.Create(&queue).Error; err != nil {
		return uuid.Nil, 0, err
	}

	// 8. Day-0 Assets: Setor inicial, vinculado à Queue e ao Administrador (gestor)
	setor := models.Setor{Name: "Geral", TenantID: tenant.ID}
	if err := tx.Create(&setor).Error; err != nil {
		return uuid.Nil, 0, err
	}
	if err := tx.Create(&models.SetorFila{SetorID: setor.ID, QueueID: queue.ID}).Error; err != nil {
		return uuid.Nil, 0, err
	}
	if err := tx.Create(&models.UserSetor{UserID: user.ID, SetorID: setor.ID, EhGestor: true}).Error; err != nil {
		return uuid.Nil, 0, err
	}

	// 9. Day-0 Assets: Tag
	tag := models.Tag{
		Name:     "Novo Cliente",
		Color:    "#28a745",
		TenantID: tenant.ID,
	}
	if err := tx.Create(&tag).Error; err != nil {
		return uuid.Nil, 0, err
	}

	// 10. Default Settings
	settings := []models.Setting{
		{Key: "systemTitle", Value: "Watink", TenantID: tenant.ID},
		{Key: "systemLogo", Value: "/logo.png", TenantID: tenant.ID},
		{Key: "systemLogoEnabled", Value: "true", TenantID: tenant.ID},
		{Key: "login_layout", Value: "centered", TenantID: tenant.ID},
		{Key: "login_backgroundImage", Value: "", TenantID: tenant.ID},
	}
	if data.BackendURL != "" {
		settings = append(settings, models.Setting{Key: "backendUrl", Value: data.BackendURL, TenantID: tenant.ID})
	}
	if err := tx.Create(&settings).Error; err != nil {
		return uuid.Nil, 0, err
	}

	return tenant.ID, user.ID, nil
}

// attachCargoPermissions grants a set of Permissions to a Cargo via explicit
// CargoPermissao rows (cargo_permissoes, camelCase columns). Not done via
// GORM's many2many Association(): that API resolves join-table column names
// independently of the explicit CargoPermissao struct and falls back to
// snake_case conventions, causing a runtime mismatch.
func attachCargoPermissions(tx *gorm.DB, cargoID int, perms []models.Permission) error {
	if len(perms) == 0 {
		return nil
	}
	rows := make([]models.CargoPermissao, len(perms))
	for i, p := range perms {
		rows[i] = models.CargoPermissao{CargoID: cargoID, PermissionID: p.ID}
	}
	return tx.Create(&rows).Error
}
