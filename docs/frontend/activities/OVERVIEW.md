# Minhas Atividades (Ordens de Serviço)

> **Status:** ✅ Fase 0 implementada (2026-08-04) — acompanha
> [`docs/agents/activities.md`](../../agents/activities.md). O frontend de
> execução (`ActivityExecution.tsx` e abas) e a listagem redesenhada
> (`MyActivities/index.tsx`) estão prontos e validados no browser. A tela de
> **gestão** (`frontend/src/pages/Activities/`, lista do tenant + criar/editar
> + atribuição + montador de checklist) também foi implementada nesta fase —
> não fazia parte do plano original deste documento, mas era necessária para
> o módulo ter uma porta de entrada (sem ela, nenhuma Activity nasceria).

## Funcionalidades
- **Listagem com KPIs no topo**: cards de resumo (Hoje / Em andamento /
  Atrasadas / Concluídas na semana / Tempo médio) — ver
  `docs/agents/activities.md` §KPIs.
- **Toolbar de filtro**: seletor de status, seletor de prioridade, busca por
  título — mesma disposição horizontal do `GruposTab` (selects + busca à
  esquerda, ação primária à direita).
- **Abas de filtro rápido com contador**: `Todas` · `Atrasadas` · `Em
  andamento` · `Concluídas`, cada uma com `Badge` de contagem — mesmo padrão
  de `Você é admin 36` / `Você participa 128` do `GruposTab`.
- **Grid de cards** com badge de status + badge de alerta (SLA/parada) +
  progresso do checklist + contagem regressiva de prazo.
- **Execução**: inalterada — abre `ActivityExecution.tsx` em tela cheia
  (`Dialog` full-screen), como já é hoje.

## Arquitetura
- **Rota**: `/my-activities`, gate por `Can perform="activities:read"` (sai
  da flag `activePlugins.includes("helpdesk")` — ver `docs/agents/activities.md`).
- **Sem seletor de conexão** (diferente de Grupos) — Activities não é
  por-conexão-WhatsApp, é por usuário atribuído (`ActivityAssignee`) do
  tenant.
- **Estados dedicados** (implementado com `ErrorState` de `components/ui/`
  diretamente — não foi necessário um componente próprio como o
  `GroupsErrorState.tsx` de Grupos, porque Activities não tem os casos
  402/429/501 de licenciamento/rate-limit de plugin): 403 (sem permissão) →
  mensagem clara; erro genérico → `ErrorState` com botão "Tentar novamente".
- **Sem plugin/Marketplace envolvido** — Activities é core, então não há
  estado "402 plugin bloqueado" (diferente de Grupos, que é `pro`).

Ver [`COMPONENTS.md`](COMPONENTS.md) para estrutura de arquivos.
