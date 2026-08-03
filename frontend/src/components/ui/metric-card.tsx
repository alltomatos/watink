import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

import { cn } from "@/lib/utils";

/* ─── Tipos ─────────────────────────────────────────────────────────── */

type MetricCardColor = "primary" | "success" | "warning" | "error" | "info";

export interface MetricCardTrend {
  /** Texto do indicador de tendência (ex: "+12%", "-3,5%") */
  value: string;
  /** true = tendência positiva (verde), false = negativa (vermelha) */
  positive: boolean;
}

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label descritivo acima do valor (ex: "Tickets Abertos") */
  label: string;
  /** Valor numérico ou textual em destaque (ex: "1.234", "99%") */
  value: string | number;
  /** Ícone Lucide renderizado dentro do container */
  icon?: React.ReactNode;
  /** Variante de cor semântica */
  color?: MetricCardColor;
  /** Indicador de tendência (badge de variação) */
  trend?: MetricCardTrend;
}

/* ─── Mapeamentos de cor (alinhados ao DS v2 UI Kit) ────────────────── */

/** Gradiente do container do ícone — alinhado ao UI Kit de referência */
const iconBgStyles: Record<MetricCardColor, string> = {
  primary: "bg-[linear-gradient(135deg,rgba(26,115,232,0.05)_0%,rgba(26,115,232,0.14)_100%)]",
  success: "bg-[linear-gradient(135deg,rgba(16,185,129,0.08)_0%,#D1FAE5_100%)]",
  warning: "bg-[linear-gradient(135deg,#FFFBEB_0%,rgba(245,158,11,0.15)_100%)]",
  error:   "bg-[linear-gradient(135deg,rgba(239,68,68,0.08)_0%,#FEE2E2_100%)]",
  info:    "bg-[linear-gradient(135deg,rgba(26,115,232,0.05)_0%,rgba(26,115,232,0.14)_100%)]",
};

/** Cor do ícone — usa variáveis resolvidas com hsl() completo */
const iconColorStyles: Record<MetricCardColor, string> = {
  primary: "text-[var(--color-info)]",
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  error:   "text-[var(--color-error)]",
  info:    "text-[var(--color-info)]",
};

/** Cor do valor numérico principal */
const valueColorStyles: Record<MetricCardColor, string> = {
  primary: "text-[var(--color-info)]",
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  error:   "text-[var(--color-error)]",
  info:    "text-[var(--color-info)]",
};

/* ─── Componente ────────────────────────────────────────────────────── */

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, color = "primary", label, value, icon, trend, ...props }, ref) => {
    const c = color ?? "primary";

    return (
      <div
        ref={ref}
        className={cn(
          "wt-metric-card group relative flex flex-col rounded-2xl bg-card p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 select-none hover:-translate-y-1.5 hover:shadow-[0px_8px_30px_rgba(0,0,0,0.12)]",
          className
        )}
        {...props}
      >
        {/* Container do ícone — fundo suave, ícone colorido */}
        {icon && (
          <div
            className={cn(
              "mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl [&>svg]:h-7 [&>svg]:w-7",
              iconBgStyles[c],
              iconColorStyles[c]
            )}
          >
            {icon}
          </div>
        )}

        {/* Label */}
        <span className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>

        {/* Valor principal — grande e colorido */}
        <span
          className={cn(
            "text-[2.5rem] font-extrabold leading-none tracking-tight tabular-nums",
            valueColorStyles[c]
          )}
        >
          {value}
        </span>

        {/* Badge de tendência */}
        {trend && (
          <div
            className={cn(
              "mt-3 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
              trend.positive
                ? "bg-status-success-bg text-status-success-text"
                : "bg-status-error-bg text-status-error-text"
            )}
          >
            {trend.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.value}
          </div>
        )}
      </div>
    );
  }
);
MetricCard.displayName = "MetricCard";

export { MetricCard };
export default MetricCard;
