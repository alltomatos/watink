import React from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Circle, X, ListChecks } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useOnboardingChecklist } from "../hooks/useOnboardingChecklist";

const SETOR_NAME_SUGGESTIONS = ["Atendimento", "Vendas", "Suporte", "Financeiro"];

/**
 * Card dispensável de Onboarding Checklist (GAP-C) — ver docs/agents/onboarding.md.
 * Estado 100% derivado (contagens em tempo real via API), NUNCA uma flag
 * persistida no backend. Dismiss é client-side (sessionStorage) — não bloqueia
 * o uso do sistema e não reaparece na mesma sessão do navegador.
 */
const OnboardingChecklistCard: React.FC = () => {
  const navigate = useNavigate();
  const { canSeeChecklist, loading, setorDone, userDone, allDone, dismissed, dismiss } =
    useOnboardingChecklist();

  if (!canSeeChecklist || dismissed || loading || allDone) {
    return null;
  }

  const goCreateSetor = (suggestedName?: string) => {
    const params = new URLSearchParams({ autoOpen: "create" });
    if (suggestedName) params.set("suggestedName", suggestedName);
    navigate(`/acessos/setores?${params.toString()}`);
  };

  const goCreateUser = () => {
    navigate("/acessos/usuarios?autoOpen=create");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/[0.08]">
              <ListChecks className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Primeiros passos</CardTitle>
              <CardDescription>
                Finalize a configuração inicial do seu time.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Dispensar checklist de onboarding"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {setorDone ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "var(--color-success)" }} />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <span className={setorDone ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}>
                Criar um setor
              </span>
            </div>
            {!setorDone && (
              <Button size="sm" variant="outline" onClick={() => goCreateSetor()}>
                Criar setor
              </Button>
            )}
          </div>
          {!setorDone && (
            <div className="flex flex-wrap gap-1.5 pl-7">
              {SETOR_NAME_SUGGESTIONS.map((name) => (
                <Badge
                  key={name}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => goCreateSetor(name)}
                >
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-2">
            {userDone ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "var(--color-success)" }} />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <span className={userDone ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}>
              Criar um usuário adicional
            </span>
          </div>
          {!userDone && (
            <Button size="sm" variant="outline" onClick={goCreateUser}>
              Criar usuário
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OnboardingChecklistCard;
