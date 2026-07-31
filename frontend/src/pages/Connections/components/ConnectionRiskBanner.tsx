import React from "react";
import { Info, TriangleAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { getConnectionHealthLevel, describeRiskCode, ANTI_BAN_THRESHOLDS } from "../connectionRisk";

interface ConnectionRiskBannerProps {
  lastRiskCode?: number;
  lastRiskAt?: string | null;
}

/** Faixa de alerta dentro do card, visível só quando há um sinal de risco
 * recente (últimas 24h) — explica o código, não só exibe um número cru. */
export const ConnectionRiskBanner: React.FC<ConnectionRiskBannerProps> = ({
  lastRiskCode,
  lastRiskAt,
}) => {
  const level = getConnectionHealthLevel({ code: lastRiskCode, at: lastRiskAt });
  if (level === "ok") return null;

  const bg = level === "critical" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${bg}`}>
      <TriangleAlert size={14} className="mt-0.5 shrink-0" />
      <span className="flex-1">{describeRiskCode(lastRiskCode)}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Saiba mais sobre limites seguros de uso"
            className="shrink-0 opacity-70 hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Info size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-xs" onClick={(e) => e.stopPropagation()}>
          <p className="mb-2 font-medium">Limites de referência para reduzir risco de banimento</p>
          <div className="space-y-1.5">
            {ANTI_BAN_THRESHOLDS.map((t) => (
              <div key={t.label} className="flex flex-col">
                <span className="text-muted-foreground">{t.label}</span>
                <span>
                  <span className="text-green-700">seguro: {t.safe}</span>
                  {" · "}
                  <span className="text-red-700">risco: {t.danger}</span>
                </span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
