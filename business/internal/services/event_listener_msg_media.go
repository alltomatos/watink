package services

import (
	"context"
	"encoding/json"
	"log"
	"strconv"

	"github.com/alltomatos/watinkdev/business/internal/mediawait"
	"github.com/alltomatos/watinkdev/business/pkg/mediastore"
	"github.com/google/uuid"
)

// handleMediaDownloaded consumes the result of an on-demand media download from
// the engine: it persists the bytes, points the message at the stored file and
// flips its status to "downloaded", then notifies the frontend so the blurred
// placeholder is replaced by the real media.
func (el *EventListener) handleMediaDownloaded(ctx context.Context, payload json.RawMessage, tenantID uuid.UUID) error {
	messages := el.messages
	var p struct {
		MessageID string `json:"messageId"`
		MediaData string `json:"mediaData"`
		Mimetype  string `json:"mimetype"`
		Error     string `json:"error"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return err
	}
	if p.MessageID == "" {
		return nil
	}

	// Entrega direto para quem estiver aguardando este messageID via
	// mediawait.Waiter (ex.: AssistantRuntime transcrevendo um áudio) — os
	// bytes crus, sem depender do mediastore/DB abaixo terem terminado. Um
	// no-op quando ninguém está esperando (download normal via botão da UI).
	if el.mediaWaiter != nil {
		el.mediaWaiter.Fulfill(p.MessageID, mediawait.Result{MediaData: p.MediaData, MimeType: p.Mimetype, Err: p.Error})
	}

	msg, err := messages.FindByID(ctx, p.MessageID, tenantID)
	if err != nil || msg == nil {
		return nil
	}

	data := map[string]interface{}{}
	_ = json.Unmarshal([]byte(msg.DataJson), &data)

	emitFailed := func() error {
		data["mediaStatus"] = "failed"
		newData, _ := json.Marshal(data)
		_ = messages.Update(ctx, msg, map[string]interface{}{"dataJson": string(newData)})
		msg.DataJson = string(newData)
		el.bcast().EmitToRoom("/", "chat:"+strconv.Itoa(msg.TicketID), "appMessage", map[string]interface{}{"action": "update", "message": msg})
		return nil
	}

	if p.Error != "" || p.MediaData == "" {
		return emitFailed()
	}

	mimeType := p.Mimetype
	if mimeType == "" {
		if mt, ok := data["mimetype"].(string); ok {
			mimeType = mt
		}
	}

	mediaURL, err := mediastore.SaveMediaBase64(p.MediaData, mimeType)
	if err != nil {
		log.Printf("[EventListener] media download save failed (msg %s): %v", p.MessageID, err)
		return emitFailed()
	}

	data["mediaStatus"] = "downloaded"
	// Drop the heavy serialized proto now that the media is stored locally.
	delete(data, "mediaProto")
	newData, _ := json.Marshal(data)

	if err := messages.Update(ctx, msg, map[string]interface{}{"mediaUrl": mediaURL, "dataJson": string(newData)}); err != nil {
		return err
	}
	msg.MediaUrl = mediaURL
	msg.DataJson = string(newData)

	el.bcast().EmitToRoom("/", "chat:"+strconv.Itoa(msg.TicketID), "appMessage", map[string]interface{}{"action": "update", "message": msg})
	return nil
}
