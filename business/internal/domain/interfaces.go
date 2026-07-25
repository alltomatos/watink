package domain

import (
	"context"
	"errors"
	"io"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
)

// ErrTicketNotFound is returned when a ticket lookup yields no result.
var ErrTicketNotFound = errors.New("ticket not found")

// QueueMetrics represents RabbitMQ queue monitoring data.
type QueueMetrics struct {
	Name           string `json:"name"`
	Messages       int    `json:"messages"`
	Consumers      int    `json:"consumers"`
	Ready          int    `json:"ready"`
	Unacknowledged int    `json:"unacknowledged"`
	Vhost          string `json:"vhost,omitempty"`
	State          string `json:"state,omitempty"`
	Error          string `json:"error,omitempty"`
}

// Increment is a sentinel value for a repository Update fields map: it requests
// an ATOMIC SQL increment (column = column + By) instead of an absolute
// assignment, avoiding lost updates when concurrent writers touch the same row
// (e.g. unreadMessages across multiple business instances). Keeps the
// application layer free of persistence (GORM) details.
type Increment struct{ By int }

// Repository Interfaces

type TicketRepository interface {
	FindByID(ctx context.Context, id int, tenantID uuid.UUID) (*Ticket, error)
	FindOpenByContact(ctx context.Context, tenantID uuid.UUID, contactID int, sessionID int) (*Ticket, error)
	FindOrCreatePending(ctx context.Context, ticket *Ticket) (*Ticket, error)
	Save(ctx context.Context, ticket *Ticket) error
	Update(ctx context.Context, ticket *Ticket, fields map[string]interface{}) error
	FindLastAssignedInQueue(ctx context.Context, queueID int, tenantID uuid.UUID) (int, error)
	CountOpenTicketsPerUser(ctx context.Context, userIDs []int, tenantID uuid.UUID) (map[int]int64, error)
}

type MessageRepository interface {
	Create(ctx context.Context, msg *Message) error
	CreateIfNotExists(ctx context.Context, msg *Message) error
	FindByID(ctx context.Context, id string, tenantID uuid.UUID) (*Message, error)
	FindOldestByTicket(ctx context.Context, ticketID int, tenantID uuid.UUID) (*Message, error)
	ExistsByID(ctx context.Context, id string, tenantID uuid.UUID) (bool, error)
	Update(ctx context.Context, msg *Message, fields map[string]interface{}) error
}

type ContactRepository interface {
	FindByNumber(ctx context.Context, tenantID uuid.UUID, number string, isGroup bool) (*Contact, error)
	FindByID(ctx context.Context, id int, tenantID uuid.UUID) (*Contact, error)
	Find(ctx context.Context, tenantID uuid.UUID, search string) ([]Contact, error)
	Create(ctx context.Context, contact *Contact) error
	Update(ctx context.Context, contact *Contact, fields map[string]interface{}) error
	Delete(ctx context.Context, id int, tenantID uuid.UUID) error
	FindOrCreate(ctx context.Context, tenantID uuid.UUID, number string, pushName string, profilePicUrl string, isGroup bool, isLID bool, from string) (*Contact, error)
}

type UserRepository interface {
	FindByID(ctx context.Context, id int, tenantID uuid.UUID) (*User, error)
	FindByIDDetail(ctx context.Context, id int, tenantID uuid.UUID) (*models.User, error)
	FindByEmail(ctx context.Context, email string, tenantID uuid.UUID) (*User, error)
	FindByEmailForAuth(ctx context.Context, email string) (*User, error)
	FindAll(ctx context.Context, tenantID uuid.UUID) ([]User, error)
	Create(ctx context.Context, user *User) error
	Update(ctx context.Context, user *User, fields map[string]interface{}) error
	Delete(ctx context.Context, id int, tenantID uuid.UUID) error
	Save(ctx context.Context, user *User) error
}

type QueueRepository interface {
	FindByID(ctx context.Context, id int, tenantID uuid.UUID) (*Queue, error)
	FindAll(ctx context.Context, tenantID uuid.UUID) ([]Queue, error)
	Save(ctx context.Context, queue *Queue) error
	// FindQueueIDsByChannel returns the queue IDs linked to a WhatsApp channel
	// (via the whatsapp_queues join table), scoped to the tenant.
	FindQueueIDsByChannel(ctx context.Context, channelID int, tenantID uuid.UUID) ([]int, error)
}

type ChannelSessionRepository interface {
	FindByID(ctx context.Context, id int, tenantID uuid.UUID) (*ChannelSession, error)
	FindByIDDetail(ctx context.Context, id int, tenantID uuid.UUID) (*models.Whatsapp, error)
	FindAll(ctx context.Context, tenantID uuid.UUID) ([]ChannelSession, error)
	Create(ctx context.Context, session *ChannelSession) error
	Update(ctx context.Context, session *ChannelSession, fields map[string]interface{}) error
	Delete(ctx context.Context, id int, tenantID uuid.UUID) error
	ResetDefaultFlag(ctx context.Context, tenantID uuid.UUID) error
	DeleteWithRelations(ctx context.Context, id int, tenantID uuid.UUID) error
}

// Channel Adapter Interface
type ChannelAdapter interface {
	SendMessage(ctx context.Context, ticket Ticket, message Message) error
	StartSession(ctx context.Context, session ChannelSession) error
	StopSession(ctx context.Context, sessionID int) error
	DeleteSession(ctx context.Context, sessionID int) error
}

// EventBus Interface
type EventBus interface {
	Publish(ctx context.Context, event DomainEvent) error
	Subscribe(eventName string, handler EventHandler) error
}

type EventHandler func(ctx context.Context, event DomainEvent) error

// CommandPublisher defines the contract for sending messages to Engine Go.
type CommandPublisher interface {
	PublishCommand(routingKey string, payload interface{}) error
}

// KnowledgeJobPublisher publica jobs de ingestão para o watink-knowledge.
type KnowledgeJobPublisher interface {
	PublishKnowledgeJob(routingKey string, payload interface{}) error
}

// ObjectStore persiste/recupera arquivos de fontes (S3-compatível).
type ObjectStore interface {
	Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) error
	// Describe returns the non-sensitive store configuration (no credentials).
	Describe() map[string]any
}

// EventConsumer defines the contract for listening to events.
type EventConsumer interface {
	ConsumeEvents(queueName string, routingKeys []string, handler func(body []byte) error) error
}

// QueueMonitor defines the contract for system monitoring.
type QueueMonitor interface {
	IsConnected() bool
	ListAllQueues() ([]QueueMetrics, error)
}

// TenantConsumption is a read-model for cross-tenant system stats (superadmin only).
type TenantConsumption struct {
	TenantID    string `json:"tenantId"`
	TenantName  string `json:"tenantName"`
	Users       int64  `json:"users"`
	Contacts    int64  `json:"contacts"`
	Tickets     int64  `json:"tickets"`
	OpenTickets int64  `json:"openTickets"`
	Whatsapps   int64  `json:"whatsapps"`
}

// SystemRepository defines the contract for cross-tenant system monitoring queries.
type SystemRepository interface {
	GetTenantConsumption(ctx context.Context) ([]TenantConsumption, error)
}

// SettingRepository defines the contract for setting operations.
type SettingRepository interface {
	// FindPublicSettings returns branding settings for the first tenant (used on login page, no auth).
	FindPublicSettings(ctx context.Context, keys []string) ([]models.Setting, error)
}

// PermissionRepository defines the contract for global (tenant-agnostic) permission catalog.
type PermissionRepository interface {
	FindAll(ctx context.Context) ([]models.Permission, error)
	FindByIDs(ctx context.Context, ids []int) ([]models.Permission, error)
}

// SwaggerPermissionRepository checks whether a user has access to API docs.
type SwaggerPermissionRepository interface {
	HasSwaggerPermission(userID int, tenantID uuid.UUID) (bool, error)
}

// VersionRepository provides infrastructure version diagnostics.
type VersionRepository interface {
	GetPostgresVersion(ctx context.Context) (string, error)
}

// UserQueueRepository handles user↔queue membership queries.
type UserQueueRepository interface {
	IsUserInQueue(ctx context.Context, userID int, queueID int) (bool, error)
	FindQueueUsers(ctx context.Context, queueID int, tenantID uuid.UUID) ([]User, error)
}

// TicketLogRepository persists audit log entries for ticket actions.
type TicketLogRepository interface {
	Create(ctx context.Context, log *models.TicketLog) error
}

// TagRepository handles tag lookups and creation.
type TagRepository interface {
	FindOrCreateByName(ctx context.Context, tenantID uuid.UUID, name string) (*models.Tag, error)
}

// EntityTagRepository handles the generic many-to-many tag links.
type EntityTagRepository interface {
	AddIfAbsent(ctx context.Context, entityType string, entityID int, tagID int, tenantID uuid.UUID) error
}

// Service Interfaces

// TenantSeedData holds the data required to bootstrap the first tenant.
type TenantSeedData struct {
	CompanyName string
	FirstName   string
	LastName    string
	Email       string
	Password    string
	Document    string
	BackendURL  string
}

// SetupServiceInterface defines the contract for tenant initialization.
type SetupServiceInterface interface {
	NeedsSetup(ctx context.Context) (bool, error)
	InitializeTenant(data TenantSeedData) error
}

// ProvisionPlanSpec is the plan snapshot pushed by the Watink SaaS control plane
// when provisioning a tenant (rota interna POST /internal/saas/tenants). The core
// faz upsert do Plan por `Name` (padrão ADR 0009) e associa a assinatura a ele.
type ProvisionPlanSpec struct {
	Name             string
	UsersLimit       int
	ConnectionsLimit int
	QueuesLimit      int
	PluginQuota      int
	Price            float64
	Active           bool
}

// ProvisionResult é o retorno do provisionamento interno: o id do tenant e o id
// do usuário dono recém-criados, consumidos pelo Watink SaaS para reconciliar o
// snapshot local (coreTenantId, ownerUserId).
type ProvisionResult struct {
	TenantID    string
	OwnerUserID int
}

// PlanLimitServiceInterface defines the contract for plan/resource limit checks.
type PlanLimitServiceInterface interface {
	CheckLimit(tenantID uuid.UUID, resource string) error
}

// WhatsAppSessionServiceInterface defines the contract for WhatsApp session lifecycle.
type WhatsAppSessionServiceInterface interface {
	StartWhatsAppSession(whatsapp interface{}, usePairingCode bool, phoneNumber string, force bool) error
	StopWhatsAppSession(whatsapp interface{}) error
	DeleteWhatsAppSession(whatsapp interface{}) error
}
