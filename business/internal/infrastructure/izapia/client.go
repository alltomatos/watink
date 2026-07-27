// Package izapia implements domain.WhatsAppEngine against the izapia data-plane
// HTTP API (api.izapia.com) — a SaaS that hosts and operates the WhatsApp
// session itself (unlike engine-go/whatsmeow, which the business must drive
// via AMQP). See docs/agents/ (izapia provider) for the architectural context.
package izapia

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// DefaultBaseURL is used when a tenant's IzapiaConfig.BaseURL is empty.
const DefaultBaseURL = "https://api.izapia.com"

// envelope is the canonical shape of every izapia data-plane response:
// success -> {ok:true, data}; error -> {ok:false, error:{code,message}}.
type envelope struct {
	OK    bool            `json:"ok"`
	Data  json.RawMessage `json:"data"`
	Error *apiError       `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *apiError) Error() string {
	if e == nil {
		return "izapia: erro desconhecido"
	}
	return fmt.Sprintf("izapia: %s: %s", e.Code, e.Message)
}

// Client is a thin, stateless HTTP client for the izapia data-plane API.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient builds a Client for a single tenant's credentials. baseURL falls
// back to DefaultBaseURL when empty.
func NewClient(baseURL, apiKey string) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

func (c *Client) do(ctx context.Context, method, path string, body interface{}, out interface{}) error {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("izapia: encode request: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("izapia: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("izapia: request %s %s: %w", method, path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("izapia: read response %s %s: %w", method, path, err)
	}

	var env envelope
	if err := json.Unmarshal(respBody, &env); err != nil {
		return fmt.Errorf("izapia: decode response %s %s (status %d): %w", method, path, resp.StatusCode, err)
	}
	if !env.OK {
		if env.Error != nil {
			return env.Error
		}
		return fmt.Errorf("izapia: %s %s falhou (status %d)", method, path, resp.StatusCode)
	}
	if out != nil && len(env.Data) > 0 {
		if err := json.Unmarshal(env.Data, out); err != nil {
			return fmt.Errorf("izapia: decode data %s %s: %w", method, path, err)
		}
	}
	return nil
}

// CreateSession creates an unpaired session and returns its izapia session id.
func (c *Client) CreateSession(ctx context.Context, name, cityHint string) (string, error) {
	body := map[string]string{}
	if name != "" {
		body["name"] = name
	}
	if cityHint != "" {
		body["city_hint"] = cityHint
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := c.do(ctx, http.MethodPost, "/api/v1/sessions/", body, &out); err != nil {
		return "", err
	}
	return out.ID, nil
}

// PairResult holds the QR pairing response.
type PairResult struct {
	Code        string `json:"code"`
	QRPngBase64 string `json:"qr_png_base64"`
}

// Pair starts QR-code pairing for a session.
func (c *Client) Pair(ctx context.Context, sid string) (*PairResult, error) {
	var out PairResult
	if err := c.do(ctx, http.MethodPost, "/api/v1/sessions/"+sid+"/pair", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// PairPhone starts phone-code pairing (no QR) for a session.
func (c *Client) PairPhone(ctx context.Context, sid, phone string) (string, error) {
	var out struct {
		PairingCode string `json:"pairing_code"`
	}
	body := map[string]string{"phone": phone}
	if err := c.do(ctx, http.MethodPost, "/api/v1/sessions/"+sid+"/pair/phone", body, &out); err != nil {
		return "", err
	}
	return out.PairingCode, nil
}

// Logout invalidates the session on the WhatsApp side (soft — the izapia
// session row itself is not deleted; a subsequent Pair re-activates it).
// There is no hard-delete operation exposed by the data-plane API.
func (c *Client) Logout(ctx context.Context, sid string) error {
	return c.do(ctx, http.MethodPost, "/api/v1/sessions/"+sid+"/logout", nil, nil)
}

// SendText sends a plain text message and returns the provider message id.
func (c *Client) SendText(ctx context.Context, sid, to, text string) (string, error) {
	var out struct {
		MessageID string `json:"message_id"`
	}
	body := map[string]string{"to": to, "text": text}
	if err := c.do(ctx, http.MethodPost, "/api/v1/sessions/"+sid+"/messages/text", body, &out); err != nil {
		return "", err
	}
	return out.MessageID, nil
}

// SendMedia sends a media message by URL (kind inferred from mimeType by the
// caller) and returns the provider message id.
func (c *Client) SendMedia(ctx context.Context, sid, to, kind, url, mimetype, caption string) (string, error) {
	var out struct {
		MessageID string `json:"message_id"`
	}
	body := map[string]string{"to": to, "kind": kind, "url": url}
	if mimetype != "" {
		body["mimetype"] = mimetype
	}
	if caption != "" {
		body["caption"] = caption
	}
	if err := c.do(ctx, http.MethodPost, "/api/v1/sessions/"+sid+"/messages/media", body, &out); err != nil {
		return "", err
	}
	return out.MessageID, nil
}

// InteractiveButtonReq is one button of a messages/interactive request. Kind
// is quick_reply|url|call|copy|list — "list" carries its own sub-menu in
// List instead of Value, and at most one such button may appear per message.
type InteractiveButtonReq struct {
	ID    string                   `json:"id,omitempty"`
	Kind  string                   `json:"kind"`
	Label string                   `json:"label,omitempty"`
	Value string                   `json:"value,omitempty"`
	List  []InteractiveListSection `json:"list,omitempty"`
}

type InteractiveListSection struct {
	Title string               `json:"title,omitempty"`
	Rows  []InteractiveListRow `json:"rows,omitempty"`
}

type InteractiveListRow struct {
	ID          string `json:"id,omitempty"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
}

// SendInteractive sends a buttons-or-list message and returns the provider
// message id. Up to 3 display buttons OR exactly 1 list button.
func (c *Client) SendInteractive(ctx context.Context, sid, to, body string, buttons []InteractiveButtonReq) (string, error) {
	var out struct {
		MessageID string `json:"message_id"`
	}
	reqBody := map[string]interface{}{"to": to, "body": body, "buttons": buttons}
	if err := c.do(ctx, http.MethodPost, "/api/v1/sessions/"+sid+"/messages/interactive", reqBody, &out); err != nil {
		return "", err
	}
	return out.MessageID, nil
}

// SendPoll sends a poll and returns the provider message id.
func (c *Client) SendPoll(ctx context.Context, sid, to, name string, options []string, selectableCount int) (string, error) {
	var out struct {
		MessageID string `json:"message_id"`
	}
	body := map[string]interface{}{"to": to, "name": name, "options": options, "selectable_count": selectableCount}
	if err := c.do(ctx, http.MethodPost, "/api/v1/sessions/"+sid+"/messages/poll", body, &out); err != nil {
		return "", err
	}
	return out.MessageID, nil
}

// CarouselCardReq is one card of a messages/carousel request. Buttons accept
// only quick_reply|url|call|copy (no "list" — stricter than SendInteractive).
type CarouselCardReq struct {
	ImageURL string                 `json:"image_url,omitempty"`
	Mimetype string                 `json:"mimetype,omitempty"`
	Title    string                 `json:"title,omitempty"`
	Buttons  []InteractiveButtonReq `json:"buttons,omitempty"`
}

// SendCarousel sends an (EXPERIMENTAL, per izapia's own API) carousel and
// returns the provider message id + a warning the API always attaches (its
// on-device rendering has never been validated by izapia — see PRD §14).
// The experimental:true opt-in is always set; without it the API rejects the
// request outright with 400 EXPERIMENTAL_OPT_IN_REQUIRED.
func (c *Client) SendCarousel(ctx context.Context, sid, to, body string, cards []CarouselCardReq) (messageID, warning string, err error) {
	var out struct {
		MessageID string `json:"message_id"`
		Warning   string `json:"warning"`
	}
	reqBody := map[string]interface{}{"to": to, "body": body, "experimental": true, "cards": cards}
	if err := c.do(ctx, http.MethodPost, "/api/v1/sessions/"+sid+"/messages/carousel", reqBody, &out); err != nil {
		return "", "", err
	}
	return out.MessageID, out.Warning, nil
}

// SetWebhook configures the session's inbound event webhook.
func (c *Client) SetWebhook(ctx context.Context, sid, url, secret string, events []string) error {
	body := map[string]interface{}{"url": url, "secret": secret}
	if len(events) > 0 {
		body["events"] = events
	}
	return c.do(ctx, http.MethodPut, "/api/v1/sessions/"+sid+"/webhook", body, nil)
}
