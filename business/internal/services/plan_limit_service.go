package services

import (
	"fmt"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PlanLimitError é o erro tipado devolvido quando um limite de plano é
// atingido — carrega resource+limit pra o controller montar a resposta
// estruturada `403 {"error":"plan_limit_reached","resource":...,"limit":...}`
// exigida por docs/integration-core.md §2.2 (watink-saas), em vez de só uma
// mensagem humana.
type PlanLimitError struct {
	Resource string
	Limit    int
	Count    int64
}

func (e *PlanLimitError) Error() string {
	return fmt.Sprintf("plan limit reached for %s (%d/%d)", e.Resource, e.Count, e.Limit)
}

type PlanLimitService struct {
	db *gorm.DB
}

func NewPlanLimitService(db *gorm.DB) *PlanLimitService {
	return &PlanLimitService{
		db: db,
	}
}

// CheckLimit compara o uso atual do tenant contra o limite da assinatura
// vigente. `0` no limite do plano é convenção de ILIMITADO em todo o
// ecossistema (mantida aqui). Só é chamado em CRIAÇÃO (call sites em
// user_mutation.go/whatsapp.go/queue.go) -- nunca em leitura/update.
//
// Sem filtro de Status na busca da subscription: um tenant já passou pelo
// TenantStatusGate (bloqueia suspended/canceled em Tenants.Status) antes de
// chegar aqui, e status "trialing" também deve ter o limite do plano
// aplicado -- filtrar só "active" deixaria trial sem gate nenhum.
func (s *PlanLimitService) CheckLimit(tenantID uuid.UUID, resource string) error {
	var sub models.TenantSubscription
	err := s.db.Session(&gorm.Session{NewDB: true}).
		Where(`"tenantId" = ?`, tenantID).
		Preload("Plan").
		First(&sub).Error

	if resource == "plugins" {
		// Comportamento pré-existente, preservado: recurso pago exige uma
		// subscription resolvível -- sem uma, nenhum plugin `pro` é
		// alocável (fail-closed em CRESCIMENTO, ADR 0024).
		if err != nil {
			return fmt.Errorf("active subscription required for plugin features")
		}
		var count int64
		if err := s.db.Session(&gorm.Session{NewDB: true}).
			Table("PluginInstallations").Where(`"tenantId" = ?`, tenantID).Count(&count).Error; err != nil {
			return err
		}
		if sub.Plan.PluginQuota > 0 && int(count) >= sub.Plan.PluginQuota {
			return &PlanLimitError{Resource: resource, Limit: sub.Plan.PluginQuota, Count: count}
		}
		return nil
	}

	// users/connections/queues são features core (sempre ligadas) -- sem
	// subscription resolvível (instância não gerida por um Watink SaaS, ou
	// dado incompleto), o histórico é "sempre ilimitado" e este fail-open
	// preserva isso: o gate real é a existência de um limite > 0 no plano,
	// não a presença da subscription em si.
	if err != nil {
		return nil
	}
	plan := sub.Plan

	switch resource {
	case "users":
		return s.checkCount(tenantID, resource, plan.UsersLimit, &models.User{})
	case "connections":
		return s.checkCount(tenantID, resource, plan.ConnectionsLimit, &models.Whatsapp{})
	case "queues":
		return s.checkCount(tenantID, resource, plan.QueuesLimit, &models.Queue{})
	}

	return nil
}

// checkCount aplica a convenção `0`=ilimitado e compara COUNT atual vs
// limite via `WHERE "tenantId" = ?`. Session(NewDB:true) obrigatório: `s.db`
// pode ser o handle escopado por tenant que veio via auth.GetScoped no
// controller chamador -- reusar sem sessão nova acumularia o Where dele
// nesta query e em queries subsequentes no mesmo handle (armadilha conhecida
// do repo, CLAUDE.md módulo Proxy/Campanhas de Grupo).
func (s *PlanLimitService) checkCount(tenantID uuid.UUID, resource string, limit int, model interface{}) error {
	if limit <= 0 {
		return nil
	}
	var count int64
	if err := s.db.Session(&gorm.Session{NewDB: true}).
		Model(model).Where(`"tenantId" = ?`, tenantID).Count(&count).Error; err != nil {
		return err
	}
	if int(count) >= limit {
		return &PlanLimitError{Resource: resource, Limit: limit, Count: count}
	}
	return nil
}
