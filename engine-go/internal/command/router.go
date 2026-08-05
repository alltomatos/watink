package command

import (
	"fmt"
	"strings"
)

// ParseRoutingKey extracts tenantID, sessionID string and command type from a routing key
// of the form "wbot.<tenantId>.<sessionId>.<cmd>.<sub>...".
// Returns an error for keys with fewer than 4 segments or unknown command types.
func ParseRoutingKey(routingKey string) (tenantID string, sessionID string, cmd string, err error) {
	parts := strings.Split(routingKey, ".")
	if len(parts) < 4 {
		return "", "", "", fmt.Errorf("invalid routing key: %s", routingKey)
	}
	tenantID = parts[1]
	sessionID = parts[2]
	cmd = strings.Join(parts[3:], ".")

	switch cmd {
	case "session.start", "session.stop", "session.delete",
		"message.send.text", "message.send.media",
		"message.send.buttons", "message.send.list", "message.send.poll", "message.send.interactive", "message.send.template", "message.send.carousel",
		"message.react",
		"message.markAsRead", "media.download",
		"contact.sync", "contact.import", "history.sync", "history.recover",
		"chat.presence":
		return tenantID, sessionID, cmd, nil
	default:
		return "", "", "", fmt.Errorf("unknown command type: %s", cmd)
	}
}
