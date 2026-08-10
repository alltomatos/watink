package controllers

import (
	"errors"
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
)

// respondPlanLimitError traduz o erro de PlanLimitService.CheckLimit pra
// resposta HTTP: *services.PlanLimitError vira o corpo estruturado exigido
// por docs/integration-core.md §2.2 (watink-saas) -- o frontend usa
// resource/limit pra montar o toast de upgrade (issue A.5). Qualquer outro
// erro (ex.: falha de query) cai no fallback genérico existente.
func respondPlanLimitError(c *gin.Context, err error, fallbackMessage string) {
	var limitErr *services.PlanLimitError
	if errors.As(err, &limitErr) {
		c.JSON(http.StatusForbidden, gin.H{
			"error":    "plan_limit_reached",
			"resource": limitErr.Resource,
			"limit":    limitErr.Limit,
		})
		return
	}
	utils.RespondWithServiceError(c, http.StatusForbidden, err, fallbackMessage)
}
