package whatsapp

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"time"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"google.golang.org/protobuf/proto"
)

// DownloadMediaCommandPayload carries everything needed to download a media
// message on demand. The media is NOT downloaded when the message first arrives
// (that would stall the real-time event loop); instead the serialized media
// proto travels to the backend and comes back here when the operator clicks
// "download".
type DownloadMediaCommandPayload struct {
	SessionID  int    `json:"sessionId"`
	MessageID  string `json:"messageId"`
	MediaType  string `json:"mediaType"`
	MediaProto string `json:"mediaProto"` // base64 proto.Marshal of the media message
}

// DownloadMedia decodes the stored media proto, downloads the full media from
// WhatsApp servers and publishes a "message.media" event with the base64 bytes.
func (s *WhatsAppService) DownloadMedia(sessionID int, tenantID string, payload DownloadMediaCommandPayload) error {
	client, err := s.getConnectedClient(sessionID)
	if err != nil {
		s.publishMediaDownloaded(tenantID, sessionID, payload.MessageID, "", "", "session not connected")
		return err
	}

	raw, err := base64.StdEncoding.DecodeString(payload.MediaProto)
	if err != nil {
		s.publishMediaDownloaded(tenantID, sessionID, payload.MessageID, "", "", "invalid media proto")
		return fmt.Errorf("decode media proto: %w", err)
	}

	dl, mimeType, err := downloadableFromProto(payload.MediaType, raw)
	if err != nil {
		s.publishMediaDownloaded(tenantID, sessionID, payload.MessageID, "", "", err.Error())
		return err
	}

	// Instrumentação temporária de diagnóstico (round-trip do download de
	// mídia medido em ~90-120s em homolog, sem explicação de rede/fila já
	// descartadas) — mede exatamente o tempo gasto DENTRO da chamada
	// whatsmeow, isolando-a do resto do pipeline (AMQP, mediawait etc.).
	downloadStart := time.Now()
	log.Printf("[media.download] iniciando client.Download messageId=%s mediaType=%s", payload.MessageID, payload.MediaType)
	data, err := client.Download(context.Background(), dl)
	elapsed := time.Since(downloadStart)
	if err != nil {
		log.Printf("[media.download] client.Download FALHOU messageId=%s apos %s: %v", payload.MessageID, elapsed, err)
		s.publishMediaDownloaded(tenantID, sessionID, payload.MessageID, "", mimeType, err.Error())
		return fmt.Errorf("download media: %w", err)
	}
	log.Printf("[media.download] client.Download OK messageId=%s bytes=%d em %s", payload.MessageID, len(data), elapsed)

	s.publishMediaDownloaded(tenantID, sessionID, payload.MessageID, base64.StdEncoding.EncodeToString(data), mimeType, "")
	return nil
}

// downloadableFromProto reconstructs the concrete whatsmeow DownloadableMessage
// from the stored media type + serialized proto.
func downloadableFromProto(mediaType string, raw []byte) (whatsmeow.DownloadableMessage, string, error) {
	switch mediaType {
	case "image":
		m := &waProto.ImageMessage{}
		if err := proto.Unmarshal(raw, m); err != nil {
			return nil, "", fmt.Errorf("unmarshal image proto: %w", err)
		}
		return m, m.GetMimetype(), nil
	case "video":
		m := &waProto.VideoMessage{}
		if err := proto.Unmarshal(raw, m); err != nil {
			return nil, "", fmt.Errorf("unmarshal video proto: %w", err)
		}
		return m, m.GetMimetype(), nil
	case "audio":
		m := &waProto.AudioMessage{}
		if err := proto.Unmarshal(raw, m); err != nil {
			return nil, "", fmt.Errorf("unmarshal audio proto: %w", err)
		}
		return m, m.GetMimetype(), nil
	case "document":
		m := &waProto.DocumentMessage{}
		if err := proto.Unmarshal(raw, m); err != nil {
			return nil, "", fmt.Errorf("unmarshal document proto: %w", err)
		}
		return m, m.GetMimetype(), nil
	case "sticker":
		m := &waProto.StickerMessage{}
		if err := proto.Unmarshal(raw, m); err != nil {
			return nil, "", fmt.Errorf("unmarshal sticker proto: %w", err)
		}
		return m, m.GetMimetype(), nil
	default:
		return nil, "", fmt.Errorf("unsupported media type: %s", mediaType)
	}
}

// publishMediaDownloaded emits the result of an on-demand media download. A
// non-empty error field tells the backend the download failed.
func (s *WhatsAppService) publishMediaDownloaded(tenantID string, sessionID int, messageID, mediaData, mimeType, errMsg string) {
	s.publishEvent(tenantID, sessionID, "message.media", map[string]interface{}{
		"sessionId": fmt.Sprintf("%d", sessionID),
		"messageId": messageID,
		"mediaData": mediaData,
		"mimetype":  mimeType,
		"error":     errMsg,
	})
}
