package controllers

import (
	"net/http"

	"github.com/alltomatos/watinkdev/business/internal/pluginlicense"
	"github.com/alltomatos/watinkdev/business/pkg/auth"
	"github.com/gin-gonic/gin"
)

// cartItemRequest é um item do carrinho enviado pelo frontend — {slug,
// cycle}, mesma convenção do checkout individual (cycle vazio = pagamento
// único).
type cartItemRequest struct {
	Slug  string `json:"slug" binding:"required"`
	Cycle string `json:"cycle"`
}

func toPluginLicenseCartItems(items []cartItemRequest) []pluginlicense.CartItem {
	out := make([]pluginlicense.CartItem, len(items))
	for i, it := range items {
		out[i] = pluginlicense.CartItem{Slug: it.Slug, Cycle: it.Cycle}
	}
	return out
}

type createCartCheckoutRequest struct {
	Items     []cartItemRequest `json:"items" binding:"required,min=1,dive"`
	ReturnURL string            `json:"returnUrl" binding:"required"`
}

// @Summary      Iniciar checkout de carrinho via Cartão
// @Description  Resolve vários plugins pro (cada um com seu ciclo) e devolve UMA URL de redirect pro Checkout Pro pela soma — a licença de cada item só nasce quando o webhook confirma o pagamento.
// @Tags         plugins
// @Produce      json
// @Success      201  {object}  pluginlicense.CartCheckoutResponse
// @Security     BearerAuth
// @Router       /plugins/cart/checkout [post]
func (pc *PluginController) CreateCartCheckoutOrder(c *gin.Context) {
	_, _, ok := auth.GetScoped(c, "Plugins")
	if !ok {
		return
	}

	var req createCartCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "message": err.Error()})
		return
	}

	if pc.pmProxy == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "checkout service unavailable"})
		return
	}

	order, err := pc.pmProxy.CartCheckoutCard(toPluginLicenseCartItems(req.Items), req.ReturnURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "checkout_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, order)
}

type createCartPixCheckoutRequest struct {
	Items      []cartItemRequest `json:"items" binding:"required,min=1,dive"`
	PayerEmail string            `json:"payerEmail" binding:"required,email"`
}

// @Summary      Iniciar checkout de carrinho via Pix
// @Description  Equivalente Pix de POST /plugins/cart/checkout — devolve UM QR code/copia-e-cola pela soma dos itens pagos.
// @Tags         plugins
// @Produce      json
// @Success      201  {object}  pluginlicense.CartCheckoutResponse
// @Security     BearerAuth
// @Router       /plugins/cart/checkout/pix [post]
func (pc *PluginController) CreateCartPixCheckoutOrder(c *gin.Context) {
	_, _, ok := auth.GetScoped(c, "Plugins")
	if !ok {
		return
	}

	var req createCartPixCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "message": err.Error()})
		return
	}

	if pc.pmProxy == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "checkout service unavailable"})
		return
	}

	order, err := pc.pmProxy.CartCheckoutPix(toPluginLicenseCartItems(req.Items), req.PayerEmail)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "checkout_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, order)
}
