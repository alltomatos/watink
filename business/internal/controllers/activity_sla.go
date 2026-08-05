package controllers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// activitySLASettingKey/activityStaleSettingKey são as chaves de Setting
// lidas de verdade pelo backend — ao contrário de helpdesk_sla_config
// (escrita pelo frontend, nunca lida por helpdesk_kanban.go, que hardcoda um
// threshold fixo de 24h ignorando priority). Ver ADR 0029.
const (
	activitySLASettingKey   = "activities_sla_config"
	activityStaleSettingKey = "activities_stale_threshold_minutes"
)

// ActivitySLAConfig é o shape persistido em Setting — minutos por
// prioridade, mesmo formato de SlaConfig no Helpdesk
// (Settings/hooks/useSettings.ts), reaproveitado deliberadamente.
type ActivitySLAConfig struct {
	Low    int `json:"low"`
	Medium int `json:"medium"`
	High   int `json:"high"`
	Urgent int `json:"urgent"`
}

// defaultActivitySLAConfig — falta de configuração NUNCA bloqueia a criação
// de uma Activity (activities.md §SLA): urgent=2h, high=8h, medium=24h,
// low=72h.
func defaultActivitySLAConfig() ActivitySLAConfig {
	return ActivitySLAConfig{Low: 4320, Medium: 1440, High: 480, Urgent: 120}
}

const defaultActivityStaleThresholdMinutes = 60

// minutesFor devolve o teto em minutos da prioridade informada, caindo no
// default de "medium" para um valor de priority desconhecido — nunca zero,
// que congelaria o SLA no passado.
func (cfg ActivitySLAConfig) minutesFor(priority string) int {
	switch priority {
	case "low":
		return cfg.Low
	case "high":
		return cfg.High
	case "urgent":
		return cfg.Urgent
	default:
		return cfg.Medium
	}
}

// CalculateSLADueAt é o ÚNICO ponto de verdade do cálculo de slaDueAt para
// chamadas HTTP — consumido pelo CRUD (POST /activities, PUT /activities/:id)
// e pelos KPIs. Nunca reimplementar este cálculo em outro lugar dentro deste
// pacote. A ÚNICA exceção documentada é internal/plugins/manager.go
// (coreImpl.CreateActivity, sdk.WatinkCoreActivities) — duplica esta função
// porque internal/plugins não pode importar internal/controllers (ciclo: este
// pacote já importa internal/plugins). Ver ADR 0029, addendum "Fase 1", e
// plugins.TestCreateActivitySLAParity para o teste que evita as duas cópias
// divergirem em silêncio.
func CalculateSLADueAt(cfg ActivitySLAConfig, priority string, from time.Time) *time.Time {
	due := from.Add(time.Duration(cfg.minutesFor(priority)) * time.Minute)
	return &due
}

// loadActivitySLAConfig lê activities_sla_config do tenant; ausência ou JSON
// inválido cai no default — nunca erro, nunca bloqueia o caller.
//
// Session(NewDB:true) é obrigatório aqui: quem chama (GetSLAConfig) reusa o
// mesmo db de auth.GetScoped para esta leitura E para
// loadActivityStaleThresholdMinutes logo em seguida — sem uma sessão nova
// por chamada, o Where(key=...) desta função "vaza" para a próxima e as
// duas condições se acumulam (key=A AND key=B), que não casa nenhuma linha
// e faz a segunda leitura cair sempre no default silenciosamente.
func loadActivitySLAConfig(db *gorm.DB, tenantID uuid.UUID) ActivitySLAConfig {
	var setting models.Setting
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`key = ? AND "tenantId" = ?`, activitySLASettingKey, tenantID).First(&setting).Error; err != nil {
		return defaultActivitySLAConfig()
	}
	var cfg ActivitySLAConfig
	if err := json.Unmarshal([]byte(setting.Value), &cfg); err != nil {
		return defaultActivitySLAConfig()
	}
	return cfg
}

// loadActivityStaleThresholdMinutes lê activities_stale_threshold_minutes do
// tenant; ausência ou valor inválido cai no default de 60. Ver o comentário
// de loadActivitySLAConfig sobre por que Session(NewDB:true) é obrigatório.
func loadActivityStaleThresholdMinutes(db *gorm.DB, tenantID uuid.UUID) int {
	var setting models.Setting
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`key = ? AND "tenantId" = ?`, activityStaleSettingKey, tenantID).First(&setting).Error; err != nil {
		return defaultActivityStaleThresholdMinutes
	}
	var minutes int
	if err := json.Unmarshal([]byte(setting.Value), &minutes); err != nil || minutes <= 0 {
		return defaultActivityStaleThresholdMinutes
	}
	return minutes
}

type activitySLAConfigResponse struct {
	SlaConfig             ActivitySLAConfig `json:"slaConfig"`
	StaleThresholdMinutes int               `json:"staleThresholdMinutes"`
}

// GetSLAConfig — GET /activities/sla-config
// @Summary      Obter configuração de SLA das Atividades
// @Tags         activities
// @Produce      json
// @Success      200  {object}  activitySLAConfigResponse
// @Security     BearerAuth
// @Router       /activities/sla-config [get]
func (ac *ActivityController) GetSLAConfig(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}

	c.JSON(http.StatusOK, activitySLAConfigResponse{
		SlaConfig:             loadActivitySLAConfig(db, tenantID),
		StaleThresholdMinutes: loadActivityStaleThresholdMinutes(db, tenantID),
	})
}

type updateActivitySLAConfigRequest struct {
	SlaConfig             ActivitySLAConfig `json:"slaConfig" binding:"required"`
	StaleThresholdMinutes int               `json:"staleThresholdMinutes" binding:"required,min=1"`
}

// UpdateSLAConfig — PUT /activities/sla-config. Rota dedicada por
// ergonomia — NÃO é a fronteira de segurança real (PUT /settings/:key
// genérica não tem RequirePermission; ver ADR 0029).
// @Summary      Atualizar configuração de SLA das Atividades
// @Tags         activities
// @Accept       json
// @Produce      json
// @Param        body  body  updateActivitySLAConfigRequest  true  "Configuração de SLA"
// @Success      200  {object}  activitySLAConfigResponse
// @Security     BearerAuth
// @Router       /activities/sla-config [put]
func (ac *ActivityController) UpdateSLAConfig(c *gin.Context) {
	db, tenantID, ok := auth.GetScoped(c, "Activities")
	if !ok {
		return
	}

	var req updateActivitySLAConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	slaJSON, err := json.Marshal(req.SlaConfig)
	if err != nil {
		utils.RespondWithInternalError(c, err, "UpdateSLAConfig-MarshalSla")
		return
	}
	staleJSON, err := json.Marshal(req.StaleThresholdMinutes)
	if err != nil {
		utils.RespondWithInternalError(c, err, "UpdateSLAConfig-MarshalStale")
		return
	}

	// Session(NewDB:true) NOVA por operação — reusar o mesmo handle entre as
	// duas escritas (mesmo já com NewDB:true aplicado uma vez) acumula
	// condições do Where anterior e faz a segunda FirstOrCreate casar/gravar
	// a linha errada. Já foi pego por teste (tenant isolation ok, mas o
	// staleThreshold voltava sempre o default).
	slaSetting := models.Setting{Key: activitySLASettingKey, TenantID: tenantID, Value: string(slaJSON)}
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`key = ? AND "tenantId" = ?`, activitySLASettingKey, tenantID).
		Assign(models.Setting{Value: string(slaJSON)}).FirstOrCreate(&slaSetting).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateSLAConfig-SaveSla")
		return
	}

	staleSetting := models.Setting{Key: activityStaleSettingKey, TenantID: tenantID, Value: string(staleJSON)}
	if err := db.Session(&gorm.Session{NewDB: true}).
		Where(`key = ? AND "tenantId" = ?`, activityStaleSettingKey, tenantID).
		Assign(models.Setting{Value: string(staleJSON)}).FirstOrCreate(&staleSetting).Error; err != nil {
		utils.RespondWithInternalError(c, err, "UpdateSLAConfig-SaveStale")
		return
	}

	c.JSON(http.StatusOK, activitySLAConfigResponse(req))
}
