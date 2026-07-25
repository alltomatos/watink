package controllers

import (
	"errors"
	"net/http"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/saasclient"
	"github.com/alltomatos/watinkdev/business/pkg/ratelimit"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
)

// RegisterController serve o proxy público de registro self-service (Onda 6,
// ADR 0007 do Watink SaaS): repassa a intenção de um usuário final ao Watink
// SaaS, que segue sendo a ÚNICA autoridade — cria o tenant e provisiona pelo
// outbox. Este controller NUNCA cria tenant localmente; é um proxy que
// endurece a borda pública (rate-limit + CAPTCHA opcional + allowlist estrita
// de campos) antes de repassar ao SaaS por um canal server-to-server cujo
// token nunca chega ao navegador.
type RegisterController struct {
	saas    *saasclient.Client
	captcha *saasclient.CaptchaVerifier
	limiter *ratelimit.Limiter
}

// NewRegisterController injeta o saasclient, o verificador de CAPTCHA e o
// rate-limiter (DI pura).
func NewRegisterController(saas *saasclient.Client, captcha *saasclient.CaptchaVerifier) *RegisterController {
	return &RegisterController{
		saas:    saas,
		captcha: captcha,
		// 5 tentativas por IP a cada 10 minutos — generoso o bastante para um
		// usuário legítimo que erra a senha/CAPTCHA, apertado para um bot.
		limiter: ratelimit.New(5, 10*time.Minute),
	}
}

// Enabled reporta se o registro self-service está ligado nesta instalação
// (saasclient.Enabled()) — usado pelo wiring de rotas para decidir se monta o
// grupo público.
func (rc *RegisterController) Enabled() bool {
	return rc.saas.Enabled()
}

// Plans repassa o catálogo público de planos ao frontend. Não exige CAPTCHA
// nem rate-limit (leitura, sem efeito colateral).
func (rc *RegisterController) Plans(c *gin.Context) {
	resp, err := rc.saas.Plans(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "registration_unavailable"})
		return
	}
	c.JSON(http.StatusOK, resp)
}

type registerBody struct {
	PlanID       string `json:"planId" binding:"required"`
	CompanyName  string `json:"companyName" binding:"required"`
	Document     string `json:"document"`
	FirstName    string `json:"firstName" binding:"required"`
	LastName     string `json:"lastName" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required"`
	CaptchaToken string `json:"captchaToken"`
}

// Register valida + endurece a borda pública e repassa ao SaaS um allowlist
// ESTRITO de campos — o chamador nunca escolhe a instância nem toca no token.
func (rc *RegisterController) Register(c *gin.Context) {
	if !rc.limiter.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too_many_attempts"})
		return
	}

	var body registerBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	if _, err := utils.ValidateStringField(body.CompanyName, "companyName", 255); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(body.FirstName, "firstName", 100); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := utils.ValidateStringField(body.LastName, "lastName", 100); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validatePasswordStrength(body.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// CAPTCHA: só verificado quando configurado (TURNSTILE_SECRET setada) — sem
	// segredo, esta instalação está em modo dev e a checagem é pulada (nunca em
	// produção com o segredo presente). Verificador inacessível OU token
	// inválido = rejeita (fail-closed quando ativo).
	if rc.captcha.Enabled() {
		if body.CaptchaToken == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "captcha_required"})
			return
		}
		ok, err := rc.captcha.Verify(c.Request.Context(), body.CaptchaToken, c.ClientIP())
		if err != nil || !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "captcha_failed"})
			return
		}
	}

	result, err := rc.saas.Register(c.Request.Context(), saasclient.RegisterRequest{
		PlanID:      body.PlanID,
		CompanyName: body.CompanyName,
		Document:    body.Document,
		FirstName:   body.FirstName,
		LastName:    body.LastName,
		Email:       normalizeEmail(body.Email),
		Password:    body.Password,
	})
	if err != nil {
		var regErr *saasclient.RegisterError
		if errors.As(err, &regErr) {
			switch regErr.Status {
			case http.StatusNotFound:
				c.JSON(http.StatusNotFound, gin.H{"error": "plan_not_found"})
			case http.StatusConflict:
				c.JSON(http.StatusConflict, gin.H{"error": "email_already_registered"})
			case http.StatusUnprocessableEntity:
				c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "plan_not_eligible"})
			case http.StatusForbidden:
				c.JSON(http.StatusForbidden, gin.H{"error": "registration_closed"})
			default:
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
			}
			return
		}
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "registration_unavailable"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"registrationId": result.RegistrationID,
		"status":         result.Status,
	})
}

// Status faz o poll do andamento de um registro para o frontend.
func (rc *RegisterController) Status(c *gin.Context) {
	id := c.Param("id")
	result, err := rc.saas.RegisterStatus(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "registration_not_found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": result.Status})
}
