import * as React from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ícone Lucide exibido acima da mensagem (padrão: Inbox) */
  icon?: React.ReactNode;
  /** Mensagem principal, ex: "Nenhum cliente encontrado" */
  title: string;
  /** Texto de apoio opcional, ex: "Crie o primeiro registro para começar." */
  description?: string;
  /** Ação opcional (ex: botão "Novo Cliente") */
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 text-center",
        className
      )}
      {...props}
    >
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:h-6 [&>svg]:w-6">
        {icon ?? <Inbox aria-hidden="true" />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
export default EmptyState;
