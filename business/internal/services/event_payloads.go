package services

import (
	"encoding/json"
)

type EventEnvelope struct {
	Type     string          `json:"type"`
	Payload  json.RawMessage `json:"payload"`
	TenantID string          `json:"tenantId"`
}

type QrCodePayload struct {
	SessionID string `json:"sessionId"`
	QrCode    string `json:"qrcode"`
}

type PairingCodePayload struct {
	SessionID   string `json:"sessionId"`
	PairingCode string `json:"pairingCode"`
	Status      string `json:"status"`
}

type SessionStatusPayload struct {
	SessionID       string `json:"sessionId"`
	Status          string `json:"status"`
	Number          string `json:"number"`
	ProfilePicUrl   string `json:"profilePicUrl"`
	FirstConnection bool   `json:"firstConnection"`
}

// SessionRiskPayload carries a whatsmeow IQ error code the anti-ban research
// links to account-level throttling/ban risk (401/403/429/463) — surfaced
// from any outbound action (send/upload/markRead/reaction/profile-picture
// fetch), not just profile-picture fetches.
type SessionRiskPayload struct {
	SessionID int    `json:"sessionId"`
	Action    string `json:"action"`
	Code      int    `json:"code"`
	Message   string `json:"message"`
}

type MessagePayload struct {
	ID            string `json:"id"`
	From          string `json:"from"`
	Body          string `json:"body"`
	Type          string `json:"type"`
	FromMe        bool   `json:"fromMe"`
	Timestamp     int64  `json:"timestamp"`
	PushName      string `json:"pushName"`
	GroupName     string `json:"groupName"`
	QuotedMsgId   string `json:"quotedMsgId"`
	ProfilePicUrl string `json:"profilePicUrl"`
	SenderPicUrl  string `json:"senderPicUrl"`
	IsLid         bool   `json:"isLid"`
	Participant   string `json:"participant"`
	IsGroup       bool   `json:"isGroup"`
	IsCommunity   bool   `json:"isCommunity"`
	IsSubGroup    bool   `json:"isSubGroup"`
	// MentionedJids carries the @-mentioned JIDs from the message's WhatsApp
	// ContextInfo (engine-go, extractMentionedJIDs) — used to decide whether
	// an Assistant configured to only respond when mentioned in a group
	// should reply or just observe. Not persisted; consumed in-memory by
	// flow.InboundContext for the duration of this inbound pass.
	MentionedJids []string `json:"mentionedJids"`
	MediaUrl      string   `json:"mediaUrl"`
	MediaData     string   `json:"mediaData"`
	Mimetype      string   `json:"mimetype"`
	// Thumbnail (base64 JPEG) and MediaProto (base64 serialized media message)
	// power on-demand media download: media is not fetched on receipt, only when
	// the operator clicks the download button.
	Thumbnail  string `json:"thumbnail"`
	MediaProto string `json:"mediaProto"`
}

type MessageReceivedPayload struct {
	Message   MessagePayload `json:"message"`
	SessionID string         `json:"sessionId"`
}

type HistorySyncPayload struct {
	SessionID string           `json:"sessionId"`
	Type      string           `json:"type"`
	Progress  uint32           `json:"progress"`
	TicketID  int              `json:"ticketId"`
	Messages  []MessagePayload `json:"messages"`
}

type MessageReactionPayload struct {
	SessionID string `json:"sessionId"`
	MessageID string `json:"messageId"`
	JID       string `json:"jid"`
	Reaction  string `json:"reaction"`
	Sender    string `json:"sender"`
	FromMe    bool   `json:"fromMe"`
	Timestamp int64  `json:"timestamp"`
}

type MessageRevokePayload struct {
	SessionID string `json:"sessionId"`
	MessageID string `json:"messageId"`
	FromJID   string `json:"fromJid"`
	FromMe    bool   `json:"fromMe"`
}

// ContactUpdatePayload mirrors the engine-go contact.update event, whose contact
// fields are nested under "contact" (see engine handleContactEvent/handlePushNameEvent).
type ContactUpdatePayload struct {
	SessionID string `json:"sessionId"`
	Contact   struct {
		JID           string `json:"jid"`
		Number        string `json:"number"`
		Name          string `json:"name"`
		PushName      string `json:"pushName"`
		ProfilePicUrl string `json:"profilePicUrl"`
	} `json:"contact"`
}

type ImportedContact struct {
	JID      string `json:"jid"`
	Number   string `json:"number"`
	Name     string `json:"name"`
	PushName string `json:"pushName"`
}

type ContactImportPayload struct {
	SessionID string            `json:"sessionId"`
	Contacts  []ImportedContact `json:"contacts"`
}

// PollVotePayload is emitted by the engine when a contact votes on a poll message.
// Routing key: "wbot.*.*.message.poll_vote"
type PollVotePayload struct {
	SessionID      string `json:"sessionId"`
	PollMessageID  string `json:"pollMessageId"`
	VoterJID       string `json:"voterJid"`
	OptionSelected string `json:"optionSelected"`
}
