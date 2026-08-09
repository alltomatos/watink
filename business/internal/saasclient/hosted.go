// hosted.go implementa o registro inicial no Watink SaaS HOSPEDADO (issue
// #632, ADR 0009 do watink-saas): distinto do Client desta package (que fala
// com uma instância JÁ pareada, via token). Aqui ainda não existe token — é
// exatamente essa chamada que gera o primeiro. Por isso a URL é FIXA
// (SaaSHostedBaseURL), nunca configurável — mesmo padrão do Hub central
// (hub/mcp): só a credencial muda, o endereço nunca.
package saasclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// SaaSHostedBaseURL é o único Watink SaaS hospedado do ecossistema — mesmo
// princípio do Hub (hubclient.HubBaseURL): hardcoded em produção (nunca lido
// de env — elimina a classe de bug "empreendedor aponta para um SaaS
// errado"). `var`, não `const`, só para os testes deste pacote apontarem a
// um httptest.Server; nenhum código de produção reatribui isto.
//
// Aponta para saashomol.watink.com (homologação/teste real) — saas.watink.com
// é reservado para a produção comercial futura e ainda não existe (docs/ops.md
// do watink-saas). Trocar aqui quando a produção comercial for ao ar.
var SaaSHostedBaseURL = "https://saashomol.watink.com"

// HostedRegisterRequest é o corpo de POST /public/operators/register
// (watink-saas#29).
type HostedRegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Whatsapp string `json:"whatsapp"`
	Document string `json:"document"`
	Password string `json:"password"`
}

// HostedRegisterResult é o corpo 200/201 da resposta. InternalToken só vem
// preenchido na primeira chamada — reenvio idempotente devolve vazio.
type HostedRegisterResult struct {
	OperatorID    string `json:"operatorId"`
	InstanceID    string `json:"instanceId"`
	InternalToken string `json:"internalToken"`
}

// HostedRegisterError carrega o status HTTP e o corpo de erro do SaaS
// hospedado — mesmo padrão de RegisterError (registro de tenant).
type HostedRegisterError struct {
	Status int
	Code   string
}

func (e *HostedRegisterError) Error() string {
	return fmt.Sprintf("saasclient: hosted register: status %d: %s", e.Status, e.Code)
}

// RegisterOperator chama POST /public/operators/register no Watink SaaS
// hospedado — UMA única chamada de rede (retry aqui poderia duplicar o
// registro do lado do SaaS; a idempotência por e-mail do lado servidor
// cobre um retry de camada de transporte, não justifica um daqui). NUNCA
// loga req/resp — carregam a senha do empreendedor e o token gerado.
func RegisterOperator(ctx context.Context, req HostedRegisterRequest) (*HostedRegisterResult, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, SaaSHostedBaseURL+"/api/v1/public/operators/register", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := httpClient().Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("saasclient: hosted register: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
		var out HostedRegisterResult
		if err := json.Unmarshal(respBody, &out); err != nil {
			return nil, err
		}
		return &out, nil
	}

	var errBody struct {
		Error string `json:"error"`
	}
	_ = json.Unmarshal(respBody, &errBody)
	return nil, &HostedRegisterError{Status: resp.StatusCode, Code: errBody.Error}
}
