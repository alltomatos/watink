package services

import (
	"errors"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"gorm.io/gorm"
)

// SaaSContract é a projeção decifrada do contrato de pareamento desta
// instância com um Watink SaaS hospedado (Modo SaaS) — nunca serializado
// como está (o token vem em claro só para o chamador de saída, ex. o worker
// de sync), sempre lido sob demanda a partir de InstancePolicy.
type SaaSContract struct {
	BaseURL       string
	InstanceID    string
	InternalToken string
	PairedAt      *time.Time
	LastSyncAt    *time.Time
}

// Paired reporta se o contrato está totalmente configurado (base URL,
// instanceId e token presentes). Ausência de qualquer um deles é "não
// pareado" — nunca um estado parcialmente funcional.
func (c SaaSContract) Paired() bool {
	return c.BaseURL != "" && c.InstanceID != "" && c.InternalToken != ""
}

// ErrSaaSContractNotConfigured é devolvido por Get quando não há nenhuma
// linha de InstancePolicy ou ela não tem o contrato SaaS preenchido — estado
// válido (instância sem Modo SaaS ativado), o chamador decide o fallback
// (env var, no caso do InternalSaaSOnly e do saasclient).
var ErrSaaSContractNotConfigured = errors.New("saas contract: instância não pareada com um Watink SaaS")

// SaaSContractService lê e escreve o contrato de Modo SaaS persistido em
// InstancePolicy (tabela single-row, instance-wide, fora do RLS). Cifra o
// token at-rest com cryptobox (mesmo padrão do módulo Proxy) — fail-closed
// se a chave de cifragem não estiver configurada.
type SaaSContractService struct {
	db *gorm.DB
}

func NewSaaSContractService(db *gorm.DB) *SaaSContractService {
	return &SaaSContractService{db: db}
}

// Get decifra e devolve o contrato atual. ErrSaaSContractNotConfigured
// (sentinel) sinaliza "sem Modo SaaS ativado" — não é uma falha, é o estado
// default de toda instância que nunca passou pelo registro.
func (s *SaaSContractService) Get() (SaaSContract, error) {
	var policy models.InstancePolicy
	// Session(NewDB:true): db aqui pode ter sido escopado por um caller que
	// reusa um handle de auth.GetScoped — InstancePolicy não tem tenantId, e
	// reusar o handle sem sessão nova acumula esse Where em queries
	// seguintes no mesmo db (mesma armadilha documentada em
	// plugin_marketplace_policy.go).
	err := s.db.Session(&gorm.Session{NewDB: true}).First(&policy).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return SaaSContract{}, ErrSaaSContractNotConfigured
	}
	if err != nil {
		return SaaSContract{}, err
	}
	if policy.SaasBaseURL == nil || policy.SaasInstanceID == nil || policy.SaasInternalTokenEnc == nil {
		return SaaSContract{}, ErrSaaSContractNotConfigured
	}

	token, err := cryptobox.Decrypt(*policy.SaasInternalTokenEnc)
	if err != nil {
		return SaaSContract{}, err
	}

	return SaaSContract{
		BaseURL:       *policy.SaasBaseURL,
		InstanceID:    *policy.SaasInstanceID,
		InternalToken: token,
		PairedAt:      policy.PairedAt,
		LastSyncAt:    policy.LastSyncAt,
	}, nil
}

// Set cifra o token e grava o contrato completo, fazendo upsert da
// InstancePolicy (mesmo padrão de SetInstancePolicy em saas_internal.go:
// First → Save/Create). pairedAt é gravado só na primeira vez — trocar o
// token depois não reseta a data de pareamento original.
func (s *SaaSContractService) Set(baseURL, instanceID, token string) error {
	if !cryptobox.IsConfigured() {
		return cryptobox.ErrNotConfigured
	}
	enc, err := cryptobox.Encrypt(token)
	if err != nil {
		return err
	}

	now := time.Now()
	db := s.db.Session(&gorm.Session{NewDB: true})

	var policy models.InstancePolicy
	err = db.First(&policy).Error
	switch {
	case err == nil:
		policy.SaasBaseURL = &baseURL
		policy.SaasInstanceID = &instanceID
		policy.SaasInternalTokenEnc = &enc
		if policy.PairedAt == nil {
			policy.PairedAt = &now
		}
		return db.Save(&policy).Error
	case errors.Is(err, gorm.ErrRecordNotFound):
		policy = models.InstancePolicy{
			// MarketplaceMode é not null sem default (schema legado do ADR
			// 0026) — uma instância pareando pela primeira vez, sem nunca ter
			// gravado política de marketplace, precisa de um valor válido
			// aqui. "catalog_visible" é o mesmo fallback que
			// marketplaceModeFromEnv() já assume quando SAAS_INTERNAL_TOKEN
			// está setado — mantém o comportamento idêntico ao caminho de env.
			MarketplaceMode:      "catalog_visible",
			SaasBaseURL:          &baseURL,
			SaasInstanceID:       &instanceID,
			SaasInternalTokenEnc: &enc,
			PairedAt:             &now,
		}
		return db.Create(&policy).Error
	default:
		return err
	}
}

// Token é uma leitura estreita usada por middleware.SaaSTokenCache: devolve
// o token interno atual e se a instância está pareada. "não pareada" é
// reportado como ok=false, err=nil — estado esperado, não falha.
func (s *SaaSContractService) Token() (token string, ok bool, err error) {
	contract, err := s.Get()
	if errors.Is(err, ErrSaaSContractNotConfigured) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return contract.InternalToken, contract.Paired(), nil
}

// TouchSync atualiza só lastSyncAt, sem tocar no token — usado pelo worker
// de sync (Onda C) a cada troca bem-sucedida com o Watink SaaS.
func (s *SaaSContractService) TouchSync() error {
	now := time.Now()
	db := s.db.Session(&gorm.Session{NewDB: true})

	var policy models.InstancePolicy
	if err := db.First(&policy).Error; err != nil {
		return err
	}
	policy.LastSyncAt = &now
	return db.Save(&policy).Error
}
