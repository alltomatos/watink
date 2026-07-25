package testutil

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// NewTestDB creates an isolated PostgreSQL schema for one test and returns a *gorm.DB scoped to it.
// All production models are auto-migrated. The schema is dropped via t.Cleanup.
func NewTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := testDSN()
	cfg := &gorm.Config{
		Logger:                                   logger.Discard,
		DisableForeignKeyConstraintWhenMigrating: true,
	}

	// Root connection — used only to create/drop the schema.
	root, err := gorm.Open(postgres.Open(dsn), cfg)
	if err != nil {
		t.Fatalf("testutil.NewTestDB: connect: %v", err)
	}
	defer func() {
		if sqlDB, err := root.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}()

	schema := "test_" + strings.ReplaceAll(uuid.New().String(), "-", "")[:12]

	if err := root.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatalf("testutil.NewTestDB: create schema %q: %v", schema, err)
	}

	// Embed search_path in DSN so every pool connection uses the schema automatically.
	// This allows MaxOpenConns > 1, preventing deadlocks in GORM many2many operations.
	var schemaDSN string
	if strings.Contains(dsn, "?") {
		schemaDSN = dsn + "&search_path=" + schema
	} else {
		schemaDSN = dsn + "?search_path=" + schema
	}

	db, err := gorm.Open(postgres.Open(schemaDSN), cfg)
	if err != nil {
		t.Fatalf("testutil.NewTestDB: connect for schema: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("testutil.NewTestDB: get sql.DB: %v", err)
	}

	if err := db.AutoMigrate(allModels()...); err != nil {
		t.Fatalf("testutil.NewTestDB: AutoMigrate: %v", err)
	}

	// PluginInstallations now has a real GORM model (models.PluginInstallation,
	// ADR 0024) migrated via allModels() above — no more manual CREATE TABLE
	// fixup needed here.

	t.Cleanup(func() {
		_ = sqlDB.Close()

		clean, _ := gorm.Open(postgres.Open(dsn), cfg)
		clean.Exec("DROP SCHEMA " + schema + " CASCADE")
		if cleanSQL, err := clean.DB(); err == nil {
			_ = cleanSQL.Close()
		}
	})

	return db
}

func testDSN() string {
	if dsn := os.Getenv("TEST_DATABASE_URL"); dsn != "" {
		return dsn
	}
	host := envOr("DB_HOST", "localhost")
	port := envOr("DB_PORT", "5432")
	user := envOr("DB_USER", "postgres")
	pass := envOr("DB_PASS", "watink_secret_pass")
	name := envOr("DB_NAME", "watink")
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, pass, host, port, name)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func allModels() []interface{} {
	return []interface{}{
		&models.Plan{},
		&models.Tenant{},
		&models.TenantSubscription{},
		&models.User{},
		&models.Setting{},
		&models.Contact{},
		&models.Client{},
		&models.ClientAddress{},
		&models.Deal{},
		&models.Protocol{},
		&models.ProtocolLog{},
		&models.ProtocolAttachment{},
		&models.Whatsapp{},
		&models.Queue{},
		&models.Ticket{},
		&models.Message{},
		&models.Setor{},
		&models.Cargo{},
		&models.Permission{},
		&models.CargoPermissao{},
		&models.UserSetor{},
		&models.SetorFila{},
		&models.Flow{},
		&models.FlowRun{},
		&models.FlowRunLog{},
		&models.QuickAnswer{},
		&models.KnowledgeBase{},
		&models.KnowledgeBaseSource{},
		&models.Pipeline{},
		&models.PipelineStage{},
		&models.TagGroup{},
		&models.Tag{},
		&models.EntityTag{},
		&models.TicketLog{},
		&models.ConversationEmbedding{},
		&models.Proxy{},
		&models.ProxyGroup{},
		&models.ConnectionGroup{},
		&models.PluginInstallation{},
	}
}
