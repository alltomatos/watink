package saasclient

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/internal/usagestats"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SyncProvisioner é o subconjunto do SetupService que o worker de sync usa
// para executar comandos — espelha a interface local saasProvisioner de
// controllers.SaaSInternalController (o lado push), aqui para o lado pull.
type SyncProvisioner interface {
	ProvisionTenant(data domain.TenantSeedData, spec domain.ProvisionPlanSpec, idempotencyKey string) (domain.ProvisionResult, error)
	PushSubscription(tenantID uuid.UUID, spec domain.ProvisionPlanSpec, status string, expiresAt *time.Time) error
}

// Worker implementa o lado cliente do contrato de sync (issue #631): inicia
// a conexão A CADA tick (nunca o Watink SaaS abrindo uma para cá) — resolve
// o caso de core on-premises atrás de NAT/firewall corporativo sem porta de
// entrada. No-op (sem custo de rede) enquanto a instância não estiver
// pareada via Modo SaaS (services.ErrSaaSContractNotConfigured).
type Worker struct {
	contract *services.SaaSContractService
	db       *gorm.DB
	prov     SyncProvisioner
	version  string
}

// NewWorker injeta o SaaSContractService (contrato de pareamento), o *gorm.DB
// (usado só para set_status, mesma escrita direta do lado push em
// controllers.SaaSInternalController.SetStatus) e o SyncProvisioner
// (DI pura).
func NewWorker(contract *services.SaaSContractService, db *gorm.DB, prov SyncProvisioner, version string) *Worker {
	return &Worker{contract: contract, db: db, prov: prov, version: version}
}

// Run mantém o worker em loop até ctx ser cancelado. tickInterval ~30s no
// processo real (issue #631); acks reivindicados num ciclo são confirmados
// no ciclo SEGUINTE, nunca no mesmo — mesmo padrão de claim/ack do servidor
// (watink-saas#28).
func (w *Worker) Run(ctx context.Context, tickInterval time.Duration) {
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()
	var pendingAcks []string
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			pendingAcks = w.tick(ctx, pendingAcks)
		}
	}
}

// tick executa um ciclo de sync e devolve os ids executados com sucesso
// nesta passada — o chamador os envia como `acks` no PRÓXIMO tick.
func (w *Worker) tick(ctx context.Context, acks []string) []string {
	contract, err := w.contract.Get()
	if err != nil {
		if !errors.Is(err, services.ErrSaaSContractNotConfigured) {
			slog.Error("saas sync: falha ao ler contrato de pareamento", "erro", err.Error())
		}
		return nil
	}

	client := New(contract.BaseURL, contract.InstanceID, contract.InternalToken)
	resp, err := client.Sync(ctx, SyncRequest{CoreVersion: w.version, Acks: acks, Tenants: w.collectTenantsUsage()})
	if err != nil {
		// NUNCA logar req/resp aqui — podem carregar payload de provisionamento
		// com senha temporária. err de transporte não carrega o token (não é
		// enviado no corpo, só em header).
		slog.Error("saas sync: falha na chamada ao Watink SaaS", "erro", err.Error())
		return acks // tenta confirmar os mesmos acks no próximo tick
	}

	if err := w.contract.TouchSync(); err != nil {
		slog.Error("saas sync: falha ao atualizar lastSyncAt", "erro", err.Error())
	}

	executed := make([]string, 0, len(resp.Commands))
	for _, cmd := range resp.Commands {
		if err := w.execute(cmd); err != nil {
			slog.Error("saas sync: falha ao executar comando", "command", cmd.Command, "commandId", cmd.ID, "erro", err.Error())
			continue // sem ack — o servidor reentrega após a janela de redelivery
		}
		executed = append(executed, cmd.ID)
	}
	return executed
}

// collectTenantsUsage monta o snapshot de uso (issue #631, watink-saas#28)
// enviado a cada tick — um item por tenant local, cross-tenant por natureza
// (mesmo padrão de controllers.SaaSInternalController.Usage, lado push).
// Falha ao listar/coletar loga e devolve nil — o sync em si (claim/ack de
// comandos) nunca deve travar por causa de telemetria de uso.
func (w *Worker) collectTenantsUsage() []map[string]any {
	var tenants []models.Tenant
	if err := w.db.Find(&tenants).Error; err != nil {
		slog.Error("saas sync: falha ao listar tenants para uso", "erro", err.Error())
		return nil
	}
	result := make([]map[string]any, 0, len(tenants))
	for _, t := range tenants {
		usage, err := usagestats.Collect(w.db, t.ID)
		if err != nil {
			slog.Error("saas sync: falha ao coletar uso do tenant", "tenantId", t.ID, "erro", err.Error())
			continue
		}
		result = append(result, usage.ToMap(t.ID))
	}
	return result
}

// execute despacha um comando por um ALLOWLIST estrito de tipos — qualquer
// tipo fora dela nunca é executado (AC da #631). Um tipo desconhecido é
// tratado como "confirmado" (ack) para não entrar num loop infinito de
// redelivery de um comando que este core nunca vai saber processar (ex.: um
// watink-saas mais novo introduziu um comando que este core mais antigo
// ainda não entende) — mas fica logado bem alto.
func (w *Worker) execute(cmd SyncCommand) error {
	switch cmd.Command {
	case "provision":
		return w.executeProvision(cmd)
	case "set_status":
		return w.executeSetStatus(cmd)
	case "push_subscription":
		return w.executePushSubscription(cmd)
	default:
		slog.Error("saas sync: comando fora da allowlist, REJEITADO sem executar", "command", cmd.Command, "commandId", cmd.ID)
		return nil
	}
}

type provisionPlanBody struct {
	Name               string   `json:"name"`
	UsersLimit         int      `json:"usersLimit"`
	ConnectionsLimit   int      `json:"connectionsLimit"`
	QueuesLimit        int      `json:"queuesLimit"`
	PluginQuota        int      `json:"pluginQuota"`
	PluginEntitlements []string `json:"pluginEntitlements"`
	Price              float64  `json:"price"`
	Active             bool     `json:"active"`
}

func (b provisionPlanBody) toSpec() domain.ProvisionPlanSpec {
	return domain.ProvisionPlanSpec{
		Name:               b.Name,
		UsersLimit:         b.UsersLimit,
		ConnectionsLimit:   b.ConnectionsLimit,
		QueuesLimit:        b.QueuesLimit,
		PluginQuota:        b.PluginQuota,
		PluginEntitlements: b.PluginEntitlements,
		Price:              b.Price,
		Active:             b.Active,
	}
}

// executeProvision espelha controllers.SaaSInternalController.ProvisionTenant
// (lado push) — mesmo shape de payload, já que o Watink SaaS constrói o
// corpo do comando exatamente como constrói o POST para /internal/saas/tenants.
// Idempotente por idempotencyKey — responsabilidade do SetupService, não
// duplicada aqui (issue #631 exige isso, não reimplementa).
func (w *Worker) executeProvision(cmd SyncCommand) error {
	var body struct {
		CompanyName    string            `json:"companyName"`
		FirstName      string            `json:"firstName"`
		LastName       string            `json:"lastName"`
		Email          string            `json:"email"`
		Password       string            `json:"password"`
		Document       string            `json:"document"`
		IdempotencyKey string            `json:"idempotencyKey"`
		Plan           provisionPlanBody `json:"plan"`
	}
	if err := json.Unmarshal(cmd.Payload, &body); err != nil {
		return err
	}
	data := domain.TenantSeedData{
		CompanyName: body.CompanyName,
		FirstName:   body.FirstName,
		LastName:    body.LastName,
		Email:       body.Email,
		Password:    body.Password,
		Document:    body.Document,
	}
	_, err := w.prov.ProvisionTenant(data, body.Plan.toSpec(), body.IdempotencyKey)
	return err
}

// executeSetStatus espelha controllers.SaaSInternalController.SetStatus —
// escrita direta, sem passar pelo SyncProvisioner (o lado push também não
// passa pelo SetupService para isso).
func (w *Worker) executeSetStatus(cmd SyncCommand) error {
	var body struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	}
	if err := json.Unmarshal(cmd.Payload, &body); err != nil {
		return err
	}
	tenantID, err := uuid.Parse(cmd.TenantID)
	if err != nil {
		return err
	}
	return w.db.Model(&models.Tenant{}).Where("id = ?", tenantID).Update("status", body.Status).Error
}

// executePushSubscription espelha
// controllers.SaaSInternalController.PushSubscription.
func (w *Worker) executePushSubscription(cmd SyncCommand) error {
	var body struct {
		Plan         provisionPlanBody `json:"plan"`
		Subscription struct {
			Status    string     `json:"status"`
			ExpiresAt *time.Time `json:"expiresAt"`
		} `json:"subscription"`
	}
	if err := json.Unmarshal(cmd.Payload, &body); err != nil {
		return err
	}
	tenantID, err := uuid.Parse(cmd.TenantID)
	if err != nil {
		return err
	}
	return w.prov.PushSubscription(tenantID, body.Plan.toSpec(), body.Subscription.Status, body.Subscription.ExpiresAt)
}
