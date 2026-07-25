/* @jsxImportSource react */
import React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { usePublicPlans, FEATURE_LABEL, formatBRL } from "./planCatalog";

// Vitrine pública dos planos (Onda 6, ADR 0007) — o botão "Registrar-se" do
// login cai aqui. A pessoa escolhe o plano e clica "Contratar", que leva ao
// formulário de cadastro (/register) já com o plano selecionado no dropdown.
const PlansPage: React.FC = () => {
  const navigate = useNavigate();
  const state = usePublicPlans();

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 px-8 text-center space-y-4">
            <p className="text-muted-foreground">
              O cadastro self-service não está disponível nesta instalação no momento.
            </p>
            <RouterLink to="/login" className="inline-flex items-center gap-2 text-primary font-medium hover:underline">
              <ArrowLeft className="h-4 w-4" /> Voltar para o login
            </RouterLink>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { plans } = state;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <Card className={`w-full ${plans.length > 2 ? "max-w-5xl" : "max-w-3xl"}`}>
        <CardHeader className="text-center">
          <CardTitle>Escolha seu plano</CardTitle>
          <CardDescription>Comece a usar o Watink agora mesmo — sem cartão para começar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-4 ${plans.length > 1 ? "sm:grid-cols-2" : ""} ${plans.length > 2 ? "lg:grid-cols-3" : ""}`}>
            {plans.map((plan) => {
              const featureKeys = (plan.features ?? []).filter((key) => FEATURE_LABEL[key]);
              return (
                <div key={plan.id} className="rounded-2xl border-2 border-border p-5 flex flex-col">
                  <div>
                    <p className="font-semibold">{plan.name}</p>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                    )}
                  </div>
                  <p className="mt-3 text-2xl font-bold">
                    {plan.priceCents === 0 ? "Grátis" : formatBRL(plan.priceCents)}
                    {plan.priceCents > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /{plan.billingCycle === "yearly" ? "ano" : "mês"}
                      </span>
                    )}
                  </p>
                  {plan.trialDays > 0 && (
                    <Badge variant="secondary" className="mt-2 w-fit">
                      {plan.trialDays} dias grátis
                    </Badge>
                  )}
                  <ul className="mt-3 text-sm text-muted-foreground space-y-1">
                    <li>{plan.usersLimit === 0 ? "Usuários ilimitados" : `Até ${plan.usersLimit} usuários`}</li>
                    <li>{plan.connectionsLimit === 0 ? "Conexões ilimitadas" : `Até ${plan.connectionsLimit} conexões`}</li>
                  </ul>
                  {featureKeys.length > 0 && (
                    <ul className="mt-3 pt-3 border-t border-border/60 space-y-1.5 flex-1">
                      {featureKeys.map((key) => (
                        <li key={key} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5" />
                          <span>{FEATURE_LABEL[key]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    className="mt-5 h-11 w-full"
                    onClick={() => navigate(`/register?planId=${encodeURIComponent(plan.id)}`)}
                  >
                    Contratar
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="text-center text-sm text-muted-foreground mt-6">
            Já tem uma conta?{" "}
            <RouterLink to="/login" className="font-medium text-primary hover:underline">
              Entrar
            </RouterLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlansPage;
