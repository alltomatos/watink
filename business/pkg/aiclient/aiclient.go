package aiclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"
)

// rewriteDevHost rewrites a localhost/127.0.0.1 BaseURL host to the value of
// AI_BASEURL_HOST_REWRITE (e.g. host.docker.internal) so a containerized service
// can reach an AI gateway running on the Docker host in dev. No-op when the env
// var is unset or the BaseURL is a real domain — production is unaffected.
func rewriteDevHost(baseURL string) string {
	rw := os.Getenv("AI_BASEURL_HOST_REWRITE")
	if rw == "" || baseURL == "" {
		return baseURL
	}
	for _, h := range []string{"localhost", "127.0.0.1"} {
		baseURL = strings.ReplaceAll(baseURL, h, rw)
	}
	return baseURL
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Config struct {
	Provider string // "openai" | "anthropic" | "grok" | "custom"
	Model    string
	APIKey   string
	BaseURL  string // only used for "custom"
	System   string // optional system prompt
}

type Response struct {
	Content string
}

// Complete sends messages to the configured LLM and returns the assistant reply.
func Complete(cfg Config, messages []Message) (*Response, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("ERR_NO_AI_API_KEY")
	}

	cfg.BaseURL = rewriteDevHost(cfg.BaseURL)

	switch cfg.Provider {
	case "anthropic":
		return callAnthropic(cfg, messages)
	case "openai", "grok", "custom":
		return callOpenAICompatible(cfg, messages)
	default:
		return callOpenAICompatible(cfg, messages)
	}
}

func callOpenAICompatible(cfg Config, messages []Message) (*Response, error) {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		switch cfg.Provider {
		case "grok":
			baseURL = "https://api.x.ai/v1"
		default:
			baseURL = "https://api.openai.com/v1"
		}
	}

	model := cfg.Model
	if model == "" {
		model = "gpt-4o"
	}

	payload := map[string]any{
		"model":    model,
		"messages": messages,
		// Some OpenAI-compatible gateways (omniroute) default to a streamed
		// (text/event-stream) response, which this single-shot JSON decoder cannot
		// parse. Force a non-streaming response.
		"stream": false,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: status %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: empty response")
	}

	return &Response{Content: result.Choices[0].Message.Content}, nil
}

// resolveOpenAIBaseURL centraliza a mesma regra de baseURL default usada por
// callOpenAICompatible — /audio/transcriptions e /audio/speech vivem no MESMO
// baseUrl do chat, só variam de path.
func resolveOpenAIBaseURL(cfg Config) string {
	if cfg.BaseURL != "" {
		return cfg.BaseURL
	}
	return "https://api.openai.com/v1"
}

// Transcribe envia audioBytes para {baseURL}/audio/transcriptions (OpenAI-
// compatible: multipart/form-data, campo "file" + "model") e devolve o texto
// resultante. model é obrigatório (não há default seguro — nomes de modelo
// de transcrição variam muito entre gateways, ex. "whisper-1" pode não ter
// credencial num gateway multi-provider onde só "openrouter/openai/whisper-
// large-v3-turbo" está funded).
func Transcribe(cfg Config, model string, audioBytes []byte, filename string) (string, error) {
	if cfg.APIKey == "" {
		return "", fmt.Errorf("ERR_NO_AI_API_KEY")
	}
	if model == "" {
		return "", fmt.Errorf("ERR_NO_TRANSCRIPTION_MODEL")
	}
	baseURL := rewriteDevHost(resolveOpenAIBaseURL(cfg))

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	if _, err := fw.Write(audioBytes); err != nil {
		return "", fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	if err := w.WriteField("model", model); err != nil {
		return "", fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	if err := w.Close(); err != nil {
		return "", fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}

	req, err := http.NewRequest("POST", baseURL+"/audio/transcriptions", &buf)
	if err != nil {
		return "", fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ERR_AI_SERVICE_FAILED: status %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	return result.Text, nil
}

// SpeechResult carries synthesized audio bytes and their MIME type.
type SpeechResult struct {
	Audio    []byte
	MimeType string
}

// Speech envia text para {baseURL}/audio/speech (OpenAI-compatible: JSON
// {model,input,voice}) e devolve o áudio sintetizado. voice é opcional —
// vazio deixa o gateway escolher a voz padrão do modelo.
func Speech(cfg Config, model, text, voice string) (*SpeechResult, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("ERR_NO_AI_API_KEY")
	}
	if model == "" {
		return nil, fmt.Errorf("ERR_NO_SPEECH_MODEL")
	}
	baseURL := rewriteDevHost(resolveOpenAIBaseURL(cfg))

	payload := map[string]any{"model": model, "input": text}
	if voice != "" {
		payload["voice"] = voice
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", baseURL+"/audio/speech", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: status %d: %s", resp.StatusCode, string(b))
	}

	audio, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	mimeType := resp.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "audio/mpeg"
	}
	return &SpeechResult{Audio: audio, MimeType: mimeType}, nil
}

// ListModels consulta {baseURL}/models (OpenAI-compatible: GET, resposta
// {data: [{id: "..."}]}) e devolve os IDs de modelo disponíveis na conta do
// gateway — usado pela UI para sugerir modelos reais em vez de só uma lista
// estática, já que nomes de modelo (principalmente de transcrição/fala)
// variam muito entre provedores/gateways multi-tenant.
func ListModels(cfg Config) ([]string, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("ERR_NO_AI_API_KEY")
	}
	baseURL := rewriteDevHost(resolveOpenAIBaseURL(cfg))

	req, err := http.NewRequest("GET", baseURL+"/models", nil)
	if err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: status %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	models := make([]string, 0, len(result.Data))
	for _, m := range result.Data {
		if m.ID != "" {
			models = append(models, m.ID)
		}
	}
	return models, nil
}

func callAnthropic(cfg Config, messages []Message) (*Response, error) {
	model := cfg.Model
	if model == "" {
		model = "claude-3-5-sonnet-20241022"
	}

	type anthropicMsg struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	var msgs []anthropicMsg
	for _, m := range messages {
		role := m.Role
		if role == "assistant" || role == "user" {
			msgs = append(msgs, anthropicMsg{Role: role, Content: m.Content})
		}
	}

	payload := map[string]any{
		"model":      model,
		"max_tokens": 1024,
		"messages":   msgs,
	}
	if cfg.System != "" {
		payload["system"] = cfg.System
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: status %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: %w", err)
	}
	for _, c := range result.Content {
		if c.Type == "text" {
			return &Response{Content: c.Text}, nil
		}
	}

	return nil, fmt.Errorf("ERR_AI_SERVICE_FAILED: no text content in response")
}
