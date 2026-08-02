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

func strPtr(s string) *string { return &s }
