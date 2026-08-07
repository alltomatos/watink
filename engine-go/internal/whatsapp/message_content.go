package whatsapp

import (
	"encoding/base64"
	"log"

	waProto "go.mau.fi/whatsmeow/binary/proto"
	"google.golang.org/protobuf/proto"
)

type mediaContent struct {
	body      string
	msgType   string
	mimeType  string
	thumbnail string // base64 JPEG preview (image/video/document); empty otherwise
	protoB64  string // base64 proto.Marshal of the downloadable media message
}

func extractMessageContent(msg *waProto.Message) mediaContent {
	c := mediaContent{msgType: "chat", body: msg.GetConversation()}
	if ext := msg.GetExtendedTextMessage(); ext != nil {
		c.body = ext.GetText()
	}
	if img := msg.GetImageMessage(); img != nil {
		return mediaContent{body: img.GetCaption(), msgType: "image", mimeType: img.GetMimetype(), thumbnail: encodeThumb(img.GetJPEGThumbnail()), protoB64: marshalMedia(img)}
	}
	if video := msg.GetVideoMessage(); video != nil {
		return mediaContent{body: video.GetCaption(), msgType: "video", mimeType: video.GetMimetype(), thumbnail: encodeThumb(video.GetJPEGThumbnail()), protoB64: marshalMedia(video)}
	}
	if audio := msg.GetAudioMessage(); audio != nil {
		return mediaContent{msgType: "audio", mimeType: audio.GetMimetype(), protoB64: marshalMedia(audio)}
	}
	if doc := msg.GetDocumentMessage(); doc != nil {
		caption := doc.GetCaption()
		if caption == "" {
			caption = doc.GetTitle()
		}
		return mediaContent{body: caption, msgType: "document", mimeType: doc.GetMimetype(), thumbnail: encodeThumb(doc.GetJPEGThumbnail()), protoB64: marshalMedia(doc)}
	}
	if sticker := msg.GetStickerMessage(); sticker != nil {
		return mediaContent{msgType: "sticker", mimeType: sticker.GetMimetype(), protoB64: marshalMedia(sticker)}
	}
	return c
}

// extractMentionedJIDs returns the @-mentioned JIDs carried in a message's
// ContextInfo, across every message type that can have mentions (a plain
// text reply is a Conversation with no ContextInfo — only ExtendedTextMessage
// and caption-bearing media types carry one). Used to decide whether an
// Assistant configured to only respond when mentioned in a group should
// reply or just observe.
func extractMentionedJIDs(msg *waProto.Message) []string {
	if ext := msg.GetExtendedTextMessage(); ext != nil {
		if jids := ext.GetContextInfo().GetMentionedJID(); len(jids) > 0 {
			return jids
		}
	}
	if img := msg.GetImageMessage(); img != nil {
		if jids := img.GetContextInfo().GetMentionedJID(); len(jids) > 0 {
			return jids
		}
	}
	if video := msg.GetVideoMessage(); video != nil {
		if jids := video.GetContextInfo().GetMentionedJID(); len(jids) > 0 {
			return jids
		}
	}
	if doc := msg.GetDocumentMessage(); doc != nil {
		if jids := doc.GetContextInfo().GetMentionedJID(); len(jids) > 0 {
			return jids
		}
	}
	return nil
}

// extractQuotedStanzaID returns the id of the message this one replies to,
// across every message type that can carry a ContextInfo (a plain
// Conversation cannot — mirrors extractMentionedJIDs above). Empty string
// when the message isn't a reply. Feeds Message.QuotedMsgID
// (business/internal/services/event_payloads.go MessagePayload.QuotedMsgId),
// which the business side already declares and maps but nothing populates
// today — receive_message.go's QuotedMsgID branch never fires.
func extractQuotedStanzaID(msg *waProto.Message) string {
	if ext := msg.GetExtendedTextMessage(); ext != nil {
		if id := ext.GetContextInfo().GetStanzaID(); id != "" {
			return id
		}
	}
	if img := msg.GetImageMessage(); img != nil {
		if id := img.GetContextInfo().GetStanzaID(); id != "" {
			return id
		}
	}
	if video := msg.GetVideoMessage(); video != nil {
		if id := video.GetContextInfo().GetStanzaID(); id != "" {
			return id
		}
	}
	if doc := msg.GetDocumentMessage(); doc != nil {
		if id := doc.GetContextInfo().GetStanzaID(); id != "" {
			return id
		}
	}
	if audio := msg.GetAudioMessage(); audio != nil {
		if id := audio.GetContextInfo().GetStanzaID(); id != "" {
			return id
		}
	}
	return ""
}

func encodeThumb(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	return base64.StdEncoding.EncodeToString(b)
}

func marshalMedia(m proto.Message) string {
	raw, err := proto.Marshal(m)
	if err != nil {
		log.Printf("failed to marshal media proto: %v", err)
		return ""
	}
	return base64.StdEncoding.EncodeToString(raw)
}
