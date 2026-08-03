import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* ─── Variantes CVA ─────────────────────────────────────────────────── */

const statusChipVariants = cva(
  "wt-status-chip inline-flex items-center gap-1.5 rounded-full font-medium select-none transition-colors duration-fast",
  {
    variants: {
      status: {
        success:
          "bg-status-success-bg text-status-success-text",
        error:
          "bg-status-error-bg text-status-error-text",
        warning:
          "bg-status-warning-bg text-status-warning-text",
        info:
          "bg-status-info-bg text-status-info-text",
        default:
          "bg-status-default-bg text-status-default-text",
      },
      size: {
        sm: "px-2 py-0.5 text-[0.625rem]",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      status: "default",
      size: "md",
    },
  }
);

/* Dot indicador de status — tamanho acompanha o size da chip */
const dotVariants = cva("shrink-0 rounded-full", {
  variants: {
    status: {
      success: "bg-status-success",
      error: "bg-status-error",
      warning: "bg-status-warning",
      info: "bg-status-info",
      default: "bg-status-default-text",
    },
    size: {
      sm: "h-1.5 w-1.5",
      md: "h-2 w-2",
      lg: "h-2 w-2",
    },
  },
  defaultVariants: {
    status: "default",
    size: "md",
  },
});

/* ─── Tipos ─────────────────────────────────────────────────────────── */

export interface StatusChipProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof statusChipVariants> {
  /** Texto exibido na chip */
  label: string;
  /** Se true, exibe o dot indicador antes do label (padrão: true) */
  dot?: boolean;
}

/* ─── Componente ────────────────────────────────────────────────────── */

const StatusChip = React.forwardRef<HTMLSpanElement, StatusChipProps>(
  ({ className, status, size, label, dot = true, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(statusChipVariants({ status, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(dotVariants({ status, size }))}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  )
);
StatusChip.displayName = "StatusChip";

export { StatusChip, statusChipVariants };
export default StatusChip;
