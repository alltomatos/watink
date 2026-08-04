// Package groupsapi is the internal-only HTTP API for active WhatsApp
// group/community management (T1.x, plan "Grupos e Comunidades" —
// docs/agents/plugin-grupos-comunidades.md at watinkdev root, contract in
// engine-go/docs/groups-api.md). It NEVER leaves the docker-internal
// network — compose exposes it via `expose:`, never `ports:` — and every
// request must carry a valid X-Internal-Token.
package groupsapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/alltomatos/watinkdev/engine-go/internal/whatsapp"
)

// Error codes — subset of the izapia vocabulary reused for consistency
// (engine-go/docs/groups-api.md "Envelope"), so the business-side enginego
// provider and izapia provider stay code-mirrors of each other.
const (
	CodeInvalidInput        = "INVALID_INPUT"
	CodeNotFound            = "NOT_FOUND"
	CodeAuthFailed          = "AUTH_FAILED"
	CodeNotAdmin            = "NOT_ADMIN"
	CodeRateLimited         = "RATE_LIMITED"
	CodeProviderError       = "PROVIDER_ERROR"
	CodeSessionNotConnected = "SESSION_NOT_CONNECTED"
)

// envelope is the canonical response shape — mirrors izapia's
// {ok, data, error{code,message}} exactly (see groups-api.md "Envelope —
// espelho do envelope da izapia").
type envelope struct {
	OK    bool         `json:"ok"`
	Data  any          `json:"data,omitempty"`
	Error *errorDetail `json:"error,omitempty"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeData(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{OK: true, Data: data})
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{OK: false, Error: &errorDetail{Code: code, Message: message}})
}

// mapBackendError classifies an error returned by the whatsapp package into
// an HTTP status + envelope code. Order matters: session-not-connected and
// invalid-JID are checked before the generic not-found/provider-error
// fallback.
func mapBackendError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, whatsapp.ErrGroupNotFound):
		writeError(w, http.StatusNotFound, CodeNotFound, err.Error())
	case errors.Is(err, whatsapp.ErrInvalidGroupJID), errors.Is(err, whatsapp.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, CodeInvalidInput, err.Error())
	case errors.Is(err, whatsapp.ErrSessionNotConnected):
		writeError(w, http.StatusConflict, CodeSessionNotConnected, err.Error())
	case errors.Is(err, whatsapp.ErrGroupNotAdmin):
		writeError(w, http.StatusForbidden, CodeNotAdmin, err.Error())
	case errors.Is(err, whatsapp.ErrGroupRateLimited):
		writeError(w, http.StatusTooManyRequests, CodeRateLimited, err.Error())
	default:
		writeError(w, http.StatusBadGateway, CodeProviderError, err.Error())
	}
}
