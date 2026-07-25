/* @jsxImportSource react */
import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import type { AxiosError } from "axios";
import { ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Loader2, Puzzle } from "lucide-react";
import { toast } from "react-toastify";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import pluginApi from "../../services/pluginApi";
import { getBackendUrl } from "../../helpers/urlUtils";
import type {
  CatalogPlugin,
  PluginCatalogResponse,
  PluginInstalledResponse,
  PluginActivateUnlicensedResponse,
  CheckoutOrderResponse,
  CheckoutPayResponse,
} from "../../types/api";

import { PageContainer, PageHeader, PageContent } from "../../components/ui/page-layout";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

/** View-model: CatalogPlugin augmented with local state fields */
interface PluginViewModel extends CatalogPlugin {
  active: boolean;
  installed: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Best-effort poll after a checkout request: the Hub creates the license
// record synchronously, but the signed token only reaches the local
// plugin-manager on the next heartbeat (up to heartbeatIntervalMin minutes,
// default 15min). Polling every 15min for that long would be a poor UX for
// an active tab, so this only tries a handful of times over a couple of
// minutes -- if the token hasn't arrived by then, the user is expected to
// simply come back and click "Ativar Plugin" again later. Not a guarantee.
const CHECKOUT_POLL_INTERVAL_MS = 25_000;
const CHECKOUT_POLL_MAX_ATTEMPTS = 6;

const FALLBACK_DESCRIPTION = "Plugin profissional para expandir recursos do Watink no seu ambiente.";

// SDK do Mercado Pago (Checkout Bricks) — carregado dinamicamente só quando
// o modal de pagamento abre, sem adicionar dependência nova no package.json.
const MP_SDK_URL = "https://sdk.mercadopago.com/js/v2";

function loadMercadoPagoSDK(): Promise<void> {
  if ((window as unknown as { MercadoPago?: unknown }).MercadoPago) {
    return Promise.resolve();
  }
  const existing = document.querySelector(`script[src="${MP_SDK_URL}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve(), { once: true }));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MP_SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o SDK do Mercado Pago"));
    document.body.appendChild(script);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const PluginDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  const [plugin, setPlugin] = useState<PluginViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Fase 2: o modal de checkout tem duas etapas — "review" (Preço/Imposto/
  // Total, igual à Fase 1) e "payment" (Payment Brick do Mercado Pago
  // montado). "pix-pending" mostra o QR code enquanto aguarda o webhook.
  const [checkoutStep, setCheckoutStep] = useState<"review" | "payment" | "pix-pending">("review");
  const [checkoutOrder, setCheckoutOrder] = useState<CheckoutOrderResponse | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode?: string; qrCodeBase64?: string } | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guarda o controller do Brick para poder desmontar ao fechar o modal —
  // o SDK do MP não tem tipos TS oficiais para este projeto, então o
  // controller circula como unknown até ser chamado.
  const brickControllerRef = useRef<{ unmount: () => void } | null>(null);

  // Clears any in-flight checkout poll on unmount/slug change so it never
  // fires against a stale/unmounted view.
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [slug]);

  const loadPlugin = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const [{ data: catalog }, { data: installed }] = await Promise.all([
        pluginApi.get<PluginCatalogResponse>("/plugins/catalog"),
        pluginApi.get<PluginInstalledResponse>("/plugins/installed"),
      ]);

      const all: CatalogPlugin[] = Array.isArray(catalog?.plugins) ? catalog.plugins : [];
      const active = new Set<string>(Array.isArray(installed?.active) ? installed.active : []);
      const p = all.find((x) => x.slug === slug);

      if (!p) {
        setPlugin(null);
        return;
      }

      setPlugin({
        ...p,
        installed: active.has(p.slug),
        active: active.has(p.slug),
        iconUrl: p.iconUrl ?? `/public/plugins/${p.slug}.png`,
      });
    } catch {
      toast.error("Erro ao carregar plugin");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { loadPlugin(); }, [loadPlugin]);

  // Handle URL payment status
  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const status = search.get("checkout") || search.get("status");
    if (status === "approved" || status === "success") {
      toast.success("Pagamento aprovado.");
      loadPlugin();
    }
  }, [location.search, loadPlugin]);

  // Polls GET /plugins/installed a handful of times (best-effort, see
  // CHECKOUT_POLL_INTERVAL_MS/CHECKOUT_POLL_MAX_ATTEMPTS above) after a
  // successful checkout request, looking for `slug` to show up as active.
  // Never loops forever -- gives up silently after the last attempt and
  // leaves the "Ativar Plugin" button for the user to retry manually.
  const pollForActivation = useCallback(
    (slugToPoll: string, attempt: number) => {
      if (attempt >= CHECKOUT_POLL_MAX_ATTEMPTS) return;

      pollTimeoutRef.current = setTimeout(async () => {
        try {
          const { data: installed } = await pluginApi.get<PluginInstalledResponse>("/plugins/installed");
          const active = Array.isArray(installed?.active) ? installed.active : [];
          if (active.includes(slugToPoll)) {
            toast.success("Licença confirmada — plugin ativado!");
            window.location.reload();
            return;
          }
        } catch {
          // Transient poll failure -- ignore and try again on the next tick.
        }
        pollForActivation(slugToPoll, attempt + 1);
      }, CHECKOUT_POLL_INTERVAL_MS);
    },
    [],
  );

  // Fase 2: "Prosseguir para pagamento" cria o pedido (PluginOrder pending
  // no Hub, valor já com imposto congelado) e avança pra etapa do Payment
  // Brick — nada é cobrado ainda aqui, só o pedido é aberto.
  const handleProceedToPayment = async () => {
    if (!plugin) return;
    setCheckoutSubmitting(true);
    try {
      const { data: order } = await pluginApi.post<CheckoutOrderResponse>(`/plugins/${plugin.slug}/checkout`);
      setCheckoutOrder(order);
      setCheckoutStep("payment");
    } catch {
      toast.error("Não foi possível iniciar o checkout. Tente novamente.");
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  // Monta o Payment Brick assim que a etapa "payment" abre com um pedido
  // válido. onSubmit do Brick devolve o formData (token de cartão OU dados
  // de PIX) que vai direto pro backend processar o pagamento de verdade.
  useEffect(() => {
    const mpPublicKey = plugin?.mpPublicKey;
    if (checkoutStep !== "payment" || !checkoutOrder || !mpPublicKey) return;

    let cancelled = false;
    void (async () => {
      try {
        await loadMercadoPagoSDK();
        if (cancelled) return;

        const MercadoPago = (window as unknown as { MercadoPago: new (key: string) => { bricks: () => { create: (type: string, containerId: string, settings: unknown) => Promise<{ unmount: () => void }> } } }).MercadoPago;
        const mp = new MercadoPago(mpPublicKey);
        const controller = await mp.bricks().create("payment", "checkout-brick-container", {
          initialization: { amount: checkoutOrder.amountCents / 100 },
          customization: {
            paymentMethods: { creditCard: "all", bankTransfer: "all" },
          },
          callbacks: {
            onError: (error: unknown) => {
              // eslint-disable-next-line no-console
              console.error("Payment Brick error:", error);
            },
            onSubmit: ({ formData }: { formData: Record<string, unknown> }) => {
              return handleBrickSubmit(formData);
            },
          },
        });
        if (cancelled) {
          controller.unmount();
          return;
        }
        brickControllerRef.current = controller;
      } catch {
        toast.error("Não foi possível carregar o formulário de pagamento.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutStep, checkoutOrder]);

  // handleBrickSubmit envia o formData do Brick pro backend processar o
  // pagamento de verdade. approved libera a licença na hora; pending (PIX)
  // mostra o QR code e faz poll aguardando o webhook confirmar; rejected
  // deixa o Brick montado pro usuário tentar de novo (comportamento nativo
  // do próprio Brick ao receber onSubmit rejeitado).
  const handleBrickSubmit = async (formData: Record<string, unknown>): Promise<void> => {
    if (!plugin || !checkoutOrder) return;
    try {
      const { data: result } = await pluginApi.post<CheckoutPayResponse>(`/plugins/${plugin.slug}/checkout/pay`, {
        orderId: checkoutOrder.orderId,
        formData,
      });

      if (result.status === "approved" && result.licenseActive) {
        setCheckoutOpen(false);
        toast.success(`Pagamento aprovado — plugin ${plugin.name} ativado!`);
        window.location.reload();
        return;
      }
      if (result.status === "pending") {
        setPixData({ qrCode: result.qrCode, qrCodeBase64: result.qrCodeBase64 });
        setCheckoutStep("pix-pending");
        toast.info("Pagamento PIX pendente — escaneie o QR code para confirmar.");
        pollForActivation(plugin.slug, 0);
        return;
      }
      toast.error(result.message || "Pagamento recusado. Tente outro meio de pagamento.");
    } catch {
      toast.error("Falha ao processar o pagamento. Tente novamente.");
    }
  };

  // Fecha o modal e reseta toda a máquina de estados do checkout — evita
  // reabrir numa etapa/pedido velho na próxima vez.
  const handleCloseCheckout = () => {
    brickControllerRef.current?.unmount();
    brickControllerRef.current = null;
    setCheckoutOpen(false);
    setCheckoutStep("review");
    setCheckoutOrder(null);
    setPixData(null);
  };

  const handleActivate = async () => {
    if (!plugin) return;
    setActivating(true);
    try {
      await pluginApi.post(`/plugins/${plugin.slug}/activate`);
      toast.success(`Plugin ${plugin.name} ativado!`);
      window.location.reload();
    } catch (err) {
      const axiosErr = err as AxiosError<PluginActivateUnlicensedResponse>;
      const body = axiosErr.response?.data;
      if (axiosErr.response?.status === 402 && body?.checkoutRequested) {
        toast.info(body.message || "Licença solicitada — aguardando confirmação, tentando novamente...");
        pollForActivation(plugin.slug, 0);
      } else {
        toast.error(body?.message || "Erro na ativação");
      }
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!plugin) return;
    setActivating(true);
    try {
      await pluginApi.post(`/plugins/${plugin.slug}/deactivate`);
      toast.success("Plugin desativado.");
      window.location.reload();
    } catch {
      toast.error("Erro na desativação");
    } finally {
      setActivating(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!plugin) return <div className="p-8">Plugin não encontrado</div>;

  const screenshots = plugin.screenshots ?? [];

  return (
    <Can user={user} perform="view_marketplace" yes={() => (
      <PageContainer>
        <PageHeader title={plugin.name}>
          <Button variant="outline" onClick={() => navigate("/admin/settings/marketplace")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </PageHeader>

        <PageContent className="space-y-6">
          <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="p-4 bg-muted rounded-2xl shrink-0">
                  {plugin.iconUrl ? (
                    <img
                      src={getBackendUrl(plugin.iconUrl)}
                      alt={plugin.name}
                      className="w-20 h-20 object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : <Puzzle className="w-20 h-20 text-primary" />}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold">{plugin.name}</h2>
                    {plugin.active && <Badge variant="secondary" className="bg-green-100"><CheckCircle className="mr-1 h-3 w-3" /> Ativo</Badge>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">{plugin.type === "free" ? "Gratuito" : `R$ ${plugin.price} + impostos`}</Badge>
                    <Badge variant="outline">v{plugin.version}</Badge>
                    {plugin.category && <Badge variant="outline">{plugin.category}</Badge>}
                  </div>
                  <p className="text-muted-foreground">{plugin.description || FALLBACK_DESCRIPTION}</p>

                  <div className="pt-2 flex gap-2">
                    {plugin.active ? (
                      <Button variant="destructive" onClick={handleDeactivate} disabled={activating}>
                        Desativar
                      </Button>
                    ) : (
                      <Button
                        onClick={() => (plugin.type === "pro" ? setCheckoutOpen(true) : handleActivate())}
                        disabled={activating}
                      >
                        Ativar Plugin
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {screenshots.length > 0 && (
            <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)]">
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-lg">Capturas de tela</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {screenshots.map((url, index) => (
                    <button
                      key={url + index}
                      type="button"
                      onClick={() => setLightboxIndex(index)}
                      className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-muted"
                    >
                      <img
                        src={getBackendUrl(url)}
                        alt={`${plugin.name} — captura ${index + 1}`}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)]">
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold text-lg">Sobre este plugin</h3>
              <p className="text-muted-foreground whitespace-pre-line">
                {plugin.longDescription || plugin.description || FALLBACK_DESCRIPTION}
              </p>
            </CardContent>
          </Card>
        </PageContent>

        <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && setLightboxIndex(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none text-white">
            {lightboxIndex !== null && screenshots[lightboxIndex] && (
              <div className="relative flex items-center justify-center min-h-[50vh]">
                <img
                  src={getBackendUrl(screenshots[lightboxIndex])}
                  alt={`${plugin.name} — captura ${lightboxIndex + 1}`}
                  className="max-h-[80vh] w-full object-contain"
                />
                {screenshots.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Anterior"
                      onClick={() => setLightboxIndex((i) => (i === null ? i : (i - 1 + screenshots.length) % screenshots.length))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Próxima"
                      onClick={() => setLightboxIndex((i) => (i === null ? i : (i + 1) % screenshots.length))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={checkoutOpen} onOpenChange={(open) => !open && handleCloseCheckout()}>
          <DialogContent>
            {checkoutStep === "review" && (
              <>
                <DialogHeader>
                  <DialogTitle>Confirmar ativação — {plugin.name}</DialogTitle>
                  <DialogDescription>
                    Revise o valor antes de prosseguir para o pagamento.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Preço</span>
                    <span>R$ {plugin.price}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Imposto ({plugin.taxRatePercent ?? 8}%)</span>
                    <span>
                      R$ {((Number(plugin.price) || 0) * ((plugin.taxRatePercent ?? 8) / 100)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-base font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>
                      R${" "}
                      {((Number(plugin.price) || 0) * (1 + (plugin.taxRatePercent ?? 8) / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCheckout} disabled={checkoutSubmitting}>
                    Cancelar
                  </Button>
                  <Button onClick={() => void handleProceedToPayment()} disabled={checkoutSubmitting}>
                    {checkoutSubmitting ? "Abrindo pagamento…" : "Prosseguir para pagamento"}
                  </Button>
                </DialogFooter>
              </>
            )}

            {checkoutStep === "payment" && (
              <>
                <DialogHeader>
                  <DialogTitle>Pagamento — {plugin.name}</DialogTitle>
                  <DialogDescription>
                    Cartão de crédito/débito ou PIX. O pagamento é processado pelo Mercado Pago.
                  </DialogDescription>
                </DialogHeader>
                <div id="checkout-brick-container" className="min-h-[300px]" />
              </>
            )}

            {checkoutStep === "pix-pending" && (
              <>
                <DialogHeader>
                  <DialogTitle>Aguardando pagamento PIX</DialogTitle>
                  <DialogDescription>
                    Escaneie o QR code ou copie o código abaixo no app do seu banco. O plugin ativa
                    automaticamente assim que o pagamento for confirmado.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-3 py-2">
                  {pixData?.qrCodeBase64 && (
                    <img
                      src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                      alt="QR code PIX"
                      className="h-48 w-48"
                    />
                  )}
                  {pixData?.qrCode && (
                    <textarea
                      readOnly
                      className="w-full rounded-xl border border-input bg-muted p-2 font-mono text-xs"
                      rows={3}
                      value={pixData.qrCode}
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCheckout}>
                    Fechar
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    )} />
  );
};

export default PluginDetail;
