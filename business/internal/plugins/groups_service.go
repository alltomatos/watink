package plugins

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/sdk"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// groupsService is the plugin's business layer — resolves the connection's
// domain.GroupEngine and applies the shared rate limiter (invariant 4,
// plan §2.2: this is the limiter that actually covers BOTH providers,
// unlike the engine-go-side one which only sees enginego traffic).
type groupsService struct {
	db       *gorm.DB
	resolver domain.WhatsAppEngineResolver
	throttle *groupsThrottle
}

func newGroupsService(core sdk.WatinkCore, resolver domain.WhatsAppEngineResolver) *groupsService {
	return &groupsService{db: core.GetDB(), resolver: resolver, throttle: newGroupsThrottle()}
}

// resolveConnectionFromQuery is the GET-route entry point — whatsappId
// travels as a query string.
func (s *groupsService) resolveConnectionFromQuery(c *gin.Context, tenantID uuid.UUID) (models.Whatsapp, domain.GroupEngine, error) {
	raw := c.Query("whatsappId")
	whatsappID, err := strconv.Atoi(raw)
	if err != nil || whatsappID <= 0 {
		var zero models.Whatsapp
		return zero, nil, utils.NewFriendlyError(http.StatusBadRequest, "Parâmetro whatsappId é obrigatório.", fmt.Errorf("groups: whatsappId inválido na query: %q", raw))
	}
	return s.resolveConnection(c, tenantID, whatsappID)
}

// resolveConnection loads the tenant-scoped Whatsapp connection and
// resolves its domain.GroupEngine. Returns a *utils.FriendlyError (already
// the right HTTP shape) on any failure — including the 501 when the
// resolved WhatsAppEngine doesn't implement GroupEngine, per the plan's
// "devolve 501 claro" requirement.
func (s *groupsService) resolveConnection(c *gin.Context, tenantID uuid.UUID, whatsappID int) (models.Whatsapp, domain.GroupEngine, error) {
	var w models.Whatsapp
	if err := s.db.Where(`id = ? AND "tenantId" = ?`, whatsappID, tenantID).First(&w).Error; err != nil {
		return w, nil, utils.NewFriendlyError(http.StatusNotFound, "Conexão não encontrada.", fmt.Errorf("groups: conexão %d não encontrada para o tenant %s: %w", whatsappID, tenantID, err))
	}
	engine, err := s.resolver.EngineFor(w)
	if err != nil {
		return w, nil, utils.NewFriendlyError(http.StatusUnprocessableEntity, "Não foi possível resolver o motor desta conexão.", fmt.Errorf("groups: EngineFor(%d): %w", whatsappID, err))
	}
	groupEngine, ok := engine.(domain.GroupEngine)
	if !ok {
		return w, nil, utils.NewFriendlyError(http.StatusNotImplemented,
			"A conexão selecionada não suporta gestão de grupos.",
			fmt.Errorf("groups: engine da conexão %d (tipo %q) não implementa domain.GroupEngine", whatsappID, w.EngineType))
	}
	return w, groupEngine, nil
}

// checkThrottle applies the write-action rate limit (invariant 4) — called
// by every write handler before touching the resolved GroupEngine. Read
// handlers never throttle.
func (s *groupsService) checkThrottle(tenantID uuid.UUID, whatsappID int) error {
	if !s.throttle.Allow(tenantID, whatsappID) {
		return utils.NewFriendlyError(http.StatusTooManyRequests,
			"Muitas ações de grupo em sequência nesta conexão — aguarde um instante. Isso protege o número contra banimento por atividade administrativa em massa.",
			fmt.Errorf("groups: rate limit excedido para conexão %d", whatsappID))
	}
	return nil
}

// checkThrottleFromQuery is checkThrottle for the handful of write routes
// that take whatsappId from the query string instead of a JSON body (e.g.
// DELETE .../groups/:groupId, which typical REST clients send without a
// body).
func (s *groupsService) checkThrottleFromQuery(tenantID uuid.UUID, whatsappIDRaw string) error {
	whatsappID, err := strconv.Atoi(whatsappIDRaw)
	if err != nil || whatsappID <= 0 {
		return utils.NewFriendlyError(http.StatusBadRequest, "Parâmetro whatsappId é obrigatório.", fmt.Errorf("groups: whatsappId inválido na query: %q", whatsappIDRaw))
	}
	return s.checkThrottle(tenantID, whatsappID)
}

func groupsCtx(c *gin.Context) context.Context {
	return c.Request.Context()
}
