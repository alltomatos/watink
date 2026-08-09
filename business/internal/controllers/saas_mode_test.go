package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alltomatos/watinkdev/business/internal/saasclient"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/alltomatos/watinkdev/business/internal/testutil"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSaaSModeStatus_SemContrato_DevolvePairedFalse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutil.NewTestDB(t)
	ctrl := NewSaaSModeController(services.NewSaaSContractService(db))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/system/saas-mode/status", nil)
	ctrl.Status(c)

	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Equal(t, false, body["paired"])
}

func TestSaaSModePrecheck_HostInalcancavel_DevolveReachableFalseComOrientacao(t *testing.T) {
	gin.SetMode(gin.TestMode)
	original := saasModeHostSaaS
	saasModeHostSaaS = "127.0.0.1:1" // porta garantidamente sem listener
	t.Cleanup(func() { saasModeHostSaaS = original })

	ctrl := NewSaaSModeController(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/system/saas-mode/precheck", nil)
	ctrl.Precheck(c)

	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Equal(t, false, body["reachable"])
	require.Contains(t, body["guidance"], "443")
}

func TestSaaSModeRegister_SucessoGravaContratoViaSaaSContractService(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutil.NewTestDB(t)
	contractSvc := services.NewSaaSContractService(db)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(saasclient.HostedRegisterResult{
			OperatorID: "op-1", InstanceID: "inst-1", InternalToken: "raw-token-uma-vez",
		})
	}))
	t.Cleanup(srv.Close)
	original := saasclient.SaaSHostedBaseURL
	saasclient.SaaSHostedBaseURL = srv.URL
	t.Cleanup(func() { saasclient.SaaSHostedBaseURL = original })

	ctrl := NewSaaSModeController(contractSvc)
	payload, _ := json.Marshal(map[string]string{
		"name": "Ana", "email": "ana@acme.com", "password": "senha-forte-o-suficiente",
	})
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/system/saas-mode/register", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	ctrl.Register(c)

	require.Equal(t, http.StatusOK, w.Code)

	contract, err := contractSvc.Get()
	require.NoError(t, err)
	require.True(t, contract.Paired())
	require.Equal(t, "inst-1", contract.InstanceID)
	require.Equal(t, "raw-token-uma-vez", contract.InternalToken)
}

func TestSaaSModeRegister_SenhaFraca_NuncaChamaOSaaS(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutil.NewTestDB(t)
	ctrl := NewSaaSModeController(services.NewSaaSContractService(db))

	// SaaSHostedBaseURL deliberadamente não sobrescrita — se o handler
	// chamasse a rede de verdade aqui, o teste ficaria lento/flaky em vez de
	// simplesmente falhar rápido; a validação de senha tem que barrar ANTES.
	payload, _ := json.Marshal(map[string]string{
		"name": "Ana", "email": "ana@acme.com", "password": "123",
	})
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/system/saas-mode/register", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	ctrl.Register(c)

	require.Equal(t, http.StatusBadRequest, w.Code)
}
