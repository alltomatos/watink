package plugins

import "errors"

// errSendNotImplemented is a deliberate, fail-safe placeholder: sendOne's
// real implementation (WhatsAppAdapter wiring, BuildQuickAnswerCommand,
// ticket/message persistence) lands in issue #595. Until then, the drain
// (groups_campaign_drain.go, issue #594) must never silently mark a send
// "sent" without actually publishing it -- returning an error here makes
// drainOneSend take the failure path (retry with backoff, eventually
// "failed"), which is safe: worse latency, never a phantom success.
var errSendNotImplemented = errors.New("groups: sendOne ainda não implementado (issue #595)")

// sendOne dispatches ONE campaign send. STUB for issue #594 -- replaced by
// the real implementation in issue #595 (flow.WhatsAppAdapter +
// flow.BuildQuickAnswerCommand + ticket/message persistence). The
// signature is deliberately final now so groups_campaign_drain.go's call
// site doesn't change shape when #595 lands.
func sendOne() error {
	return errSendNotImplemented
}
