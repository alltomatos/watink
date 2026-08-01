import React from "react";
import { ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getConnectionHealthLevel, describeRiskCode } from "../connectionRisk";

interface ConnectionHealthBadgeProps {
  lastRiskCode?: number;
  lastRiskAt?: string | null;
}

/** Indicador de saúde anti-ban da conexão — verde/amarelo/vermelho, derivado
 * do último sinal de risco (nunca persistido como estado próprio). Some da
 * tela quando não há nenhum sinal recente, para não poluir o card padrão. */
export const ConnectionHealthBadge: React.FC<ConnectionHealthBadgeProps> = ({
  lastRiskCode,
  lastRiskAt,
}) => {
  const level = getConnectionHealthLevel({ code: lastRiskCode, at: lastRiskAt });
  if (level === "ok") return null;

  const label = level === "critical" ? "Risco alto" : "Atenção";
  const Icon = level === "critical" ? ShieldAlert : TriangleAlert;
  const className =
    level === "critical"
      ? "bg-red-100 text-red-700 hover:bg-red-100 border-none"
      : "bg-amber-100 text-amber-700 hover:bg-amber-100 border-none";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className={className}>
            <Icon size={12} className="mr-1" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {describeRiskCode(lastRiskCode)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/** Badge "tudo certo" opcional, para telas de detalhe que queiram mostrar o
 * estado positivo explicitamente (a lista usa ausência de badge = saudável). */
export const ConnectionHealthOkBadge: React.FC = () => (
  <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
    <ShieldCheck size={12} className="mr-1" />
    Sem alertas
  </Badge>
);
