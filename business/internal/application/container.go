package application

import (
	"log"

	"github.com/alltomatos/watinkdev/business/internal/application/usecases"
	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/infrastructure/izapia"
	"github.com/alltomatos/watinkdev/business/internal/infrastructure/repository"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"gorm.io/gorm"
)

type Container struct {
	DB                 *gorm.DB
	TicketRepo         domain.TicketRepository
	MessageRepo        domain.MessageRepository
	ContactRepo        domain.ContactRepository
	QueueRepo          domain.QueueRepository
	UserRepo           domain.UserRepository
	ChannelSessionRepo domain.ChannelSessionRepository
	PermissionRepo     domain.PermissionRepository
	SettingRepo        domain.SettingRepository
	SystemRepo         domain.SystemRepository
	PlanLimitSvc       domain.PlanLimitServiceInterface
	SwaggerPermRepo    domain.SwaggerPermissionRepository
	VersionRepo        domain.VersionRepository
	EventBus           domain.EventBus
	RedisSvc           domain.RedisService
	Broadcast          domain.Broadcaster
	SessionService     *services.WhatsAppSessionService
	IzapiaProvider     *izapia.Provider
	SSEHub             *services.SSEHub
	ReceiveMessage     *usecases.ReceiveMessageUseCase
	DistributeTicket   *usecases.DistributeTicketUseCase
	UpdateTicket       *usecases.UpdateTicketUseCase
	LogTicketAction    *usecases.LogTicketActionUseCase
}

func NewContainer(db *gorm.DB, redisSvc domain.RedisService, broadcast domain.Broadcaster, publisher domain.CommandPublisher, hub ...*services.SSEHub) *Container {
	if db == nil {
		log.Fatal("NewContainer: db is required — pass a valid *gorm.DB instance")
	}
	ticketRepo := repository.NewGORMTicketRepo(db)
	messageRepo := repository.NewGORMMessageRepo(db)
	contactRepo := repository.NewGORMContactRepo(db)
	queueRepo := repository.NewGORMQueueRepo(db)
	userRepo := repository.NewGORMUserRepo(db)
	sessionRepo := repository.NewGORMChannelSessionRepo(db)
	permissionRepo := repository.NewGORMPermissionRepo(db)
	settingRepo := repository.NewGORMSettingRepo(db)
	systemRepo := repository.NewGORMSystemRepo(db)
	planLimitSvc := services.NewPlanLimitService(db)
	swaggerPermRepo := repository.NewGORMSwaggerPermissionRepo(db)
	versionRepo := repository.NewGORMVersionRepo(db)
	userQueueRepo := repository.NewGormUserQueueRepository(db)
	ticketLogRepo := repository.NewGormTicketLogRepository(db)
	tagRepo := repository.NewGORMTagRepository(db)
	entityTagRepo := repository.NewGORMEntityTagRepository(db)
	eventBus := NewInMemoryEventBus()
	logTicketAction := usecases.NewLogTicketActionUseCase(ticketRepo, ticketLogRepo)
	distributeTicket := usecases.NewDistributeTicketUseCase(ticketRepo, queueRepo, eventBus, contactRepo, userQueueRepo)
	updateTicket := usecases.NewUpdateTicketUseCase(ticketRepo, eventBus, distributeTicket, logTicketAction)
	receiveMessage := usecases.NewReceiveMessageUseCase(eventBus, messageRepo, contactRepo, ticketRepo, queueRepo, tagRepo, entityTagRepo)
	izapiaProvider := izapia.New(db, broadcast)
	sessionService := services.NewWhatsAppSessionService(db, publisher, redisSvc, broadcast, map[string]domain.WhatsAppEngine{
		"izapia": izapiaProvider,
	})
	var sseHub *services.SSEHub
	if len(hub) > 0 && hub[0] != nil {
		sseHub = hub[0]
	} else {
		sseHub = services.NewSSEHub()
	}
	return &Container{
		DB:                 db,
		TicketRepo:         ticketRepo,
		MessageRepo:        messageRepo,
		ContactRepo:        contactRepo,
		QueueRepo:          queueRepo,
		UserRepo:           userRepo,
		ChannelSessionRepo: sessionRepo,
		PermissionRepo:     permissionRepo,
		SettingRepo:        settingRepo,
		SystemRepo:         systemRepo,
		PlanLimitSvc:       planLimitSvc,
		SwaggerPermRepo:    swaggerPermRepo,
		VersionRepo:        versionRepo,
		EventBus:           eventBus,
		RedisSvc:           redisSvc,
		Broadcast:          broadcast,
		SessionService:     sessionService,
		IzapiaProvider:     izapiaProvider,
		SSEHub:             sseHub,
		ReceiveMessage:     receiveMessage,
		DistributeTicket:   distributeTicket,
		UpdateTicket:       updateTicket,
		LogTicketAction:    logTicketAction,
	}
}
