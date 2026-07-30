package utils

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// FriendlyError marca um erro cuja mensagem já é segura pra mostrar direto
// ao usuário final (ex.: limite de plano atingido, configuração pendente em
// Configurações) — RespondWithFriendlyOrInternalError usa isso em vez do
// genérico "Internal server error" quando o erro (ou algo que ele encadeia
// via %w) é um *FriendlyError.
type FriendlyError struct {
	Message string
	Status  int
	Err     error
}

func (e *FriendlyError) Error() string { return e.Err.Error() }
func (e *FriendlyError) Unwrap() error { return e.Err }

// NewFriendlyError envolve err com uma mensagem segura + status HTTP pra
// exibir ao usuário final.
func NewFriendlyError(status int, message string, err error) error {
	return &FriendlyError{Message: message, Status: status, Err: err}
}

// ParseIntParam extracts a named path parameter as int, writes 400 and returns false on failure.
func ParseIntParam(c *gin.Context, name string) (int, bool) {
	raw := c.Param(name)
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid %s", name)})
		return 0, false
	}
	return v, true
}

func RespondWithError(c *gin.Context, code int, err error, message string) {
	slog.Error("API error",
		"method", c.Request.Method,
		"path", c.Request.URL.Path,
		"status", code,
		"error", err.Error(),
		"client_message", message,
	)
	c.JSON(code, gin.H{"error": message})
}

func RespondWithBindError(c *gin.Context, err error) {
	if c != nil {
		slog.Warn("Request validation failed",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"error", err.Error(),
			"client_message", "Invalid request format or missing required fields",
		)
	} else {
		slog.Warn("Request validation failed (nil context)", "error", err.Error())
	}
	c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format or missing required fields"})
}

func RespondWithInternalError(c *gin.Context, err error, context string) {
	if c != nil {
		slog.Error("Internal server error",
			"context", context,
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"error", err.Error(),
		)
	} else {
		slog.Error("Internal server error (nil context)", "context", context, "error", err.Error())
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error. Please try again later."})
}

func RespondWithServiceError(c *gin.Context, code int, err error, safeMessage string) {
	if c != nil {
		slog.Error("Service error",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", code,
			"error", err.Error(),
			"client_message", safeMessage,
		)
	} else {
		slog.Error("Service error (nil context)", "status", code, "error", err.Error())
	}
	c.JSON(code, gin.H{"error": safeMessage})
}

// RespondWithFriendlyOrInternalError responde com a mensagem segura de um
// *FriendlyError (encadeado via errors.As) quando presente; caso contrário
// cai no genérico RespondWithInternalError.
func RespondWithFriendlyOrInternalError(c *gin.Context, err error, context string) {
	var fe *FriendlyError
	if errors.As(err, &fe) {
		RespondWithServiceError(c, fe.Status, err, fe.Message)
		return
	}
	RespondWithInternalError(c, err, context)
}

func LogOnlyError(c *gin.Context, err error, context string) {
	if c != nil {
		slog.Error("Non-critical error",
			"context", context,
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"error", err.Error(),
		)
	} else {
		slog.Error("Non-critical error (nil context)", "context", context, "error", err.Error())
	}
}
