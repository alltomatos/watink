import { useEffect, useState } from "react";

import api from "../../services/api";

export interface PublicPlan {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  billingCycle: string;
  trialDays: number;
  usersLimit: number;
  connectionsLimit: number;
  queuesLimit: number;
  features?: string[] | null;
}

// Catálogo fixo de funcionalidades do core que um plano pode destacar —
// puramente de exibição (o backend só repassa chaves opacas em
// PublicPlan.features). Espelhado (duplicado de propósito, sem acoplamento
// entre repos) de watink-saas/console/src/lib/planFeatures.ts, que é onde o
// operador escolhe as chaves ao editar um plano.
export const FEATURE_LABEL: Record<string, string> = {
  pipelines: "Pipeline de vendas (Kanban)",
  flowbuilder: "Automação de fluxos (FlowBuilder)",
  knowledge_base: "Base de Conhecimento com IA",
  helpdesk: "Central de Ajuda (Helpdesk)",
  quick_answers: "Respostas rápidas",
  reports: "Relatórios e métricas",
  crm: "CRM de clientes",
  multichannel: "Atendimento multicanal (WhatsApp)",
};

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type PlansState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; plans: PublicPlan[] };

// usePublicPlans busca o catálogo público de registro self-service
// (GET /register/plans — só existe quando o control plane Watink SaaS está
// configurado nesta instalação; ADR 0007). Compartilhado entre /planos
// (vitrine com cards) e /register (formulário com o dropdown de plano).
export function usePublicPlans(): PlansState {
  const [state, setState] = useState<PlansState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.get("/register/plans");
        if (cancelled) return;
        if (!data?.registrationOpen || !Array.isArray(data.plans) || data.plans.length === 0) {
          setState({ status: "unavailable" });
          return;
        }
        // Mais barato primeiro — o backend ordena por sortOrder (o operador
        // decide a ordem administrativa), mas a vitrine e o dropdown de
        // registro devem sempre ir do mais barato ao mais caro.
        const sorted = [...data.plans].sort((a, b) => a.priceCents - b.priceCents);
        setState({ status: "ready", plans: sorted });
      } catch {
        if (!cancelled) setState({ status: "unavailable" });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
