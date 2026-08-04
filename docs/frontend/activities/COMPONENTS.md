# Componentes de Atividades

Stack: React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui + Lucide React.

> **Status:** ✅ implementado (Fase 0, 2026-08-04). Esta estrutura reflete o
> que foi de fato construído — divergências pontuais do plano original estão
> anotadas inline.

## Estrutura de arquivos — Minhas Atividades (execução, visão do técnico)

```
src/pages/MyActivities/
├── index.tsx                     # Listagem redesenhada — KPIs + toolbar + abas + grid
├── activityTypes.ts               # Tipos unificados, pinados ao DTO real do backend
├── activityHelpers.ts             # já existia
├── ActivityExecution.tsx          # já existia — inalterado nesta fase
├── SignatureModal.tsx             # já existia — inalterado
├── components/
│   ├── ChecklistTab.tsx           # já existia
│   ├── MaterialsTab.tsx           # já existia — onDelete agora recebe number, não string
│   ├── MaterialModal.tsx          # já existia — Omit<Material, "id" | "activityId">
│   ├── OccurrencesTab.tsx         # já existia — onDelete agora recebe number, não string
│   ├── OccurrenceModal.tsx        # já existia — reusado também pelo atalho do ActivityCard
│   ├── DetailsTab.tsx             # já existia — activity.protocol.client.name já vem achatado do backend
│   ├── ActivityKpiCards.tsx       # NOVO — 5 MetricCard, consome GET /my-activities/kpis
│   ├── ActivityFilters.tsx        # NOVO — selects de status/prioridade + busca
│   └── ActivityCard.tsx           # NOVO — badge status/prioridade/SLA/parada, progresso checklist, atalho de ocorrência
└── hooks/
    ├── useActivityExecution.ts    # já existia — toast → notify (11 sites), ids number
    └── useMyActivities.ts         # NOVO — lista + KPIs + filtros/abas client-side (sem paginação)
```

**Divergência do plano original:** não foi criado um `ActivitiesErrorState.tsx`
próprio — `index.tsx` usa `ErrorState` de `components/ui/` diretamente (403 →
título customizado; erro genérico → `onRetry`). Activities não tem os casos
402/429/501 de licenciamento que justificaram o componente dedicado em
Grupos.

## Estrutura de arquivos — Atividades (gestão, visão do gestor)

```
src/pages/Activities/
├── index.tsx                          # Lista do tenant (DataTable) + toolbar + ação "Nova Atividade"
├── components/
│   ├── ActivitiesTable.tsx            # Colunas: status, título, prioridade, responsáveis, prazo, checklist, ações
│   ├── ActivityFormDialog.tsx         # Criar/editar dados básicos + monta assignees/checklist no create
│   ├── ActivityAssigneesPanel.tsx     # Multi-select (checkbox list) de usuários do tenant — N:N
│   └── ActivityChecklistBuilder.tsx   # Add/remover/reordenar itens — SÓ na criação (ver limitação abaixo)
└── hooks/
    └── useActivities.ts               # Lista + filtros + create/edit/delete, GET /activities (tenant-wide)
```

Este módulo inteiro **não estava no plano original** de `docs/agents/activities.md`
— foi adicionado porque sem ele nenhuma Activity nasceria (a Fase 0 original
só cobria leitura/execução).

**Limitação conhecida (não é bug):** `ActivityChecklistBuilder` só é editável
ao **criar** uma atividade. O backend não tem rota para adicionar/remover
item de uma Activity já existente (só `PUT /activities/:id/items/:itemId`
para `isDone`/`value`). Ao editar, o formulário mostra o checklist existente
como lista somente-leitura.

## ActivityKpiCards
Linha de `MetricCard` no topo de `MyActivities/index.tsx`, antes da toolbar.
Consome `GET /my-activities/kpis` uma vez por fetch (via `useMyActivities`),
não recalculado a partir da lista filtrada no client. Layout:
`grid grid-cols-2 md:grid-cols-5 gap-4` — mesmo padrão do
`DashboardKpiRow.tsx`, **não** o de Grupos (Central de Grupos não tem KPIs).

## ActivityFilters
Linha única `flex items-center gap-2 flex-wrap`: `Select` status, `Select`
prioridade, `Input` com ícone `Search` à esquerda — mesmo padrão de
`GruposTab.tsx`. Filtro é client-side sobre a lista já carregada (sem
paginação, mesmo precedente de Clients/Grupos).

## Abas de filtro rápido
`Tabs` com `TabsTrigger` + `Badge` de contagem (`Todas`/`Atrasadas`/`Em
andamento`/`Concluídas`) — contagens vêm do mesmo payload de KPIs
(`kpis.tabCounts`), sem fetch adicional.

## ActivityCard
- Badge de status (via `Badge` do design system) + badge de prioridade.
- `StatusChip` amarelo "Parada há Xh" quando `staleSince` vem preenchido.
- `StatusChip` amarelo/vermelho de SLA ("Vence em..." / "Atrasada há...") a
  partir de `slaStatus`.
- Progresso do checklist ("N/M itens") a partir de `checklistProgress`.
- Botão "Registrar ocorrência" (ícone) que abre `OccurrenceModal` (reusado de
  `MyActivities/components/`) sem entrar em `ActivityExecution` — POST direto
  em `/activities/:id/occurrences`.
- "Executar" agora chama `PUT /activities/:id/start` **antes** de abrir
  `ActivityExecution` (início explícito, idempotente no backend).

## ActivityAssigneesPanel
Checkbox list (não um combobox custom) sobre `GET /users` — mais simples e
suficiente pro volume esperado de usuários por tenant. No create, o estado
fica em memória e vai no payload de `POST /activities`; na edição, cada
toggle persiste na hora via `PUT /activities/:id/assignees` (upsert por
diferença no backend).

## ActivityChecklistBuilder
Editor de `{ label, inputType, isRequired, position }` — adicionar, remover,
reordenar (botões cima/baixo, não drag-and-drop). Usado só dentro de
`ActivityFormDialog` quando `activity === null` (criação).

## Regras de design aplicadas
- Cards: `rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)]` (via
  `Card` base) — nunca `border`.
- Ícones exclusivamente `lucide-react`.
- `StatusChip` para status/alerta (não `Badge` cru) — segue o design system.
- Nenhum componente novo solto fora de `components/ui/` — reusa
  `page-layout`, `card`, `tabs`, `badge`, `status-chip`, `select`, `input`,
  `skeleton`, `empty-state`, `error-state`, `data-table`, `form-field`,
  `checkbox`, `avatar`, `switch`, `dialog`, `button`.
- Skeleton de loading (`grid + Skeleton rounded-2xl`) — nunca spinner central
  sozinho pra lista inteira (era assim no `index.tsx` antigo).
