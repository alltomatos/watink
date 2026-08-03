/* @jsxImportSource react */
import React, { useState, useEffect } from "react";
import { CreditCard, CheckCircle2, Info } from "lucide-react";
import pluginApi from "../../services/pluginApi";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Plan {
  name: string;
  price: string;
  limit: string;
  features: string[];
}

interface PlanCardProps {
  plan: Plan;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan }) => (
  <Card className="flex flex-col">
    <CardHeader className="bg-muted/30 border-b text-center py-6">
      <CardTitle className="text-2xl">{plan.name}</CardTitle>
      <CardDescription className="mt-2">
        <span className="text-4xl font-bold text-primary">R$ {plan.price}</span>
        <span className="text-muted-foreground">/mês</span>
      </CardDescription>
      <p className="text-sm text-muted-foreground mt-1">{plan.limit}</p>
    </CardHeader>
    <CardContent className="flex-1 py-6 space-y-3">
      {plan.features.map((feature) => (
        <div key={feature} className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <span className="text-sm">{feature}</span>
        </div>
      ))}
    </CardContent>
    <div className="p-6 pt-0">
      {/*
        Checkout automático indisponível nesta versão. Por ADR-0024, licença/
        assinatura passa pelo fluxo Hub, e o Hub v1 NÃO possui gateway de
        pagamento -- a licença é liberada manualmente pelo administrador. Não há
        endpoint de checkout no core para assinatura de plano (o
        POST /plugins/:slug/activate cobre ativação por plugin, não a compra de
        um plano). Até o Hub ganhar gateway, o botão fica desabilitado com um
        estado claro em vez de apontar para um checkout inexistente.
      */}
      <Button className="w-full" disabled title="Checkout indisponível nesta versão">
        <CreditCard className="mr-2 h-4 w-4" />
        Checkout indisponível
      </Button>
    </div>
  </Card>
);

const Billing: React.FC = () => {
  const [instanceId, setInstanceId] = useState("");

  useEffect(() => {
    const loadInstanceId = async () => {
      try {
        const { data } = await pluginApi.get<{ instanceId?: string }>("/plugins/instance");
        setInstanceId(data.instanceId ?? "");
      } catch {
        // non-critical, silently fail
      }
    };
    loadInstanceId();
  }, []);

  const plans: Plan[] = [
    {
      name: "Start",
      price: "49,99",
      limit: "4 plugins",
      features: [
        "Até 4 plugins Business",
        "Suporte Standard",
        "Atualizações Core",
        "Webchat incluso",
      ],
    },
    {
      name: "Pro",
      price: "99,99",
      limit: "6 plugins",
      features: [
        "Até 6 plugins Business",
        "Suporte Prioritário",
        "Todas as Engines (WhatsMeow/Papi)",
        "Acesso antecipado",
      ],
    },
    {
      name: "SaaS",
      price: "199,99",
      limit: "Módulo SaaS",
      features: [
        "Plugin de Gestão SaaS",
        "Painel Multi-instância",
        "White-label habilitado",
        "Faturamento centralizado",
      ],
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            Assinatura e Planos
          </span>
        }
      />
      <PageContent>
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O checkout automático não está disponível nesta versão. A liberação da
            licença é feita manualmente pelo administrador — entre em contato para
            assinar ou alterar seu plano.
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        {instanceId && (
          <div className="mt-8 rounded-lg border border-border bg-blue-50 p-4 dark:bg-blue-950/20">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Seu Instance ID: <span className="font-mono font-normal">{instanceId}</span>
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Este ID identifica sua instalação única do Watink e é necessário para validar sua licença após o pagamento.
            </p>
          </div>
        )}
      </PageContent>
    </PageContainer>
  );
};

export default Billing;