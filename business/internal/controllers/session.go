package controllers

import (
	"errors"
	"log/slog"
	"net/http"
	"os"

	"github.com/alltomatos/watinkdev/business/internal/domain"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type AuthController struct {
	userRepo     domain.UserRepository
	tenantStatus *services.TenantStatusService
}

func NewAuthController(ur domain.UserRepository) *AuthController {
	return &AuthController{userRepo: ur}
}

// WithTenantStatusService plugs the Onda 2/A.3 gate (docs/integration-core.md
// §2.1) into Login. Optional/fluent so the many existing NewAuthController
// call sites (tests) keep compiling untouched; nil means the check is
// skipped entirely (same fail-open default as TenantStatusGate).
func (ac *AuthController) WithTenantStatusService(svc *services.TenantStatusService) *AuthController {
	ac.tenantStatus = svc
	return ac
}

type LoginRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required"`
	RememberMe bool   `json:"rememberMe"`
}

// @Summary      Login
// @Description  Autentica usuário e retorna JWT de acesso e refresh token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      LoginRequest  true  "Credenciais"
// @Success      200   {object}  map[string]interface{}
// @Failure      401   {object}  map[string]string
// @Router       /auth/login [post]
func (ac *AuthController) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithBindError(c, err)
		return
	}

	domainUser, err := ac.userRepo.FindByEmailForAuth(c.Request.Context(), req.Email)
	if err != nil || domainUser == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ERR_INVALID_CREDENTIALS"})
		return
	}

	userModel := domain.User{PasswordHash: domainUser.PasswordHash}
	if !userModel.CheckPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ERR_INVALID_CREDENTIALS"})
		return
	}

	// TenantStatusGate covers every authenticated route AFTER login, but a
	// suspended/canceled tenant must never receive a fresh token in the first
	// place (docs/integration-core.md §2.1) — same superadmin bypass and
	// fail-open-on-db-error semantics as the middleware.
	if ac.tenantStatus != nil && domainUser.Alcance != "plataforma" {
		if status, err := ac.tenantStatus.GetStatus(domainUser.TenantID); err == nil {
			if status == "suspended" || status == "canceled" {
				c.JSON(http.StatusForbidden, gin.H{"error": "tenant_" + status, "status": status})
				return
			}
		}
	}

	claims := utils.JWTClaims{
		Name:         domainUser.Name,
		ID:           domainUser.ID,
		Alcance:      domainUser.Alcance,
		TenantID:     domainUser.TenantID,
		TokenVersion: domainUser.TokenVersion,
	}

	token, err := utils.GenerateAccessToken(claims)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	refreshToken, err := utils.GenerateRefreshToken(claims, req.RememberMe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	secureCookie := os.Getenv("APP_ENV") == "production"
	maxAge := int(utils.RefreshTokenDuration(req.RememberMe).Seconds())
	c.SetCookie("refreshToken", refreshToken, maxAge, "/", "", secureCookie, true)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  domainUser,
	})
}

// @Summary      Refresh token
// @Description  Renova o access token usando o refresh token no cookie
// @Tags         auth
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]string
// @Router       /auth/refresh_token [post]
func (ac *AuthController) RefreshToken(c *gin.Context) {
	refreshTokenStr, err := c.Cookie("refreshToken")
	if err != nil || refreshTokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No refresh token provided"})
		return
	}

	secret := os.Getenv("JWT_REFRESH_SECRET")
	if secret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server misconfiguration — JWT_REFRESH_SECRET not set"})
		return
	}

	token, err := jwt.Parse(refreshTokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			slog.Warn("Unexpected JWT signing method", "alg", token.Header["alg"])
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		slog.Warn("Refresh token validation failed", "error", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token claims"})
		return
	}

	userID := int(claims["id"].(float64))
	tenantIDStr := claims["tenantId"].(string)
	tokenVersion := int(claims["tokenVersion"].(float64))
	rememberMe, _ := claims["rememberMe"].(bool)

	tenantUUID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid tenant ID in token"})
		return
	}

	user, err := ac.userRepo.FindByID(c.Request.Context(), userID, tenantUUID)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	if user.TokenVersion != tokenVersion {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token version mismatch — please re-login"})
		return
	}

	newClaims := utils.JWTClaims{
		Name:         user.Name,
		ID:           user.ID,
		Alcance:      user.Alcance,
		TenantID:     user.TenantID,
		TokenVersion: user.TokenVersion,
	}

	accessToken, err := utils.GenerateAccessToken(newClaims)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	// Sliding expiration: reissue the refresh cookie on every successful refresh
	// so an active user's session keeps extending instead of hard-expiring exactly
	// RefreshTokenDuration after the original login, regardless of activity.
	newRefreshToken, err := utils.GenerateRefreshToken(newClaims, rememberMe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}
	secureCookie := os.Getenv("APP_ENV") == "production"
	maxAge := int(utils.RefreshTokenDuration(rememberMe).Seconds())
	c.SetCookie("refreshToken", newRefreshToken, maxAge, "/", "", secureCookie, true)

	c.JSON(http.StatusOK, gin.H{
		"token": accessToken,
		"user":  user,
	})
}

// @Summary      Logout
// @Description  Invalida o refresh token no cookie
// @Tags         auth
// @Produce      json
// @Success      200  {object}  map[string]string
// @Security     BearerAuth
// @Router       /auth/logout [delete]
func (ac *AuthController) Logout(c *gin.Context) {
	c.SetCookie("refreshToken", "", -1, "/", "", os.Getenv("APP_ENV") == "production", true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}
