package saasclient

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const turnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// CaptchaVerifier valida o token do CAPTCHA (Cloudflare Turnstile) no registro
// self-service. Ativo somente quando TURNSTILE_SECRET está setada — sem ela,
// Enabled() é false e o controller PULA a verificação (mesmo padrão de "stub
// de dev" já usado no ecossistema, ex.: PM_ENV=dev do plugin-manager: fail-open
// só em dev, nunca em produção com o segredo configurado). Quando ativo, uma
// falha de verificação OU o verificador inacessível rejeita a requisição
// (fail-closed) — nunca deixa passar silenciosamente um erro de rede.
type CaptchaVerifier struct {
	secret string
	http   *http.Client
}

// NewCaptchaVerifierFromEnv lê TURNSTILE_SECRET do ambiente.
func NewCaptchaVerifierFromEnv() *CaptchaVerifier {
	return &CaptchaVerifier{
		secret: os.Getenv("TURNSTILE_SECRET"),
		http:   &http.Client{Timeout: 10 * time.Second},
	}
}

// Enabled reporta se a verificação está configurada.
func (v *CaptchaVerifier) Enabled() bool {
	return strings.TrimSpace(v.secret) != ""
}

// Verify chama o endpoint siteverify da Cloudflare. Só deve ser chamado quando
// Enabled() é true — o chamador decide se pula a checagem em dev.
func (v *CaptchaVerifier) Verify(ctx context.Context, token, remoteIP string) (bool, error) {
	form := url.Values{}
	form.Set("secret", v.secret)
	form.Set("response", token)
	if remoteIP != "" {
		form.Set("remoteip", remoteIP)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, turnstileVerifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := v.http.Do(req)
	if err != nil {
		return false, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, err
	}
	var result struct {
		Success bool `json:"success"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return false, err
	}
	return result.Success, nil
}
