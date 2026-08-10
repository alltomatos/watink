package domain

import (
	"context"
	"errors"
	"io"
	"time"

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
	BulkDelete(ctx context.Context, ids []int, tenantID uuid.UUID) (int64, error)
	DeleteAll(ctx context.Context, tenantID uuid.UUID) (int64, error)
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

// WhatsAppEngineResolver resolves the concrete domain.WhatsAppEngine for a
// connection by its EngineType. Implemented by WhatsAppSessionService — callers
// outside the session lifecycle (message send, FlowBuilder outbound) that need
// to pick the right engine depend on this narrow interface instead of the full
// session service.
type WhatsAppEngineResolver interface {
	EngineFor(w models.Whatsapp) (WhatsAppEngine, error)
}

// WhatsAppEngine is the port every WhatsApp connection provider must
// implement (whatsmeow via engine-go, izapia HTTP, ...). Selected per
// connection by Whatsapp.EngineType — see ADR pendente "izapia provider".
// Implementations own their own transport (AMQP vs HTTP); callers never
// branch on transport, only on which WhatsAppEngine was resolved.
type WhatsAppEngine interface {
	StartSession(ctx context.Context, w models.Whatsapp, usePairingCode bool, phoneNumber string, force bool) error
	StopSession(ctx context.Context, w models.Whatsapp) error
	DeleteSession(ctx context.Context, w models.Whatsapp) error
	// SendText/SendMedia return the EFFECTIVE message ID actually assigned to
	// the outbound message -- for engine-go (AMQP, whatsmeow) this always
	// equals the requested messageID (forced via SendRequestExtra on the
	// engine-go side), but izapia's HTTP API generates its own message_id
	// server-side and returns it in the response; callers that need the real
	// WhatsApp id for reply correlation (e.g. campaign send, issue: izapia
	// message id discarded) MUST use the returned value, never assume it
	// equals the requested messageID.
	SendText(ctx context.Context, w models.Whatsapp, to, messageID, body string) (string, error)
	SendMedia(ctx context.Context, w models.Whatsapp, to, messageID, mediaType, mediaURL, mimeType string) (string, error)
}

// InteractiveButton is an engine-neutral display button for an interactive
// (buttons/list) send. Kind mirrors the izapia enum (quick_reply|url|call|
// copy|list); "list" is special — it carries its own sub-menu in List instead
// of a single tap action, and at most one such button may appear per message.
type InteractiveButton struct {
	ID    string
	Kind  string // quick_reply | url | call | copy | list
	Label string
	Value string        // url / phone number / copy payload — unused for "list"
	List  []ListSection // only when Kind == "list"
}

type ListSection struct {
	Title string
	Rows  []ListRow
}

type ListRow struct {
	ID          string
	Title       string
	Description string
}

// CarouselCard is one card of a carousel send (image + optional title + up to
// 3 display buttons — no "list"/"copy"-payment kinds, per izapia's stricter
// carousel button subset).
type CarouselCard struct {
	ImageURL string
	Mimetype string
	Title    string
	Buttons  []InteractiveButton
}

// RichMessageRequest is the engine-neutral translation of a QuickAnswer
// (interactive_buttons/list/poll/carousel/pix) built by
// flow.BuildRichMessageRequest, consumed by RichMessageEngine
// implementations. Kind selects which of the type-specific fields is set.
type RichMessageRequest struct {
	Kind    string // "interactive" | "poll" | "carousel"
	Body    string
	Buttons []InteractiveButton // Kind == "interactive"

	PollQuestion        string // Kind == "poll"
	PollOptions         []string
	PollSelectableCount int

	Cards []CarouselCard // Kind == "carousel"
}

// RichMessageEngine is an OPTIONAL extension of WhatsAppEngine for engines
// that support interactive/poll/carousel sends beyond plain text/media
// (SendText/SendMedia). Callers type-assert a resolved WhatsAppEngine against
// this interface; an engine that doesn't implement it (e.g. the whatsmeow/
// engine-go one, which already handles these types through its own
// AMQP-shaped flow.BuildQuickAnswerCommand path) simply isn't asked.
type RichMessageEngine interface {
	// SendInteractive returns the EFFECTIVE message id (see WhatsAppEngine's
	// SendText/SendMedia doc comment for why this can differ from messageID).
	SendInteractive(ctx context.Context, w models.Whatsapp, to, messageID string, req RichMessageRequest) (string, error)
}

// PresenceEngine is an OPTIONAL extension of WhatsAppEngine for engines that
// can set the chat-composing indicator ("digitando..."). Same type-assertion
// pattern as RichMessageEngine — an engine without it (or a transient send
// error) is never fatal to the actual message send, which always proceeds
// regardless (see flow.WhatsAppAdapter humanPacing). State is "composing" or
// "paused".
type PresenceEngine interface {
	SendPresence(ctx context.Context, w models.Whatsapp, to, state string) error
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
	// Download retrieves a previously uploaded object — used by the ingestion
	// worker to read a source file's bytes for parsing. Caller must Close().
	Download(ctx context.Context, key string) (io.ReadCloser, error)
	// PresignedGetURL devolve uma URL temporária e assinada para leitura
	// direta do objeto (ex.: <img src=...>), sem expor credenciais nem exigir
	// header Authorization — usada pelo módulo Activities para servir fotos
	// de checklist (ADR 0029). TTL curto; nunca cachear a URL além dele.
	PresignedGetURL(ctx context.Context, key string, ttl time.Duration) (string, error)
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
	// PluginEntitlements é a lista de slugs de plugins `pro` concedidos por
	// este plano (eixo comercial, distinto de licença e de alocação).
	PluginEntitlements []string
	Price              float64
	Active             bool
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
