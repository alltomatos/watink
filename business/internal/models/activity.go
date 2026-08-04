package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Activity é a entidade core que modela execução de ordem de serviço em
// campo (ADR 0029) — checklist com evidência, materiais, ocorrências e
// assinatura do cliente. Não é recurso do plugin Helpdesk: ProtocolID/DealID
// são sempre nullable e opcionais, uma Activity existe de pé próprio.
// Cliente exibido é sempre resolvido por transitividade
// (Protocol.Contact.ClientID) — nunca desnormalizar ClientID aqui, mesmo
// princípio do ADR 0023.
type Activity struct {
	ID          int    `gorm:"primaryKey" json:"id"`
	Title       string `gorm:"not null" json:"title"`
	Description string `json:"description"`
	// Status: pending | in_progress | done | cancelled.
	Status string `gorm:"not null;default:'pending'" json:"status"`
	// Priority: low | medium | high | urgent — usada pela calculadora de SLA.
	Priority string `gorm:"not null;default:'medium'" json:"priority"`
	// ProtocolID/DealID são vínculos opcionais (Fase 1/2) — o plugin Helpdesk
	// ou o módulo Pipeline chamam o core para criar a Activity, nunca o
	// inverso.
	ProtocolID  *int       `gorm:"column:protocolId" json:"protocolId"`
	DealID      *int       `gorm:"column:dealId" json:"dealId"`
	ScheduledAt *time.Time `gorm:"column:scheduledAt" json:"scheduledAt"`
	StartedAt   *time.Time `gorm:"column:startedAt" json:"startedAt"`
	FinishedAt  *time.Time `gorm:"column:finishedAt" json:"finishedAt"`
	// LastActivityAt é atualizado a cada mutação em item/material/ocorrência
	// — base do alerta de "atividade parada" (staleSince).
	LastActivityAt time.Time `gorm:"column:lastActivityAt;not null" json:"lastActivityAt"`
	// SlaDueAt é calculado no create/start a partir de activities_sla_config
	// + priority, e congelado a partir de status=in_progress — nunca
	// recalculado silenciosamente depois que a atividade já está em
	// execução (evita a dívida do Helpdesk: helpdesk_kanban.go hardcoda um
	// threshold fixo de 24h e ignora priority).
	SlaDueAt *time.Time `gorm:"column:slaDueAt" json:"slaDueAt"`
	// ClientSignatureUrl/TechnicianSignatureUrl guardam a chave/URL do
	// objeto no S3 Storage Driver — nunca base64 gravado direto no banco.
	ClientSignatureUrl     string         `gorm:"column:clientSignatureUrl" json:"clientSignatureUrl,omitempty"`
	TechnicianSignatureUrl string         `gorm:"column:technicianSignatureUrl" json:"technicianSignatureUrl,omitempty"`
	TenantID               uuid.UUID      `gorm:"column:tenantId;type:uuid;not null" json:"tenantId"`
	CreatedAt              time.Time      `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt              time.Time      `gorm:"column:updatedAt" json:"updatedAt"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Protocol    *Protocol               `gorm:"foreignKey:ProtocolID" json:"protocol,omitempty"`
	Assignees   []ActivityAssignee      `gorm:"foreignKey:ActivityID" json:"assignees,omitempty"`
	Items       []ActivityChecklistItem `gorm:"foreignKey:ActivityID" json:"items,omitempty"`
	Materials   []ActivityMaterial      `gorm:"foreignKey:ActivityID" json:"materials,omitempty"`
	Occurrences []ActivityOccurrence    `gorm:"foreignKey:ActivityID" json:"occurrences,omitempty"`
}

func (Activity) TableName() string {
	return "Activities"
}
