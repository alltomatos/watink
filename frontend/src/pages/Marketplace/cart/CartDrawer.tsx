import React, { useState } from "react";
import { Copy, Loader2, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "../../../components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../../components/ui/sheet";
import { useCart } from "./CartContext";
import { createCartCardCheckout, createCartPixCheckout } from "./cartApi";
import type { CartCheckoutResponse } from "../../../types/api";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function cyclePriceReais(entry: ReturnType<typeof useCart>["items"][number]): number {
  if (entry.cycle === "") return Number(entry.plugin.price) || 0;
  const pc = entry.plugin.pricingCycles?.find((c) => c.cycle === entry.cycle);
  return (pc?.priceCents ?? 0) / 100;
}

// CartDrawer is the "checkout multiple plugins at once" flow: pick a cycle
// per item, choose card or Pix, and submit ONE request that charges the sum
// in a single Mercado Pago preference/payment (POST /plugins/cart/checkout,
// see cartApi.ts) — mirrors the single-plugin dialog in PluginDetail.tsx but
// for N items instead of one.
export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const { items, removeItem, setCycle, clear } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("card");
  const [payerEmail, setPayerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CartCheckoutResponse | null>(null);

  const totalReais = items.reduce((sum, e) => sum + cyclePriceReais(e), 0);
  const taxRate = items[0]?.plugin.taxRatePercent ?? 8;

  const handleClose = () => {
    onOpenChange(false);
    setResult(null);
  };

  const handleFinalize = async () => {
    setSubmitting(true);
    try {
      const cartItems = items.map((e) => ({ slug: e.plugin.slug, cycle: e.cycle }));
      if (paymentMethod === "card") {
        const returnUrl = window.location.href.split("?")[0];
        const res = await createCartCardCheckout(cartItems, returnUrl);
        if (res.allTrial) {
          toast.success("Carrinho ativado — todos os itens entraram em trial grátis!");
          clear();
          handleClose();
          window.location.reload();
          return;
        }
        window.location.href = res.checkoutUrl!;
      } else {
        const res = await createCartPixCheckout(cartItems, payerEmail);
        if (res.allTrial) {
          toast.success("Carrinho ativado — todos os itens entraram em trial grátis!");
          clear();
          handleClose();
          window.location.reload();
          return;
        }
        setResult(res);
      }
    } catch {
      toast.error("Não foi possível finalizar a compra. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPixCode = () => {
    if (!result?.qrCode) return;
    void navigator.clipboard.writeText(result.qrCode);
    toast.success("Código Pix copiado!");
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <SheetContent className="flex flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Carrinho
          </SheetTitle>
          <SheetDescription>
            Revise os itens e finalize numa única cobrança.
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 && !result ? (
          <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
        ) : result ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={`data:image/png;base64,${result.qrCodeBase64}`}
              alt="QR Code Pix"
              className="h-48 w-48 rounded-md border"
            />
            <div className="flex w-full items-center gap-2">
              <input
                readOnly
                value={result.qrCode}
                className="h-9 flex-1 truncate rounded-md border border-input bg-muted px-3 text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleCopyPixCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Escaneie o QR code ou copie o código Pix. A ativação de cada plugin é confirmada
              automaticamente assim que o pagamento cair.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {items.map((entry) => (
                <div key={entry.plugin.slug} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{entry.plugin.name}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => removeItem(entry.plugin.slug)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {((entry.plugin.pricingCycles?.length ?? 0) > 0 || entry.plugin.singlePaymentEnabled) && (
                    <div className="flex flex-wrap gap-1.5">
                      {entry.plugin.singlePaymentEnabled && (
                        <Button
                          type="button"
                          size="sm"
                          variant={entry.cycle === "" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setCycle(entry.plugin.slug, "")}
                        >
                          Único — R$ {(Number(entry.plugin.price) || 0).toFixed(2)}
                        </Button>
                      )}
                      {entry.plugin.pricingCycles?.map((pc) => (
                        <Button
                          key={pc.cycle}
                          type="button"
                          size="sm"
                          variant={entry.cycle === pc.cycle ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setCycle(entry.plugin.slug, pc.cycle)}
                        >
                          {pc.cycle} — R$ {(pc.priceCents / 100).toFixed(2)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {totalReais.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Imposto ({taxRate}%)</span>
                <span>R$ {(totalReais * (taxRate / 100)).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold pt-1 border-t">
                <span>Total</span>
                <span>R$ {(totalReais * (1 + taxRate / 100)).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <span className="text-sm text-muted-foreground">Forma de pagamento</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("card")}
                >
                  Cartão
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={paymentMethod === "pix" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("pix")}
                >
                  Pix
                </Button>
              </div>
              {paymentMethod === "pix" && (
                <input
                  type="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                />
              )}
            </div>
          </>
        )}

        <SheetFooter>
          {result ? (
            <Button className="w-full" variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          ) : items.length > 0 ? (
            <Button
              className="w-full"
              disabled={submitting || (paymentMethod === "pix" && !payerEmail)}
              onClick={() => void handleFinalize()}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Finalizar compra
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
