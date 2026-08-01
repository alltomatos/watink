package plugins

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/models"
	"github.com/alltomatos/watinkdev/business/pkg/cryptobox"
	"github.com/gin-gonic/gin"
)

func TestToAiGatewayResponse_NeverLeaksApiKey(t *testing.T) {
	g := models.AiGateway{
		ID: 1, Name: "OpenAI principal", Provider: "openai",
		Model: "gpt-4o", ApiKeyEnc: "ENCRYPTED_SECRET_CIPHERTEXT",
	}
	resp := toAiGatewayResponse(g)

	if _, exists := resp["apiKey"]; exists {
		t.Fatal("response must not contain 'apiKey'")
	}
	if _, exists := resp["apiKeyEnc"]; exists {
		t.Fatal("response must not contain 'apiKeyEnc'")
	}
	for _, v := range resp {
		if s, ok := v.(string); ok && s == "ENCRYPTED_SECRET_CIPHERTEXT" {
			t.Fatal("ciphertext leaked into response")
		}
	}
	if resp["hasApiKey"] != true {
		t.Fatalf("hasApiKey should be true, got %v", resp["hasApiKey"])
	}
}

func TestToAiGatewayResponse_HasApiKeyFalseWhenEmpty(t *testing.T) {
	g := models.AiGateway{ID: 2, Name: "Sem chave", Provider: "openai", Model: "gpt-4o"}
	resp := toAiGatewayResponse(g)
	if resp["hasApiKey"] != false {
		t.Fatalf("hasApiKey should be false, got %v", resp["hasApiKey"])
	}
}

func TestValidateAiGatewayStrings_RejectsOverLongName(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/ai-gateways", nil)

	longName := make([]byte, 121)
	for i := range longName {
		longName[i] = 'a'
	}
	in := aiGatewayInput{Name: string(longName), Provider: "openai", Model: "gpt-4o"}
	if validateAiGatewayStrings(c, in) {
		t.Fatal("expected validation to reject a name over 120 chars")
	}
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestValidateAiGatewayStrings_AcceptsValidInput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/ai-gateways", nil)

	in := aiGatewayInput{Name: "OpenAI principal", Provider: "openai", Model: "gpt-4o", ApiKey: "sk-test"}
	if !validateAiGatewayStrings(c, in) {
		t.Fatal("expected valid input to pass validation")
	}
}

// TestAiGatewayApiKey_FailsClosedWithoutMasterKey exercises the fail-closed
// invariant directly against cryptobox: this test package's binary never
// sets PROXY_ENC_KEY (unlike business/pkg/cryptobox's own TestMain), so
// IsConfigured() must report false — the same guard AiGatewayController.Create/
// Update rely on before ever calling Encrypt.
func TestAiGatewayApiKey_FailsClosedWithoutMasterKey(t *testing.T) {
	if cryptobox.IsConfigured() {
		t.Skip("PROXY_ENC_KEY is configured in this test binary — fail-closed path not exercisable here")
	}
	if _, err := cryptobox.Encrypt("some-api-key"); err != cryptobox.ErrNotConfigured {
		t.Fatalf("expected ErrNotConfigured, got %v", err)
	}
}
