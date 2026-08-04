package whatsapp

import (
	"errors"
	"fmt"

	"go.mau.fi/whatsmeow"
)

// classifyGroupWriteError inspects err for a whatsmeow *IQError and
// reclassifies it into ErrGroupNotAdmin/ErrGroupRateLimited so
// internal/groupsapi can map it to the right HTTP status without knowing
// about whatsmeow types. Any IQError with code 401/429/463 is also reported
// via reportIfRiskSignal (ban/throttle risk, risk.go) — 403 is NOT reported
// as risk, since "not admin of this group" is a normal permission error,
// not a sign the account itself is being throttled.
//
// Errors that aren't a classified IQError pass through unchanged (wrapped
// with the action name for context).
func (s *WhatsAppService) classifyGroupWriteError(sessionID int, tenantID, action string, err error) error {
	if err == nil {
		return nil
	}
	var iqErr *whatsmeow.IQError
	if errors.As(err, &iqErr) {
		switch iqErr.Code {
		case 403:
			return fmt.Errorf("%w: %v", ErrGroupNotAdmin, err)
		case 401, 429, 463:
			s.reportIfRiskSignal(sessionID, tenantID, action, err)
			return fmt.Errorf("%w: %v", ErrGroupRateLimited, err)
		}
	}
	return fmt.Errorf("%s: %w", action, err)
}

// Sentinel errors classified by internal/groupsapi into the envelope error
// codes documented in engine-go/docs/groups-api.md (NOT_FOUND,
// INVALID_INPUT, ...). Wrapped with fmt.Errorf("%w: ...") so callers can
// errors.Is against them while keeping the underlying whatsmeow error text.
var (
	ErrGroupNotFound   = errors.New("group not found")
	ErrInvalidGroupJID = errors.New("invalid group JID")

	// ErrInvalidInput classifies request-validation failures that aren't
	// specifically a bad JID (unknown action, malformed base64 image, ...)
	// — internal/groupsapi maps both this and ErrInvalidGroupJID to the
	// same 400 INVALID_INPUT envelope code.
	ErrInvalidInput = errors.New("invalid input")

	// ErrSessionNotConnected is returned by getConnectedClient (service.go)
	// and wrapped with the session ID — exported (rather than a private
	// string-formatted error) specifically so internal/groupsapi can
	// errors.Is against it instead of matching error text.
	ErrSessionNotConnected = errors.New("session is not connected")

	// ErrGroupNotAdmin classifies a whatsmeow IQError code 403 on a group
	// write action — the caller isn't admin of the group, NOT a risk-of-ban
	// signal (unlike 401/429/463, which classifyGroupWriteError routes
	// through reportIfRiskSignal instead). groups-api.md documents this
	// distinction explicitly.
	ErrGroupNotAdmin = errors.New("not admin of this group")

	// ErrGroupRateLimited classifies a whatsmeow IQError code 401/429/463
	// on a group write action — a ban/throttle risk signal per risk.go's
	// own riskIQCodes table.
	ErrGroupRateLimited = errors.New("whatsapp rate-limited this group action")
)
