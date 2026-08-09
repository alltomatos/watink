package saasclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func withHostedFixture(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	original := SaaSHostedBaseURL
	SaaSHostedBaseURL = srv.URL
	t.Cleanup(func() { SaaSHostedBaseURL = original })
}

func TestRegisterOperator_SucessoDecodificaToken(t *testing.T) {
	withHostedFixture(t, func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/v1/public/operators/register", r.URL.Path)
		var body HostedRegisterRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		require.Equal(t, "ana@acme.com", body.Email)

		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(HostedRegisterResult{
			OperatorID: "op-1", InstanceID: "inst-1", InternalToken: "raw-token-uma-vez",
		})
	})

	result, err := RegisterOperator(context.Background(), HostedRegisterRequest{
		Name: "Ana", Email: "ana@acme.com", Password: "senha-forte-o-suficiente",
	})
	require.NoError(t, err)
	require.Equal(t, "inst-1", result.InstanceID)
	require.Equal(t, "raw-token-uma-vez", result.InternalToken)
}

func TestRegisterOperator_ErroDeNegocioMapeadoParaHostedRegisterError(t *testing.T) {
	withHostedFixture(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "too_many_attempts"})
	})

	_, err := RegisterOperator(context.Background(), HostedRegisterRequest{Email: "x@x.com"})
	require.Error(t, err)
	var hostedErr *HostedRegisterError
	require.ErrorAs(t, err, &hostedErr)
	require.Equal(t, http.StatusTooManyRequests, hostedErr.Status)
	require.Equal(t, "too_many_attempts", hostedErr.Code)
}
