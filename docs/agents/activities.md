# Atividades (Ordens de Serviço) — Contexto para Agentes

> **Status:** ✅ Fase 0 concluída (2026-08-04) — model, migration, RBAC, SLA
> real, CRUD, execução, evidência em S3, KPIs e frontend (listagem
> redesenhada + tela de gestão) implementados e validados end-to-end (testes
> automatizados contra Postgres real + verificação manual no browser: login,
> criar/atribuir/executar/finalizar). Fase 1 (integração Helpdesk) ainda não
> iniciada — ver §Fases de implementação.

## Responsabilidade
Entidade core (`Activity`) que modela execução de ordem de serviço em campo:
checklist com evidência (foto/texto/número), materiais usados (com flag de
faturável), registro de ocorrências (informativo/impedimento/atraso) e
assinatura do cliente ao finalizar. É **core**, não um recurso do plugin
Helpdesk — o único acoplamento herdado era uma condição de exibição no menu
(`activePlugins.includes("helpdesk")`), não uma dependência arquitetural.

## Arquitetura / fluxo
- **Backend (a criar):** `business/internal/models/activity.go` +
  `activity_checklist_item.go` + `activity_material.go` +
  `activity_occurrence.go`, `AutoMigrate` no bootstrap principal. Controller
  usa `auth.GetScoped(c, "Activities")`, nunca `c.Get("tenantId")` bruto.
- **Frontend (já existe, não mexer no contrato sem necessidade):**
  `frontend/src/pages/MyActivities/` — `index.tsx` (lista), `ActivityExecution.tsx`
  (execução em abas: Checklist / Materiais / Ocorrências / Detalhes),
  `SignatureModal.tsx` (assinatura via `react-signature-canvas`).
- **Sidebar:** item `/my-activities` sai da condição
  `activePlugins.includes("helpdesk")` e passa a usar
  `Can perform="activities:read"`, no mesmo padrão do item `/helpdesk`
  (`SidebarNav.tsx`).
- **Vínculo com Helpdesk:** `Activity.ProtocolID *int` nullable — o Helpdesk,
  ao criar/mover um `Protocol`, pode opcionalmente criar uma `Activity` via
  função exposta pelo core (o plugin chama o core, nunca o inverso — mesmo
  sentido de dependência do resto do sistema de plugins).
- **Vínculo com Pipeline:** `Activity.DealID *int` nullable — mesma lógica,
  permite atividades de campo (instalação/vistoria/entrega) atreladas a um
  `Deal` sem exigir um `Protocol`.
- **Cliente exibido na atividade:** resolvido por **transitividade**
  (`Protocol.Contact.ClientID`, ADR 0023) na composição de
  `GET /activities/:id` — nunca desnormalizar `ClientID` em `Activity`. O
  frontend atual (`DetailsTab.tsx`) já espera `activity.protocol.client.name`
  pronto na resposta; o backend monta esse join, não o frontend.

## Modelo de dados (proposto)
- `Activity`: `id`, `tenantId`, `title`, `description`, `status`
  (`pending|in_progress|done|cancelled`), `priority`
  (`low|medium|high|urgent` — novo, necessário pra SLA por prioridade),
  `protocolId *int` (FK), `dealId *int` (FK), `scheduledAt *time.Time`,
  `startedAt`/`finishedAt *time.Time`, `lastActivityAt time.Time` (novo —
  carimbo atualizado a cada mutação em item/material/ocorrência, base do
  alerta de "atividade parada"), `slaDueAt *time.Time` (novo — calculado no
  create/start a partir de `activities_sla_config` + `priority`, nunca
  recalculado silenciosamente depois que a atividade já está em execução),
  `clientSignatureUrl`, `technicianSignatureUrl` (novo — hoje só existe
  assinatura do cliente), `createdAt`/`updatedAt`.
- `ActivityAssignee`: `activityId`, `userId` — **N:N desde a Fase 0**
  (decisão confirmada: suportar equipe, não só um técnico responsável).
- `ActivityChecklistItem`: `activityId`, `label`, `isRequired`, `isDone`,
  `inputType` (`text|number|photo`), `value` (texto, número serializado, ou
  URL da foto no S3).
- `ActivityMaterial`: `activityId`, `materialName`, `quantity`, `unit`,
  `isBillable`, `notes`.
- `ActivityOccurrence`: `activityId`, `description`, `type`
  (`info|impediment|delay`), `timeImpact` (minutos, nullable).
- Fotos de checklist e assinaturas no **S3 Storage Driver** global (mesmo
  driver do módulo Knowledge Base/Clients), subpasta
  `{tenantId}/activities/{activityId}/`.

## Contratos de API (fiéis ao que o frontend já chama — não renegociar sem
necessidade real)
- `GET /my-activities` → lista as atividades do usuário logado (via
  `ActivityAssignee`).
- `GET /activities/:id` → detalhe completo (items/materials/occurrences +
  `protocol.client` resolvido).
- `PUT /activities/:id/items/:itemId` → atualiza `isDone`/`value`.
- `POST /activities/:id/items/:itemId/photo` (multipart) → upload S3, retorna
  `{ photoUrl }`.
- `POST /activities/:id/materials`, `DELETE /activities/:id/materials/:materialId`.
- `POST /activities/:id/occurrences`, `DELETE /activities/:id/occurrences/:occurrenceId`.
- **Correção de contrato (issue #530):** o `:id` duplicado no path acima era um
  bug — `c.Param("id")` devolve o primeiro match, deixando o id do
  material/ocorrência inalcançável. O contrato real usa `:materialId` e
  `:occurrenceId`.
- `GET /activities/:id` → detalhe. O DTO de resposta **achata**
  `Protocol.Contact.Client` (join transitivo, ADR 0023) para
  `protocol.client.name` — nunca `protocol.contact.client.name`, que seria a
  serialização crua do preload. Ver `activityDetailDTO` em
  `activity_execution.go`.
- `POST /activities/:id/finalize` com `{ clientSignature }` (dataURL PNG) →
  grava `clientSignatureUrl`, `finishedAt`, `status=done`.
- `PUT /activities/:id/start` (novo) → transição explícita `pending→in_progress`,
  grava `startedAt`. Hoje o frontend abre a execução direto sem marcar início
  — ver "Melhorias de UX" abaixo.
- `GET /my-activities/kpis` (novo) → agregados pro dono das atividades (ver
  seção KPIs).
- `GET /activities/sla-config` / `PUT /activities/sla-config` (novo,
  `RequirePermission("activities", "manage")`) → CRUD da config de SLA por
  prioridade.
- **Rotas de gestão (tenant-wide, ausentes do plano original — adicionadas
  para o módulo não nascer sem porta de entrada):**
  - `GET /activities` → lista TODAS as atividades do tenant (não filtra por
    assignee, ao contrário de `GET /my-activities`). Aceita `searchParam`,
    `status`, `priority`.
  - `POST /activities` → cria, aceita `assigneeIds[]` e `items[]` no mesmo
    payload (checklist nasce junto com a atividade).
  - `PUT /activities/:id` → edita dados básicos; recalcula `slaDueAt` só se
    `status=pending`.
  - `DELETE /activities/:id` → soft delete.
  - `PUT /activities/:id/assignees` com `{ userIds }` → upsert por diferença
    (nunca delete+recreate cego).

## SLA — configuração
Reaproveita o padrão já existente no Helpdesk (`helpdesk_sla_config`,
`HelpdeskSection.tsx`/`useSettings.ts`), com uma diferença deliberada: lá o
backend é um **placeholder honesto** (`helpdesk_kanban.go:83-87` — comentário
no próprio código admite que a config é salva mas nunca lida; o dashboard usa
heurística fixa de 24h). Aqui a config é **usada de verdade** desde a Fase 0.

- Setting `activities_sla_config` (JSON por tenant, mesmo formato do
  Helpdesk): `{ low: minutos, medium: minutos, high: minutos, urgent: minutos }`.
- Nova aba em Configurações (`frontend/src/pages/Settings/components/ActivitiesSection.tsx`,
  ao lado de `HelpdeskSection.tsx` na `SettingsSideNav`) — mesmo componente
  visual (`FormField` + `Input type=number` por prioridade), sem inventar um
  padrão novo. Se dois módulos vão ter a mesma tela de "minutos por
  prioridade", vale extrair um `SlaConfigCard` compartilhado
  (`components/ui/`) parametrizado por `settingKey` + labels, usado por
  Helpdesk e Activities — evita duplicar o componente duas vezes.
- Cálculo: ao criar (ou ao dar `start` em) uma Activity, `slaDueAt = now +
  activities_sla_config[priority]`. Se o tenant não configurou
  `activities_sla_config`, cai num default razoável (ex. urgent=2h,
  high=8h, medium=24h, low=72h) — nunca bloqueia a criação por falta de
  config.
- **Correção que fica registrada aqui pra não repetir a dívida do
  Helpdesk:** o dashboard de Activities calcula `onTime/atRisk/overdue`
  comparando `now` com `slaDueAt` de verdade — não um número fixo
  hardcoded.

## KPIs — página "Minhas Atividades"
Cards de resumo no topo da lista (`index.tsx`), antes do grid de cards:
- **Hoje:** atividades com `scheduledAt` no dia corrente.
- **Em andamento:** contagem `status=in_progress`.
- **Atrasadas (SLA estourado):** `status IN (pending,in_progress) AND slaDueAt < now`.
- **Concluídas na semana:** `status=done AND finishedAt >= início da semana`.
- **Tempo médio de execução:** média de `finishedAt - startedAt` das últimas
  N concluídas — dá ao técnico/gestor noção de ritmo real vs. estimado.

Todos vêm de um único `GET /my-activities/kpis` (agregação no backend, não
computada no frontend a partir da lista paginada — a lista pode estar
paginada/filtrada e os KPIs precisam refletir o total real).

## Alertas — atividade parada / demorando demais
Dois sinais distintos, não confundir:
- **Parada (stale):** `status=in_progress` e `lastActivityAt` mais antigo que
  um limiar configurável (`activities_stale_threshold_minutes`, default 60) —
  indica que o técnico abriu a execução e não mexeu em nada há muito tempo.
  Badge amarelo "Parada há Xh" no card da lista.
- **Estourando SLA (at-risk / overdue):** compara `now` com `slaDueAt` —
  badge amarelo quando faltam menos de 20% do prazo total, badge vermelho
  quando já passou (`slaDueAt < now`). Independente de estar parada ou não —
  uma atividade pode estar sendo trabalhada ativamente e ainda assim estourar
  o SLA.
- Ambos os alertas são recalculados **no backend** (`GET /my-activities`
  já retorna `staleSince`/`slaStatus` computados por item) — o frontend só
  exibe, não recalcula prazo/threshold no client.
- Fase 3 (SSE) é o gancho natural pra transformar isso em notificação
  proativa (avisar o gestor quando uma atividade atribuída ao seu setor
  estoura o SLA), mas o cálculo e a exibição na lista **não dependem de SSE**
  — funcionam via polling/refetch desde a Fase 0.

## Melhorias de UX para o dono da atividade (técnico/executor)
- **Início explícito:** hoje o botão "Executar" abre a execução sem marcar
  `status=in_progress`/`startedAt` — perde a base pro KPI de tempo médio e
  pro alerta de "parada". Passa a chamar `PUT /activities/:id/start` na
  primeira abertura (idempotente — não re-marca `startedAt` se já estiver
  `in_progress`).
- **Progresso visível sem abrir a execução:** card da lista ganha barra/label
  "3/7 itens" (checklist) direto no `index.tsx`, sem precisar entrar em
  `ActivityExecution`.
- **Ordenação e filtro por urgência:** lista ordenada por padrão
  `overdue primeiro → at-risk → prazo mais próximo → sem prazo`, com filtro
  rápido por status/prioridade — hoje é uma grid sem ordenação.
- **Prazo visível no card:** contagem regressiva ("Vence em 2h" / "Atrasada há
  40min") em vez de só a data de criação (`createdAt`) que o card mostra
  hoje.
- **Registro rápido de ocorrência a partir da lista:** um impedimento/atraso
  frequentemente acontece antes de abrir o checklist inteiro — vale um atalho
  "Registrar ocorrência" no card, sem forçar entrar na aba certa dentro da
  execução.
- **Resiliência de campo (rede instável):** técnico em campo frequentemente
  tem conectividade ruim — fica como **observação de roadmap** (não é escopo
  da Fase 0): fila local de mutações com retry, já que a UI atual falha com
  toast simples (`"Erro ao salvar item"`) sem re-tentativa.

## Integrações mapeadas (ordem de acoplamento crescente)
1. **Helpdesk → Activity** (`ProtocolID`) — Fase 1.
2. **Pipeline/Deal → Activity** (`DealID`) — Fase 2.
3. **FlowBuilder** — Fase 3: trigger classe `event` ganha subtipo `activity`
   (dispara flow ao criar/finalizar Activity); `FlowRun.subjectType` ganha
   valor `activity` (permite um flow suspender em `waiting_event` até a
   Activity ser finalizada). Aditivo ao `FlowGraph{schemaVersion}` — não
   quebra fluxos existentes.
4. **Real-Time (SSE)** — Fase 3: notificar atribuição (`EmitToTenantRoom` pro
   usuário atribuído) e conclusão (pro setor/gestor). Até lá, o módulo é
   refetch-only, mesmo status de `user`/`queue`/`tag` hoje.
5. **Acessos/RBAC** — escopo por Setor (Alcance=`setor`) só quando esse
   roadmap geral do módulo Acessos for implementado — não antecipar aqui.

## Fases de implementação
- **Fase 0 — ✅ concluída (2026-08-04):** model + migration (`Activity` com
  `priority`/`slaDueAt`/`lastActivityAt`, `ActivityAssignee`,
  `ActivityChecklistItem`, `ActivityMaterial`, `ActivityOccurrence`),
  controller, todas as rotas (inclusive `start`, `kpis`, `sla-config`,
  CRUD+assignees de gestão), permissão `activities:read|create|update|
  delete|manage` no catálogo + backfill retroativo pro Cargo Atendente de
  tenants já existentes, sidebar sai da flag de plugin, aba de SLA em
  Configurações, cards de KPI + badges de alerta em `MyActivities/index.tsx`,
  tela de gestão (`frontend/src/pages/Activities/`) com lista, criar/editar,
  atribuição N:N e montador de checklist. **Sem** vínculo
  Helpdesk/Pipeline/FlowBuilder/SSE nesta fase.
  - **Limitação conhecida, não um bug:** o montador de checklist
    (`ActivityChecklistBuilder`) só é editável na **criação** — o backend não
    expõe rota para adicionar/remover item de uma Activity já existente (só
    `PUT .../items/:itemId` para `isDone`/`value`). Na edição, o formulário
    mostra o checklist existente como leitura. Se isso virar necessidade
    real, requer uma issue nova com `POST/DELETE /activities/:id/items`.
- **Fase 1:** integração Helpdesk (`ProtocolID`, criação opcional a partir de
  um `Protocol`).
- **Fase 2:** integração Pipeline/Deal (`DealID`), assinatura do técnico
  (`technicianSignatureUrl`).
- **Fase 3:** SSE de atribuição/conclusão, trigger `activity` no FlowBuilder.
- **Fase 4 (não planejada em detalhe):** escopo por Setor, quando o roadmap
  geral de Acessos cobrir Alcance=`setor` de fato.

## Invariants
- Sempre usar `auth.GetScoped(c, "Activities")` — nunca `c.Get("tenantId")`
  bruto.
- `Activity.ProtocolID`/`DealID` são sempre nullable e opcionais — Activity
  existe de pé próprio, sem exigir Helpdesk nem Pipeline.
- Cliente exibido é sempre resolvido por transitividade
  (`Protocol.Contact.ClientID`) — nunca desnormalizar `ClientID` em
  `Activity`.
- Atribuição é N:N (`ActivityAssignee`) desde a Fase 0 — não modelar como
  `userId` único na tabela `Activity`.
- Fotos/assinaturas sempre no S3 Storage Driver — nunca base64 gravado direto
  no banco.
- `GET /my-activities` filtra por assignee de forma **incondicional**, fora
  de qualquer branch de alcance — `auth.GetScopedDB` retorna cedo para
  `alcance IN (tenant, plataforma)` (antes do `switch` por tabela), então sem
  esse `WHERE id IN (SELECT "activityId" FROM "ActivityAssignees" ...)`
  explícito um Administrador veria o tenant inteiro. `GetScoped(c,
  "Activities")` continua obrigatório, mas não escopa por usuário sozinho.
- `Session(&gorm.Session{NewDB: true})` precisa de uma instância **nova por
  operação** — reusar o mesmo handle em duas leituras/escritas sequenciais
  acumula condições `Where` e faz a segunda operação casar zero linhas
  silenciosamente (bug real pego pelos testes de `activity_sla.go` durante a
  implementação: `loadActivitySLAConfig` + `loadActivityStaleThresholdMinutes`
  chamadas em sequência sobre o mesmo `db` faziam a segunda sempre cair no
  default). Nunca guardar `db.Session(&gorm.Session{NewDB:true})` numa
  variável reusada em mais de uma query.

## O que NÃO fazer
- Não acoplar `Activity` ao plugin Helpdesk (nem via import, nem via rota) —
  o vínculo é sempre opcional e por FK nullable, com o plugin chamando o
  core.
- Não desnormalizar `ClientID` em `Activity`/`Protocol` — resolver sempre por
  join transitivo, mesmo princípio do ADR 0023.
- Não implementar escopo por Setor (Alcance=`setor`) antes do roadmap geral
  de Acessos cobrir isso — evita dívida de "meia implementação".
- Não mudar o contrato de API que o frontend já consome sem necessidade real
  — o frontend foi construído contra um contrato específico; renegociar
  campos exige atualizar `activityTypes.ts` e todos os componentes
  consumidores na mesma PR.
- Não gravar foto de checklist ou assinatura como base64 no banco.

## Layout de página (listagem) — ✅ implementado
Redesenho de `MyActivities/index.tsx`: toolbar de filtro (status/prioridade/
busca) + abas de filtro rápido com `Badge` de contagem
(`Todas/Atrasadas/Em andamento/Concluídas`) + grid de cards com `Skeleton` de
loading e `ErrorState`/`EmptyState` do design system — no mesmo padrão
horizontal de toolbar/abas da Central "Grupos WhatsApp"
(`frontend/src/pages/GroupsWhatsapp/GruposTab.tsx`). **Correção ao plano
original:** a Central de Grupos **não tem** KPIs no topo — o bloco de KPIs
(`ActivityKpiCards`, `MetricCard`) segue o padrão do Dashboard
(`DashboardKpiRow.tsx`), não o de Grupos. Sem seletor de conexão (Activities
não é por-conexão-WhatsApp). Detalhado em
[`docs/frontend/activities/OVERVIEW.md`](../frontend/activities/OVERVIEW.md)
e [`docs/frontend/activities/COMPONENTS.md`](../frontend/activities/COMPONENTS.md).

## Referência
Este documento · [ADR 0029](../adr/0029-activity-core-entity.md) (Activity
como entidade core, análogo ao ADR 0023 de Clientes) ·
[`docs/agents/clients.md`](clients.md) (padrão de transitividade) ·
[`docs/agents/plugins.md`](plugins.md) (fronteira core/plugin) ·
[`docs/agents/flowbuilder.md`](flowbuilder.md) (Fase 3, trigger
`event`/`subjectType`) · [`docs/frontend/groups/OVERVIEW.md`](../frontend/groups/OVERVIEW.md)
(padrão de layout espelhado) · [`docs/frontend/activities/OVERVIEW.md`](../frontend/activities/OVERVIEW.md)
