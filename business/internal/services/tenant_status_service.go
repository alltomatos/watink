package services

import (
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TenantStatusService resolve o Tenant.Status ("active"|"suspended"|"canceled")
// com cache em memória de TTL curto (padrão espelhado de pluginlicense.Client:
// pull + cache ~60s), para o gate de suspensão (Onda 2/A.3 do watink-saas) não
// bater no Postgres em toda request autenticada.
type TenantStatusService struct {
	db  *gorm.DB
	ttl time.Duration

	mu    sync.Mutex
	cache map[uuid.UUID]tenantStatusEntry
}

type tenantStatusEntry struct {
	status    string
	fetchedAt time.Time
}

const defaultTenantStatusTTL = 60 * time.Second

func NewTenantStatusService(db *gorm.DB) *TenantStatusService {
	return &TenantStatusService{
		db:    db,
		ttl:   defaultTenantStatusTTL,
		cache: make(map[uuid.UUID]tenantStatusEntry),
	}
}

// GetStatus devolve o status atual do tenant. Consulta direta na tabela
// Tenants (chave primária, sem RLS/escopo — é o próprio registro raiz do
// tenant, não dado tenant-scoped), com cache por TTL. Erro de banco não usa
// cache stale aqui (diferente do pluginlicense, que é uma chamada de rede
// remota): se a query falhar, o chamador decide o fallback.
func (s *TenantStatusService) GetStatus(tenantID uuid.UUID) (string, error) {
	s.mu.Lock()
	if entry, ok := s.cache[tenantID]; ok && time.Since(entry.fetchedAt) < s.ttl {
		s.mu.Unlock()
		return entry.status, nil
	}
	s.mu.Unlock()

	var status string
	if err := s.db.Table("Tenants").Select("status").Where("id = ?", tenantID).Scan(&status).Error; err != nil {
		return "", err
	}

	s.mu.Lock()
	s.cache[tenantID] = tenantStatusEntry{status: status, fetchedAt: time.Now()}
	s.mu.Unlock()

	return status, nil
}

// Invalidate remove a entrada em cache de um tenant. Usado pela rota interna
// PATCH /internal/saas/tenants/:tenantId/status para não deixar até 60s de
// atraso entre o SaaS suspender o tenant e o gate reagir.
func (s *TenantStatusService) Invalidate(tenantID uuid.UUID) {
	s.mu.Lock()
	delete(s.cache, tenantID)
	s.mu.Unlock()
}
