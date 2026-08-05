package utils

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// JWTClaims holds the fields needed to generate JWT tokens.
// Decouples token generation from any specific model struct.
type JWTClaims struct {
	Name         string
	ID           int
	Alcance      string
	TenantID     uuid.UUID
	TokenVersion int
}

// RefreshTokenDuration returns how long the refresh cookie should live —
// "Mantenha-me conectado" trades a short session-like window for the long one;
// unchecked still gets a real session, just one that doesn't outlive a day unattended.
func RefreshTokenDuration(rememberMe bool) time.Duration {
	if rememberMe {
		return time.Hour * 24 * 7
	}
	return time.Hour * 24
}

func GenerateAccessToken(claims JWTClaims) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET must be set — security-critical")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"username": claims.Name,
		"id":       claims.ID,
		"alcance":  claims.Alcance,
		"tenantId": claims.TenantID,
		"exp":      time.Now().Add(time.Hour * 2).Unix(),
	})

	return token.SignedString([]byte(secret))
}

// GenerateRefreshToken embeds rememberMe in the token itself so a later
// refresh (which has no access to the original login request) knows which
// duration to reapply when it slides the cookie's expiration forward.
func GenerateRefreshToken(claims JWTClaims, rememberMe bool) (string, error) {
	secret := os.Getenv("JWT_REFRESH_SECRET")
	if secret == "" {
		return "", fmt.Errorf("JWT_REFRESH_SECRET must be set — security-critical")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":           claims.ID,
		"tenantId":     claims.TenantID,
		"tokenVersion": claims.TokenVersion,
		"rememberMe":   rememberMe,
		"exp":          time.Now().Add(RefreshTokenDuration(rememberMe)).Unix(),
	})

	return token.SignedString([]byte(secret))
}
