import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Users } from "lucide-react";

import { cn } from "@/lib/utils";

/* ─── Variantes CVA ─────────────────────────────────────────────────── */

const avatarVariants = cva(
  "wt-avatar relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted select-none",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-[0.5rem]",
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-12 w-12 text-base",
        xl: "h-16 w-16 text-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const onlineDotVariants = cva(
  "absolute bottom-0 right-0 rounded-full border-2 border-bg-surface bg-status-success",
  {
    variants: {
      size: {
        xs: "h-1.5 w-1.5",
        sm: "h-2 w-2",
        md: "h-2.5 w-2.5",
        lg: "h-3 w-3",
        xl: "h-3.5 w-3.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

/* ─── Tipos ─────────────────────────────────────────────────────────── */

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  /** URL da imagem do avatar */
  src?: string | null;
  /** Nome completo — usado para gerar iniciais como fallback */
  name?: string;
  /** Exibe o dot de status online no canto inferior direito */
  online?: boolean;
  /** Quando true, o fallback mostra ícone de grupo em vez de iniciais */
  isGroup?: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

/** Extrai as iniciais das duas primeiras palavras do nome */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/* Cores determinísticas para o fundo do fallback baseadas no nome */
const FALLBACK_COLORS = [
  "bg-[var(--blue-100)] text-[var(--blue-700)]",
  "bg-[var(--emerald-100)] text-[var(--emerald-700)]",
  "bg-[var(--amber-100)] text-[var(--amber-700)]",
  "bg-[var(--violet-100)] text-[var(--violet-700)]",
  "bg-[var(--red-100)] text-[var(--red-700)]",
] as const;

function getColorByName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

/* ─── Componente ────────────────────────────────────────────────────── */

const groupIconSize: Record<string, number> = {
  xs: 10, sm: 14, md: 18, lg: 22, xl: 28,
};

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, name, size, online, isGroup, ...props }, ref) => {
    const [imgError, setImgError] = React.useState(false);
    const showImage = src && !imgError;
    const initials = name ? getInitials(name) : "?";
    const fallbackColor = isGroup
      ? "bg-muted text-muted-foreground"
      : name
      ? getColorByName(name)
      : "bg-muted text-muted-foreground";

    return (
      <div
        ref={ref}
        className={cn(
          avatarVariants({ size }),
          !showImage && fallbackColor,
          className
        )}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={name ?? "Avatar"}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : isGroup ? (
          <Users
            size={groupIconSize[size ?? "md"] ?? 18}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        ) : (
          <span className="font-semibold leading-none">{initials}</span>
        )}

        {online && (
          <span
            className={cn(onlineDotVariants({ size }))}
            aria-label="Online"
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar, avatarVariants };
export default Avatar;
