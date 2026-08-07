package whatsapp

import (
	"testing"

	waProto "go.mau.fi/whatsmeow/binary/proto"
)

func TestExtractMentionedJIDs_ExtendedTextMessage(t *testing.T) {
	msg := &waProto.Message{
		ExtendedTextMessage: &waProto.ExtendedTextMessage{
			Text: strPtr("oi @Fulano"),
			ContextInfo: &waProto.ContextInfo{
				MentionedJID: []string{"5511999999999@s.whatsapp.net"},
			},
		},
	}
	got := extractMentionedJIDs(msg)
	if len(got) != 1 || got[0] != "5511999999999@s.whatsapp.net" {
		t.Fatalf("expected one mentioned JID, got %v", got)
	}
}

func TestExtractMentionedJIDs_PlainTextHasNoMentions(t *testing.T) {
	msg := &waProto.Message{Conversation: strPtr("mensagem simples")}
	if got := extractMentionedJIDs(msg); len(got) != 0 {
		t.Fatalf("expected no mentions for plain conversation, got %v", got)
	}
}

func TestExtractMentionedJIDs_ImageCaption(t *testing.T) {
	msg := &waProto.Message{
		ImageMessage: &waProto.ImageMessage{
			Caption: strPtr("olha isso @Fulano"),
			ContextInfo: &waProto.ContextInfo{
				MentionedJID: []string{"5511888888888@s.whatsapp.net"},
			},
		},
	}
	got := extractMentionedJIDs(msg)
	if len(got) != 1 || got[0] != "5511888888888@s.whatsapp.net" {
		t.Fatalf("expected one mentioned JID from image caption, got %v", got)
	}
}

func TestExtractQuotedStanzaID_ExtendedTextMessage(t *testing.T) {
	msg := &waProto.Message{
		ExtendedTextMessage: &waProto.ExtendedTextMessage{
			Text: strPtr("respondendo"),
			ContextInfo: &waProto.ContextInfo{
				StanzaID: strPtr("3EB0ABCDEF1234567890"),
			},
		},
	}
	got := extractQuotedStanzaID(msg)
	if got != "3EB0ABCDEF1234567890" {
		t.Fatalf("expected quoted stanza id, got %q", got)
	}
}

func TestExtractQuotedStanzaID_PlainConversationHasNoQuote(t *testing.T) {
	msg := &waProto.Message{Conversation: strPtr("mensagem simples")}
	if got := extractQuotedStanzaID(msg); got != "" {
		t.Fatalf("expected empty quoted id for plain conversation, got %q", got)
	}
}

func TestExtractQuotedStanzaID_ImageCaption(t *testing.T) {
	msg := &waProto.Message{
		ImageMessage: &waProto.ImageMessage{
			Caption: strPtr("respondendo com imagem"),
			ContextInfo: &waProto.ContextInfo{
				StanzaID: strPtr("3EB0IMG000000000001"),
			},
		},
	}
	got := extractQuotedStanzaID(msg)
	if got != "3EB0IMG000000000001" {
		t.Fatalf("expected quoted stanza id from image message, got %q", got)
	}
}

func TestExtractQuotedStanzaID_VideoDocumentAudio(t *testing.T) {
	video := &waProto.Message{
		VideoMessage: &waProto.VideoMessage{
			ContextInfo: &waProto.ContextInfo{StanzaID: strPtr("3EB0VID001")},
		},
	}
	if got := extractQuotedStanzaID(video); got != "3EB0VID001" {
		t.Fatalf("expected quoted stanza id from video message, got %q", got)
	}

	doc := &waProto.Message{
		DocumentMessage: &waProto.DocumentMessage{
			ContextInfo: &waProto.ContextInfo{StanzaID: strPtr("3EB0DOC001")},
		},
	}
	if got := extractQuotedStanzaID(doc); got != "3EB0DOC001" {
		t.Fatalf("expected quoted stanza id from document message, got %q", got)
	}

	audio := &waProto.Message{
		AudioMessage: &waProto.AudioMessage{
			ContextInfo: &waProto.ContextInfo{StanzaID: strPtr("3EB0AUD001")},
		},
	}
	if got := extractQuotedStanzaID(audio); got != "3EB0AUD001" {
		t.Fatalf("expected quoted stanza id from audio message, got %q", got)
	}
}

func TestExtractQuotedStanzaID_ExtendedTextWithoutContextInfoIsEmpty(t *testing.T) {
	msg := &waProto.Message{
		ExtendedTextMessage: &waProto.ExtendedTextMessage{Text: strPtr("sem citação")},
	}
	if got := extractQuotedStanzaID(msg); got != "" {
		t.Fatalf("expected empty quoted id without ContextInfo, got %q", got)
	}
}

func strPtr(s string) *string { return &s }
