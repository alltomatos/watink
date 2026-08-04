import * as React from "react";

import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface SlaConfigValue {
  low: number;
  medium: number;
  high: number;
  urgent: number;
}

export interface SlaConfigCardProps {
  /** Ícone do header do card (lucide-react) — nunca emoji, ADR 0008. */
  icon: React.ReactNode;
  title: string;
  description?: string;
  value: SlaConfigValue;
  onChange: (priority: keyof SlaConfigValue, value: string) => void;
  /** Conteúdo extra renderizado abaixo do bloco de SLA (ex.: threshold de "parada",
   * switch de habilitar) — mantém o card genérico sem crescer props específicas. */
  children?: React.ReactNode;
}

const PRIORITY_LABELS: Record<keyof SlaConfigValue, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

/**
 * SlaConfigCard — bloco de "minutos por prioridade", compartilhado entre
 * Helpdesk e Activities (docs/agents/activities.md §SLA). Extraído para não
 * duplicar a mesma tela de configuração duas vezes; qualquer módulo novo com
 * SLA por prioridade reusa este componente em vez de recriar o form.
 */
export function SlaConfigCard({ icon, title, description, value, onChange, children }: SlaConfigCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          {icon}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-4">Tempos de Resolução do SLA (em minutos)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.keys(PRIORITY_LABELS) as Array<keyof SlaConfigValue>).map((priority) => (
              <FormField key={priority} htmlFor={`sla-${priority}`} label={PRIORITY_LABELS[priority]}>
                <Input
                  id={`sla-${priority}`}
                  type="number"
                  value={value[priority]}
                  onChange={(e) => onChange(priority, e.target.value)}
                />
              </FormField>
            ))}
          </div>
        </div>

        {children && (
          <>
            <Separator />
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SlaConfigCard;
