/* @jsxImportSource react */
import React from "react";
import { Link as RouterLink, useSearchParams } from "react-router";
import { AlertTriangle } from "lucide-react";

import { i18n } from "../../translate/i18n";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

// Onda 2/A.3+A.5 do watink-saas (docs/integration-core.md §2.1/§3): destino
// único pra `tenant_suspended`/`tenant_canceled`, tanto vindo do login quanto
// de qualquer requisição autenticada em andamento (ver interceptor global em
// hooks/useAuth). Sem detalhe de fatura na v1 -- portal do assinante é fase
// futura (CLAUDE.md "Módulo: Onboarding" / integration-core.md §3).
const AccountSuspended: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason") === "tenant_canceled" ? "canceled" : "suspended";

  const title = i18n.t(`accountSuspended.${reason}Title`);
  const message = i18n.t(`accountSuspended.${reason}Message`);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-2xl border-border/40">
        <CardContent className="pt-8 pb-8 px-8 flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button asChild className="h-11 w-full text-base font-bold mt-2">
            <RouterLink to="/login">{i18n.t("accountSuspended.backToLogin")}</RouterLink>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSuspended;
