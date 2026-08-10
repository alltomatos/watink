package controllers

import (
	"crypto/tls"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/alltomatos/watinkdev/business/internal/saasclient"
	"github.com/alltomatos/watinkdev/business/internal/services"
	"github.com/gin-gonic/gin"
)

// SaaSModeController expõe o botão "Modo SaaS" em Configurações (issue
// #632): status do pareamento atual, uma pré-checagem de saída HTTPS (o
// dono do produto pediu para o usuário nunca descobrir um firewall
// corporativo depois de já ter preenchido o formulário) e o próprio
// registro — que grava o contrato via services.SaaSContractService (#628),
// nunca em .env. Superadmin-only (system.Use(middleware.SuperAdminOnly())).
type SaaSModeController struct {
	contract *services.SaaSContractService
}

// NewSaaSModeController injeta o SaaSContractService (DI pura).
func NewSaaSModeController(contract *services.SaaSContractService) *SaaSModeController {
	return &SaaSModeController{contract: contract}
}

// Status devolve se esta instância já está pareada com o Watink SaaS
// hospedado — a UI usa isso pra trocar o formulário de registro por um
// badge "Conectado" (mesmo padrão de StorageSection).
//
// @Summary      Status do pareamento com o Watink SaaS (Modo SaaS)
// @Tags         system
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /system/saas-mode/status [get]
func (ctrl *SaaSModeController) Status(c *gin.Context) {
	contract, err := ctrl.contract.Get()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"paired": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"paired":     contract.Paired(),
		"pairedAt":   contract.PairedAt,
		"lastSyncAt": contract.LastSyncAt,
	})
}

// saasModeHostSaaS é o host:porta verificado pela pré-checagem — mesmo host
// hardcoded que saasclient.SaaSHostedBaseURL usa para o registro real. `var`
// só para o teste deste pacote apontar a um endereço que garantidamente
// falha (127.0.0.1:1) sem depender de rede real — nenhum código de produção
// reatribui isto.
// saashomol.watink.com (homologação/teste real) — saas.watink.com é
// reservado para a produção comercial futura e ainda não existe.
var saasModeHostSaaS = "saashomol.watink.com:443"

// Precheck testa conectividade de SAÍDA para o Watink SaaS hospedado (issue
// #632, requisito explícito do dono): um core atrás de firewall corporativo
// vê a orientação (domínio a liberar, porta 443, nenhuma porta de ENTRADA
// necessária — o contrato é pull, #631) ANTES de preencher o formulário,
// não depois de já ter enviado.
//
// @Summary      Pré-checagem de saída HTTPS para o Watink SaaS
// @Tags         system
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /system/saas-mode/precheck [get]
func (ctrl *SaaSModeController) Precheck(c *gin.Context) {
	dialer := net.Dialer{Timeout: 5 * time.Second}
	conn, err := tls.DialWithDialer(&dialer, "tcp", saasModeHostSaaS, nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"reachable": false,
			"host":      saasModeHostSaaS,
			"guidance":  "Libere a saída HTTPS (porta 443) para " + saasModeHostSaaS + " no firewall/proxy desta rede. Nenhuma porta de ENTRADA é necessária — o Watink SaaS nunca conecta a este core, é este core que conecta a ele.",
		})
		return
	}
	_ = conn.Close()
	c.JSON(http.StatusOK, gin.H{"reachable": true, "host": saasModeHostSaaS})
}

type saasModeRegisterBody struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Whatsapp string `json:"whatsapp"`
	Document string `json:"document"`
	Password string `json:"password" binding:"required"`
}

// Register chama POST /public/operators/register no Watink SaaS hospedado
// (watink-saas#29) e, em sucesso, grava o contrato retornado (operatorId
// devolvido só para referência — o que importa localmente é
// instanceId+internalToken) via SaaSContractService.Set. NUNCA loga o token
// nem a senha (mesma regra do saasclient/RegisterController existentes).
//
// @Summary      Registrar esta instância no Watink SaaS hospedado (Modo SaaS)
// @Tags         system
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /system/saas-mode/register [post]
func (ctrl *SaaSModeController) Register(c *gin.Context) {
	var body saasModeRegisterBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	if err := validatePasswordStrength(body.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := saasclient.RegisterOperator(c.Request.Context(), saasclient.HostedRegisterRequest{
		Name:     body.Name,
		Email:    normalizeEmail(body.Email),
		Whatsapp: body.Whatsapp,
		Document: body.Document,
		Password: body.Password,
	})
	if err != nil {
		var regErr *saasclient.HostedRegisterError
		if !errors.As(err, &regErr) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "saas_unreachable"})
			return
		}
		switch regErr.Status {
		case http.StatusTooManyRequests:
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "too_many_attempts"})
		case http.StatusBadRequest:
			c.JSON(http.StatusBadRequest, gin.H{"error": strings.TrimSpace(regErr.Code)})
		default:
			c.JSON(http.StatusBadGateway, gin.H{"error": "saas_register_failed"})
		}
		return
	}

	// Registro novo (InternalToken preenchido) OU reenvio idempotente
	// (AlreadyExisted, sem token) — em ambos os casos só gravamos o contrato
	// se temos um token pra cifrar; um reenvio sem token não sobrescreve o
	// que já está gravado localmente (ele já deveria estar pareado).
	if result.InternalToken != "" {
		if err := ctrl.contract.Set(saasclient.SaaSHostedBaseURL, result.InstanceID, result.InternalToken); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "contract_save_failed"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"paired": true, "instanceId": result.InstanceID})
}

type saasModePairBody struct {
	BaseURL       string `json:"baseUrl" binding:"required,url"`
	InstanceID    string `json:"instanceId" binding:"required"`
	InternalToken string `json:"internalToken" binding:"required"`
}

// Pair grava um pareamento gerado manualmente por um Operator que já tem
// conta no Watink SaaS (issue de "instância adicional on-premise sem URL
// pública") — diferente de Register, que sempre cria um Operator novo. O
// admin cola aqui o instanceId+token gerados no Console (POST /instances/pair
// do watink-saas), e a baseUrl do próprio Watink SaaS (não adivinhável, ao
// contrário do hosted padrão em Register). Testa a credencial com um Sync
// vazio ANTES de persistir — nunca grava um contrato não verificado (mesmo
// espírito do TestConnection do lado watink-saas).
//
// @Summary      Parear esta instância com um Watink SaaS via instanceId+token existentes
// @Tags         system
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     BearerAuth
// @Router       /system/saas-mode/pair [post]
func (ctrl *SaaSModeController) Pair(c *gin.Context) {
	var body saasModePairBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}

	client := saasclient.New(body.BaseURL, body.InstanceID, body.InternalToken)
	if _, err := client.Sync(c.Request.Context(), saasclient.SyncRequest{}); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "pair_unreachable"})
		return
	}

	if err := ctrl.contract.Set(body.BaseURL, body.InstanceID, body.InternalToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "contract_save_failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"paired": true, "instanceId": body.InstanceID})
}
