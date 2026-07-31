package whatsapp

import (
	"context"
	"fmt"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

func (s *WhatsAppService) handleMessageEvent(client *whatsmeow.Client, id int, tenantID string, v *events.Message) {
	if v.Message == nil {
		return
	}

	// WhatsApp Status/Stories ("status@broadcast") are not conversations and must
	// not create tickets. They also frequently carry media whose synchronous
	// download here would stall the serial event loop for the whole session.
	if v.Info.Chat.String() == "status@broadcast" {
		return
	}

	if protocolMsg := v.Message.GetProtocolMessage(); protocolMsg != nil {
		if protocolMsg.GetType() == waProto.ProtocolMessage_REVOKE && protocolMsg.GetKey() != nil {
			s.publishEvent(tenantID, id, "message.revoke", map[string]interface{}{
				"sessionId": fmt.Sprintf("%d", id),
				"messageId": protocolMsg.GetKey().GetID(),
				"fromJid":   v.Info.Sender.String(),
				"fromMe":    v.Info.IsFromMe,
			})
		}
		return
	}

	if reactionMsg := v.Message.GetReactionMessage(); reactionMsg != nil && reactionMsg.GetKey() != nil {
		s.publishEvent(tenantID, id, "message.reaction", map[string]interface{}{
			"sessionId": fmt.Sprintf("%d", id),
			"messageId": reactionMsg.GetKey().GetID(),
			"jid":       v.Info.Sender.String(),
			"reaction":  reactionMsg.GetText(),
			"fromMe":    v.Info.IsFromMe,
		})
		return
	}

	content := extractMessageContent(v.Message)
	// Skip system / unsupported / empty messages (no text and no media) so they
	// don't show up in the chat as blank bubbles rendering the raw number.
	if content.msgType == "chat" && content.body == "" && content.protoB64 == "" {
		return
	}

	isGroup := v.Info.IsGroup || v.Info.Chat.Server == types.GroupServer
	chatJID := v.Info.Chat.String()
	// Strip the device suffix (sender:NN) from the participant.
	senderJID := v.Info.Sender.ToNonAD().String()
	if chatJID == "" {
		chatJID = senderJID
	}

	// Resolve LID → phone number (also device-stripped).
	resolvedSender := senderJID
	if v.Info.Sender.Server == types.HiddenUserServer {
		if pn, err := client.Store.LIDs.GetPNForLID(context.Background(), v.Info.Sender); err == nil && !pn.IsEmpty() {
			resolvedSender = pn.ToNonAD().String()
		}
	}

	// Group subject becomes the contact name (cached); avoids groups looking like
	// individuals named after whoever messaged. groupSubject also populates the
	// groupMetaMap cache used below for community/sub-group detection.
	groupName := ""
	isCommunity := false
	isSubGroup := false
	if isGroup {
		groupName = s.groupSubject(client, v.Info.Chat)
		meta := s.cachedGroupMeta(v.Info.Chat)
		isCommunity = meta.isCommunity
		isSubGroup = meta.isSubGroup
	}

	// Profile picture for the contact record (group's own photo or individual sender's photo).
	// LID senders (@lid, increasingly common) previously never got a picture
	// fetched — GetProfilePictureInfo needs a real JID, so resolve LID→PN
	// first (same resolution already done above for resolvedSender) instead
	// of only accepting DefaultUserServer.
	profilePic := ""
	senderPic := ""
	if isGroup {
		profilePic = s.getCachedPic(client, id, tenantID, v.Info.Chat.ToNonAD())
		// Individual participant photo — shown in message bubble avatars.
		if !v.Info.IsFromMe {
			if picJID, ok := s.resolvePicJID(client, v.Info.Sender); ok {
				senderPic = s.getCachedPic(client, id, tenantID, picJID)
			}
		}
	} else if !v.Info.IsFromMe {
		if picJID, ok := s.resolvePicJID(client, v.Info.Sender); ok {
			profilePic = s.getCachedPic(client, id, tenantID, picJID)
		}
	}

	// For outbound individual messages (fromMe=true, non-group), PushName is the
	// connection owner's name — publishing it would rename the recipient contact to
	// the agent's name. Send empty string so FindOrCreate never overwrites the
	// recipient's existing name with the owner's.
	pushName := v.Info.PushName
	if v.Info.IsFromMe && !isGroup {
		pushName = ""
	}

	s.publishEvent(tenantID, id, "message.received", map[string]interface{}{
		"sessionId": fmt.Sprintf("%d", id),
		"message": map[string]interface{}{
			"id":            v.Info.ID,
			"from":          chatJID,
			"body":          content.body,
			"type":          content.msgType,
			"fromMe":        v.Info.IsFromMe,
			"timestamp":     v.Info.Timestamp.Unix(),
			"pushName":      pushName,
			"groupName":     groupName,
			"profilePicUrl": profilePic,
			"senderPicUrl":  senderPic,
			"isLid":         v.Info.Sender.Server == types.HiddenUserServer,
			"participant":   resolvedSender,
			"isGroup":       isGroup,
			"isCommunity":   isCommunity,
			"isSubGroup":    isSubGroup,
			"mimetype":      content.mimeType,
			// Media is NOT downloaded on receipt (keeps the event loop real-time).
			// Ship the embedded JPEG thumbnail + serialized proto for on-demand DL.
			"thumbnail":  content.thumbnail,
			"mediaProto": content.protoB64,
		},
	})
}

// groupSubject returns the group's display name, cached per group JID to avoid
// a GetGroupInfo round-trip on every message.
func (s *WhatsAppService) groupSubject(client *whatsmeow.Client, jid types.JID) string {
	key := jid.String()
	s.groupNameMu.Lock()
	if n, ok := s.groupNames[key]; ok {
		s.groupNameMu.Unlock()
		return n
	}
	s.groupNameMu.Unlock()

	name := ""
	if info, err := client.GetGroupInfo(context.Background(), jid); err == nil && info != nil {
		name = info.GroupName.Name
		s.groupMetaMu.Lock()
		s.groupMetaMap[key] = groupMeta{
			isCommunity: info.IsParent,
			isSubGroup:  info.IsDefaultSubGroup,
		}
		s.groupMetaMu.Unlock()
	}
	if name != "" {
		s.groupNameMu.Lock()
		s.groupNames[key] = name
		s.groupNameMu.Unlock()
	}
	return name
}

// cachedGroupMeta returns the cached community/sub-group metadata for a group JID.
// Returns zero value (all false) when no info has been cached yet.
func (s *WhatsAppService) cachedGroupMeta(jid types.JID) groupMeta {
	key := jid.String()
	s.groupMetaMu.Lock()
	defer s.groupMetaMu.Unlock()
	return s.groupMetaMap[key]
}
