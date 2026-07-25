// @title           Watink Business API
// @version         2.0.0
// @description     API do backend Go — atendimento e automação WhatsApp.
// @termsOfService  https://watink.com.br/terms

// @contact.name   Watink Dev
// @contact.email  dev@watink.com.br

// @license.name  Proprietary
// @license.url   https://watink.com.br

// @host      localhost:8082
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Bearer JWT token. Formato: "Bearer <token>"

package main

import (
	"context"
	"io/fs"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	_ "github.com/alltomatos/watinkdev/business/docs"
	"github.com/alltomatos/watinkdev/business/internal/application"
	"github.com/alltomatos/watinkdev/business/internal/controllers"
	"github.com/alltomatos/watinkdev/business/internal/database"
	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/flow"
	"github.com/alltomatos/watinkdev/business/internal/middleware"
	"github.com/alltomatos/watinkdev/business/internal/routes"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/internal/web"
	"github.com/alltomatos/watinkdev/business/pkg/s3store"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	otelgin "go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

var (
	GitCommit = "unknown" // setado via -ldflags no build
	GitBranch = "unknown" // setado via -ldflags no build
)

func main() {
	_ = godotenv.Load()

	shutdown, err := services.InitTelemetry(context.Background())
	if err != nil {
		log.Printf("Warning: OTel init failed: %v", err)
	} else {
		defer shutdown(context.Background())
	}

	log.Println("Watink Business starting...")
	database.Connect()
	database.Migrate()

	// Instanciação explícita — Injeção via construtor (DI Pura)
	redisSvc, err := services.NewRedisServiceFromEnv()
	if err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(otelgin.Middleware("watink-business"))
	r.Use(middleware.ObservabilityMiddleware())
	r.Use(middleware.CORSMiddleware())

	// Build the single SSEHub first so both the SSEController (registration) and
	// the SSEBroadcast (delivery) share the exact same instance.
	hub := services.NewSSEHub()
	hub.StartHeartbeat(10 * time.Second)
	sseBroadcast := services.NewSSEBroadcast(hub)
	redisBroadcast := services.NewRedisBroadcast(redisSvc, sseBroadcast)
	redisBroadcast.Start()
	var broadcast domain.Broadcaster = redisBroadcast
	log.Println("Real-time backend: SSE")

	rabbitMQ := services.NewRabbitMQProvider(os.Getenv("AMQP_URL"))
	// Pass hub so the container uses the same SSEHub — avoids a second instance.
	container := application.NewContainer(database.DB, redisSvc, broadcast, rabbitMQ, hub)

	// FlowBuilder FASE 1: build the outbound channel registry via DI and register
	// the WhatsApp adapter (dedup + PublishCommand). The interpreter resolves
	// adapters from this registry — never whatsmeow directly (ADR 0014).
	channelRegistry := flow.NewChannelRegistry()
	channelRegistry.Register(flow.NewWhatsAppAdapter(rabbitMQ, redisSvc))

	if err := rabbitMQ.Connect(); err == nil {
		// FlowBuilder FASE 1: the inbound seam is plugged into the EventListener
		// (NewEventListener wires flow.NewSkeleton with the interpreter+registry),
		// replacing the two previously-dead workers. No separate AMQP flow worker.
		eventListener := services.NewEventListener(container.ChannelSessionRepo, container.MessageRepo, container.ContactRepo, container.TicketRepo, container.ReceiveMessage, broadcast, database.DB, channelRegistry, redisSvc)
		services.StartEventListener(rabbitMQ, eventListener)

		// Knowledge Base RAG: consume ingestion status events from
		// watink-knowledge (knowledge.events) and reflect them onto the source
		// rows + broadcast to the tenant.
		knowledgeStatus := services.NewKnowledgeStatusListener(container.DB, container.Broadcast)
		if err := knowledgeStatus.Start(rabbitMQ); err != nil {
			log.Printf("[knowledge] status listener: %v", err)
		}
	} else {
		log.Printf("⚠️ Warning: RabbitMQ connection failed: %v", err)
	}

	r.Static("/public/media", "public/media")

	// SSE stream — registrado SEM gin.Logger para evitar que o token JWT
	// presente na query string (?token=...) apareça no access-log.
	sseController := controllers.NewSSEController(container.SSEHub, redisSvc)
	r.GET("/api/v1/events", sseController.Stream)

	apiGroup := r.Group("/api/v1")
	apiGroup.Use(gin.Logger())
	{
		apiGroup.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "OK", "service": "watink-business"})
		})

		apiGroup.GET("/about", func(c *gin.Context) {
			version := "dev"
			if m := regexp.MustCompile(`## (v[0-9][^\s]*)`).FindStringSubmatch(web.ChangelogMD); m != nil {
				version = m[1]
			}

			dbVersion := "unknown"
			if err := database.DB.Raw("SHOW server_version").Scan(&dbVersion).Error; err != nil {
				dbVersion = "unknown"
			}

			c.JSON(200, gin.H{
				"version": version,
				"commit":  GitCommit,
				"branch":  GitBranch,
				"database": gin.H{
					"engine":  "PostgreSQL",
					"version": dbVersion,
				},
				"changelog": web.ChangelogMD,
			})
		})

		// Knowledge Base file sources: build the S3-compatible object store from
		// env. When S3 is unconfigured or init fails, s3Store stays nil and the
		// file-source path responds with a clear error (never panics).
		var s3Store domain.ObjectStore
		if s3cfg, ok := s3store.ConfigFromEnv(); ok {
			if st, err := s3store.New(s3cfg); err != nil {
				log.Printf("⚠️ S3 store init failed: %v", err)
			} else {
				s3Store = st
			}
		}

		routes.SetupRoutes(apiGroup, rabbitMQ, container, s3Store)
	}

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "OK", "service": "watink-business"})
	})
	setupCtrl := controllers.NewSetupController(services.NewSetupService(database.DB))
	r.GET("/api/initial-setup/check", setupCtrl.CheckSetup)
	r.POST("/api/initial-setup", setupCtrl.InitialSetup)

	publicFS, _ := fs.Sub(web.StaticFiles, "build")

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		lowerPath := strings.ToLower(path)
		if strings.HasPrefix(lowerPath, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
			return
		}

		f, err := publicFS.Open(strings.TrimPrefix(path, "/"))
		if err == nil {
			f.Close()
			if strings.HasPrefix(path, "/assets/") {
				c.Header("Cache-Control", "public, max-age=31536000, immutable")
			}
			http.FileServer(http.FS(publicFS)).ServeHTTP(c.Writer, c.Request)
			return
		}

		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0")
		index, err := fs.ReadFile(publicFS, "index.html")
		if err != nil {
			c.String(http.StatusInternalServerError, "Index not found")
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", index)
	})

	port := os.Getenv("PORT_GO")
	if port == "" {
		port = "8082"
	}

	log.Printf("✅ Watink Business Ready on port %s", port)
	s := &http.Server{Addr: ":" + port, Handler: r}
	_ = s.ListenAndServe()
}
