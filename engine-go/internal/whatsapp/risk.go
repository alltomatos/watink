package whatsapp

import (
	"errors"
	"log"

	"go.mau.fi/whatsmeow"
)

// riskIQCodes are WhatsApp IQ error codes that the anti-ban research links to
// account-level restriction/spam-flagging (not just per-request failures):
// 401/403 (auth/forbidden, often surfaces right before a ban), 429
// (rate-overlimit), and 463 (rate-overlimit variant WhatsApp returns when an
// account is being throttled for suspected spam/enumeration behavior).
var riskIQCodes = map[int]bool{
	401: true,
	403: true,
	429: true,
	463: true,
}

// classifyRiskError inspects err for a whatsmeow *IQError carrying one of the
// codes above. Returns the code and true when it is a risk signal.
func classifyRiskError(err error) (int, bool) {
	if err == nil {
		return 0, false
	}
	var iqErr *whatsmeow.IQError
	if !errors.As(err, &iqErr) {
		return 0, false
	}
	if riskIQCodes[iqErr.Code] {
		return iqErr.Code, true
	}
	return 0, false
}

// reportIfRiskSignal checks err for a ban/throttle-risk IQ code and, if found,
// logs it loudly and emits a "session.risk" event so the business layer can
// act (e.g. auto-isolate the connection's proxy, degrade session health).
// Every whatsmeow call site that can return a request error should route its
// error through this before returning, not just the profile-picture path.
func (s *WhatsAppService) reportIfRiskSignal(sessionID int, tenantID, action string, err error) {
	code, risky := classifyRiskError(err)
	if !risky {
		return
	}
	log.Printf("[Risk] session=%d action=%s whatsapp IQ error %d — possible ban/throttle signal: %v", sessionID, action, code, err)
	s.publishEvent(tenantID, sessionID, "session.risk", map[string]interface{}{
		"sessionId": sessionID,
		"action":    action,
		"code":      code,
		"message":   err.Error(),
	})
}
