package whatsapp

import (
	"context"
	"errors"
	"fmt"
	"log"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// getCachedPic returns the profile picture URL for the given JID, using an
// in-memory cache to avoid a WhatsApp CDN round-trip on every message.
func (s *WhatsAppService) getCachedPic(client *whatsmeow.Client, sessionID int, tenantID string, jid types.JID) string {
	key := jid.String()
	s.picMu.Lock()
	if url, ok := s.picCache[key]; ok {
		s.picMu.Unlock()
		return url
	}
	s.picMu.Unlock()

	url := ""
	info, err := client.GetProfilePictureInfo(context.Background(), jid, &whatsmeow.GetProfilePictureParams{})
	if err == nil && info != nil {
		url = info.URL
	} else if err != nil && !errors.Is(err, whatsmeow.ErrProfilePictureNotSet) && !errors.Is(err, whatsmeow.ErrProfilePictureUnauthorized) {
		// "não tem foto" e "privacidade escondeu de mim" são esperados e
		// silenciosos; qualquer outro erro (rate-limit, rede, etc.) é
		// acionável e não deve desaparecer sem rastro.
		log.Printf("[Picture] GetProfilePictureInfo(%s) failed: %v", key, err)
		s.reportIfRiskSignal(sessionID, tenantID, "profile.picture", err)
	}
	if url != "" {
		s.picMu.Lock()
		s.picCache[key] = url
		s.picMu.Unlock()
	}
	return url
}

// resolvePicJID resolves the JID to use for a profile-picture lookup.
// LID senders (@lid) cannot be queried directly — GetProfilePictureInfo needs
// the underlying phone-number JID, resolved via the LID→PN store mapping.
// Returns ok=false when no picture-fetchable JID is available (LID with no
// resolved PN yet).
func (s *WhatsAppService) resolvePicJID(client *whatsmeow.Client, jid types.JID) (types.JID, bool) {
	if jid.Server != types.HiddenUserServer {
		return jid.ToNonAD(), true
	}
	pn, err := client.Store.LIDs.GetPNForLID(context.Background(), jid)
	if err != nil || pn.IsEmpty() {
		return types.JID{}, false
	}
	return pn.ToNonAD(), true
}

// handlePictureEvent fires when a contact or group changes its profile picture.
// It invalidates the local cache and publishes a contact.update event so the
// backend can persist the new URL immediately — without waiting for the next message.
func (s *WhatsAppService) handlePictureEvent(client *whatsmeow.Client, id int, tenantID string, v *events.Picture) {
	key := v.JID.String()

	// Invalidate cache entry so getCachedPic fetches fresh on next use.
	s.picMu.Lock()
	delete(s.picCache, key)
	s.picMu.Unlock()

	newURL := ""
	if !v.Remove {
		if info, err := client.GetProfilePictureInfo(context.Background(), v.JID.ToNonAD(), &whatsmeow.GetProfilePictureParams{}); err == nil && info != nil {
			newURL = info.URL
			s.picMu.Lock()
			s.picCache[key] = newURL
			s.picMu.Unlock()
		}
	}

	s.publishEvent(tenantID, id, "contact.update", map[string]interface{}{
		"sessionId": fmt.Sprintf("%d", id),
		"contact": map[string]interface{}{
			"jid":           v.JID.String(),
			"profilePicUrl": newURL,
		},
	})
	log.Printf("[Picture] %s photo updated (remove=%v)", key, v.Remove)
}
