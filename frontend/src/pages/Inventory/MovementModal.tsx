import React, { useState, useEffect } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "./inventoryTypes";

interface MovementModalProps {
  open: boolean;
  onClose: () => void;
  product: ProductListItem | null;
  onSubmit: (type: "in" | "out", quantity: number) => Promise<boolean>;
}

const MovementModal: React.FC<MovementModalProps> = ({ open, onClose, product, onSubmit }) => {
  const [type, setType] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("in");
    setQuantity("");
  }, [open]);

  const parsedQuantity = parseFloat(quantity.replace(",", "."));
  const isValid = !Number.isNaN(parsedQuantity) && parsedQuantity > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    const ok = await onSubmit(type, parsedQuantity);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar estoque</DialogTitle>
          {product && (
            <DialogDescription>
              {product.name} — saldo atual: {product.currentBalance} {product.unit}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("in")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                type === "in"
                  ? "border-status-success bg-status-success-bg text-status-success-text"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <ArrowDownCircle className="h-4 w-4" />
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setType("out")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                type === "out"
                  ? "border-status-error bg-status-error-bg text-status-error-text"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <ArrowUpCircle className="h-4 w-4" />
              Saída
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Quantidade</label>
            <Input
              inputMode="decimal"
              autoFocus
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValid) handleSubmit();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
            ) : type === "in" ? (
              "Registrar entrada"
            ) : (
              "Registrar saída"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MovementModal;
