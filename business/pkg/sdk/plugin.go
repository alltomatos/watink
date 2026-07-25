package sdk

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PluginStatus defines the current state of a plugin license
type PluginStatus string

const (
	StatusActive   PluginStatus = "active"
	StatusBlocked  PluginStatus = "blocked"
	StatusReadOnly PluginStatus = "readonly"
)

// PluginManifest defines the metadata and requirements of a plugin
type PluginManifest struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Type        string `json:"type"` // "free" | "premium"
}

// WatinkCore defines the interface for plugins to interact with the core system
type WatinkCore interface {
	GetDB() *gorm.DB
	// RegisterRoute mounts an authenticated, tenant-scoped, license-gated route
	// (ADR 0024) — the handler runs after IsAuth/TenantMiddleware, so
	// auth.TenantUUIDFromContext/auth.GetScoped work inside it.
	RegisterRoute(method string, path string, handler gin.HandlerFunc)
	// RegisterPublicRoute mounts a route with NO authentication and NO license
	// gating (the caller has no session — tenant, if any, is only known once
	// the handler resolves it from the request itself, e.g. a public share
	// token). Use only for surfaces meant to work without login.
	RegisterPublicRoute(method string, path string, handler gin.HandlerFunc)
	EmitSocketEvent(room string, event string, payload interface{})
	GetStatus() PluginStatus
	// SendTicketMessage sends an outbound WhatsApp text message through the
	// ticket's session — same pipeline as POST /messages/:ticketId (publishes
	// to engine-go, persists the Message, emits real-time events). Returns an
	// error if the ticket doesn't belong to tenantID or has no contact.
	SendTicketMessage(tenantID uuid.UUID, ticketID int, body string) error
}

// WatinkPlugin is the interface that every backend plugin must implement
type WatinkPlugin interface {
	GetManifest() PluginManifest
	OnInstall(core WatinkCore) error
	OnActivate(core WatinkCore) error
	OnDeactivate(core WatinkCore) error
}
