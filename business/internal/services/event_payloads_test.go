package services

import (
	"encoding/json"
	"testing"
)

func TestEventEnvelope_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name     string
		input    EventEnvelope
		wantType string
		wantTID  string
	}{
		{
			name: "qrcode event",
			input: EventEnvelope{
				Type:     "qrcode",
				Payload:  json.RawMessage(`{"sessionId":"s1","qrcode":"abc"}`),
				TenantID: "tenant-1",
			},
			wantType: "qrcode",
			wantTID:  "tenant-1",
		},
		{
			name: "empty payload",
			input: EventEnvelope{
				Type:     "ping",
				Payload:  json.RawMessage(`{}`),
				TenantID: "t2",
			},
			wantType: "ping",
			wantTID:  "t2",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}

			var got EventEnvelope
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}

			if got.Type != tc.wantType {
				t.Errorf("Type: got %q, want %q", got.Type, tc.wantType)
			}
			if got.TenantID != tc.wantTID {
				t.Errorf("TenantID: got %q, want %q", got.TenantID, tc.wantTID)
			}
		})
	}
}

func TestQrCodePayload_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input QrCodePayload
	}{
		{name: "basic", input: QrCodePayload{SessionID: "ses1", QrCode: "data:image/png;base64,abc"}},
		{name: "empty", input: QrCodePayload{}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got QrCodePayload
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got != tc.input {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
		})
	}
}

func TestPairingCodePayload_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input PairingCodePayload
	}{
		{name: "pending", input: PairingCodePayload{SessionID: "s1", PairingCode: "1234-5678", Status: "pending"}},
		{name: "confirmed", input: PairingCodePayload{SessionID: "s2", PairingCode: "ABCD-EFGH", Status: "confirmed"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got PairingCodePayload
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got != tc.input {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
		})
	}
}

func TestSessionStatusPayload_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input SessionStatusPayload
	}{
		{
			name: "first connection",
			input: SessionStatusPayload{
				SessionID:       "ses1",
				Status:          "connected",
				Number:          "5511999999999",
				ProfilePicUrl:   "https://example.com/pic.jpg",
				FirstConnection: true,
			},
		},
		{
			name: "reconnect",
			input: SessionStatusPayload{
				SessionID:       "ses2",
				Status:          "disconnected",
				Number:          "",
				ProfilePicUrl:   "",
				FirstConnection: false,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got SessionStatusPayload
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got != tc.input {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
		})
	}
}

func TestMessagePayload_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input MessagePayload
	}{
		{
			name: "text from group",
			input: MessagePayload{
				ID:          "msg-1",
				From:        "5511999@g.us",
				Body:        "hello world",
				Type:        "chat",
				FromMe:      false,
				Timestamp:   1700000000,
				PushName:    "Alice",
				GroupName:   "Team Chat",
				IsGroup:     true,
				IsCommunity: false,
			},
		},
		{
			name: "media from me",
			input: MessagePayload{
				ID:        "msg-2",
				From:      "5511888@s.whatsapp.net",
				Body:      "",
				Type:      "image",
				FromMe:    true,
				Timestamp: 1700001000,
				MediaUrl:  "https://cdn.example.com/img.jpg",
				Mimetype:  "image/jpeg",
			},
		},
		{
			name: "subgroup community",
			input: MessagePayload{
				IsSubGroup:  true,
				IsCommunity: true,
				IsLid:       true,
				Participant: "5511777@lid",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got MessagePayload
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got != tc.input {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
		})
	}
}

func TestMessageReceivedPayload_JSONRoundtrip(t *testing.T) {
	input := MessageReceivedPayload{
		SessionID: "ses1",
		Message: MessagePayload{
			ID:   "msg-x",
			From: "5511@s.whatsapp.net",
			Body: "test",
			Type: "chat",
		},
	}

	data, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got MessageReceivedPayload
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.SessionID != input.SessionID || got.Message != input.Message {
		t.Errorf("got %+v, want %+v", got, input)
	}
}

func TestHistorySyncPayload_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input HistorySyncPayload
	}{
		{
			name: "with messages",
			input: HistorySyncPayload{
				SessionID: "ses1",
				Type:      "full",
				Progress:  75,
				TicketID:  42,
				Messages: []MessagePayload{
					{ID: "m1", Body: "hi"},
					{ID: "m2", Body: "bye"},
				},
			},
		},
		{
			name: "empty messages",
			input: HistorySyncPayload{
				SessionID: "ses2",
				Type:      "partial",
				Progress:  0,
				TicketID:  0,
				Messages:  []MessagePayload{},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got HistorySyncPayload
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got.SessionID != tc.input.SessionID ||
				got.Type != tc.input.Type ||
				got.Progress != tc.input.Progress ||
				got.TicketID != tc.input.TicketID ||
				len(got.Messages) != len(tc.input.Messages) {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
			for i := range got.Messages {
				if got.Messages[i] != tc.input.Messages[i] {
					t.Errorf("Messages[%d]: got %+v, want %+v", i, got.Messages[i], tc.input.Messages[i])
				}
			}
		})
	}
}

func TestMessageReactionPayload_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input MessageReactionPayload
	}{
		{
			name: "emoji reaction",
			input: MessageReactionPayload{
				SessionID: "ses1",
				MessageID: "msg-1",
				JID:       "5511@s.whatsapp.net",
				Reaction:  "👍",
				Sender:    "5511@s.whatsapp.net",
				FromMe:    false,
				Timestamp: 1700000000,
			},
		},
		{
			name: "remove reaction",
			input: MessageReactionPayload{
				SessionID: "ses1",
				MessageID: "msg-2",
				JID:       "5511@s.whatsapp.net",
				Reaction:  "",
				Sender:    "5511@s.whatsapp.net",
				FromMe:    true,
				Timestamp: 1700001000,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got MessageReactionPayload
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got != tc.input {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
		})
	}
}

func TestMessageRevokePayload_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input MessageRevokePayload
	}{
		{
			name: "revoke from other",
			input: MessageRevokePayload{
				SessionID: "ses1",
				MessageID: "msg-1",
				FromJID:   "5511@s.whatsapp.net",
				FromMe:    false,
			},
		},
		{
			name: "revoke from me",
			input: MessageRevokePayload{
				SessionID: "ses1",
				MessageID: "msg-2",
				FromJID:   "5511@s.whatsapp.net",
				FromMe:    true,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got MessageRevokePayload
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got != tc.input {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
		})
	}
}

func TestContactUpdatePayload_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input ContactUpdatePayload
	}{
		{
			name: "full contact",
			input: ContactUpdatePayload{
				SessionID: "ses1",
				Contact: struct {
					JID           string `json:"jid"`
					Number        string `json:"number"`
					Name          string `json:"name"`
					PushName      string `json:"pushName"`
					ProfilePicUrl string `json:"profilePicUrl"`
				}{
					JID:           "5511@s.whatsapp.net",
					Number:        "5511999999999",
					Name:          "Alice",
					PushName:      "Al",
					ProfilePicUrl: "https://example.com/pic.jpg",
				},
			},
		},
		{
			name: "minimal contact",
			input: ContactUpdatePayload{
				SessionID: "ses2",
				Contact: struct {
					JID           string `json:"jid"`
					Number        string `json:"number"`
					Name          string `json:"name"`
					PushName      string `json:"pushName"`
					ProfilePicUrl string `json:"profilePicUrl"`
				}{
					JID: "5522@s.whatsapp.net",
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got ContactUpdatePayload
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got != tc.input {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
		})
	}
}

func TestContactImportPayload_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input ContactImportPayload
	}{
		{
			name: "multiple contacts",
			input: ContactImportPayload{
				SessionID: "ses1",
				Contacts: []ImportedContact{
					{JID: "5511@s.whatsapp.net", Number: "5511999999999", Name: "Alice", PushName: "Al"},
					{JID: "5522@s.whatsapp.net", Number: "5522888888888", Name: "Bob", PushName: "Bobby"},
				},
			},
		},
		{
			name: "empty contacts",
			input: ContactImportPayload{
				SessionID: "ses2",
				Contacts:  []ImportedContact{},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got ContactImportPayload
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got.SessionID != tc.input.SessionID || len(got.Contacts) != len(tc.input.Contacts) {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
			for i := range got.Contacts {
				if got.Contacts[i] != tc.input.Contacts[i] {
					t.Errorf("Contacts[%d]: got %+v, want %+v", i, got.Contacts[i], tc.input.Contacts[i])
				}
			}
		})
	}
}

func TestImportedContact_JSONRoundtrip(t *testing.T) {
	cases := []struct {
		name  string
		input ImportedContact
	}{
		{name: "full", input: ImportedContact{JID: "5511@s.whatsapp.net", Number: "5511999", Name: "Alice", PushName: "Al"}},
		{name: "empty", input: ImportedContact{}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got ImportedContact
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got != tc.input {
				t.Errorf("got %+v, want %+v", got, tc.input)
			}
		})
	}
}

func TestEventEnvelope_PayloadUnmarshal(t *testing.T) {
	// Verifies that EventEnvelope.Payload can be further unmarshalled into a concrete type
	qr := QrCodePayload{SessionID: "ses1", QrCode: "abc123"}
	payloadBytes, err := json.Marshal(qr)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	envelope := EventEnvelope{
		Type:     "qrcode",
		Payload:  json.RawMessage(payloadBytes),
		TenantID: "tenant-1",
	}

	envelopeBytes, err := json.Marshal(envelope)
	if err != nil {
		t.Fatalf("marshal envelope: %v", err)
	}

	var gotEnvelope EventEnvelope
	if err := json.Unmarshal(envelopeBytes, &gotEnvelope); err != nil {
		t.Fatalf("unmarshal envelope: %v", err)
	}

	var gotQr QrCodePayload
	if err := json.Unmarshal(gotEnvelope.Payload, &gotQr); err != nil {
		t.Fatalf("unmarshal inner payload: %v", err)
	}

	if gotQr != qr {
		t.Errorf("inner payload: got %+v, want %+v", gotQr, qr)
	}
}
