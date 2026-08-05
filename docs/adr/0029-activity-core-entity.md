# Activity como entidade core, com SLA calculado de verdade desde a Fase 0

A tela "Minhas Atividades" (`frontend/src/pages/MyActivities/`) já existia completa no frontend —
checklist com evidência, materiais faturáveis, ocorrências e assinatura do cliente — mas chamava
endpoints que nunca foram implementados no backend, resultando em 404 permanente
(`GET /my-activities` → "Erro ao carregar atividades"). A investigação inicial supôs que Activity
seria um recurso do plugin Helpdesk, pela condição de exibição de menu
(`activePlugins.includes("helpdesk")` em `SidebarNav.tsx`); revisão corrigiu essa premissa: o
plugin Helpdesk nunca referenciava Activity em código algum, e a condição de menu era puramente
cosmética.

Decidimos `Activity` como entidade **core**, seguindo o mesmo critério que promoveu `Client` (ADR
0023): é plugin o que precisa ser ativado via Marketplace; é core o que está sempre-ligado. Uma
ordem de serviço de campo não é uma feature opt-in de um módulo de atendimento — é capability
central do produto, análoga a Clientes/Pipeline. `Activity.ProtocolID`/`DealID` são vínculos
nullable e opcionais (Fases 1/2), nunca uma dependência de import: o plugin Helpdesk, quando
existir a integração, chama o core — nunca o inverso, mesmo sentido de dependência do resto do
sistema de plugins (ADR 0024).

A atribuição é modelada como `ActivityAssignee` N:N desde a Fase 0, não como `userId` único na
tabela `Activity` — decisão deliberada de suportar equipe (mais de um técnico responsável), evitando
uma segunda migração de dado quando esse caso de uso aparecer.

O cliente exibido numa Activity vinculada a um Protocol é sempre resolvido por transitividade
(`Protocol.Contact.ClientID`) — nunca desnormalizado em `Activity`, mesmo princípio do ADR 0023: um
Client pode ter múltiplos Contacts ao longo do tempo, e desnormalizar criaria uma segunda fonte de
verdade sujeita a dessincronia.

A diferença deliberada em relação ao precedente mais próximo (SLA do plugin Helpdesk) é o ponto
central desta decisão: `helpdesk_sla_config` é uma Setting que o frontend escreve
(`Settings/hooks/useSettings.ts`) e o backend **nunca leu** — o dashboard usa uma heurística fixa
de 24h hardcoded (`helpdesk_kanban.go`), ignorando a prioridade do protocolo inteiramente. Em
Activities, a config `activities_sla_config` é lida de verdade desde o primeiro PR: `slaDueAt` é
calculado no create a partir da prioridade e da config do tenant, e **congelado** a partir de
`status=in_progress` — alterar a config depois não move o prazo de uma atividade já em execução.
Essa regra de congelamento existe porque a ambiguidade "recalcula ou não" foi exatamente o que
permitiu a dívida do Helpdesk nascer sem ninguém decidir explicitamente.

Duas alternativas foram descartadas. Modelar Activity como sub-recurso do plugin Helpdesk foi
descartado porque quebraria o próprio módulo em qualquer tenant que não tenha o Helpdesk ativo, e
Activities de campo (instalação, vistoria, entrega) fazem sentido vinculadas a um Deal do Pipeline
sem nunca passar por um Protocol. Registrar RLS Postgres para as tabelas novas foi descartado
porque o sistema já opera com RLS documentadamente inerte em toda extensão recente (Knowledge Base,
FlowBuilder) — adicionar Activities à lista de `applyRLS()` sugeriria uma garantia que o restante do
sistema não oferece, e poderia induzir alguém a pular o `WHERE "tenantId"` manual por engano.

**Consequences:**
- A calculadora de `slaDueAt` (`activities_sla_config` + `priority`) é o único ponto de verdade
  usado tanto pelo `POST /activities` quanto pelos KPIs — nenhum dos dois reimplementa o cálculo.
- O catálogo RBAC ganha `activities:read|create|update|delete|manage`; tenants criados antes desta
  mudança recebem `activities:read` no Cargo "Atendente" via backfill idempotente no boot
  (`backfillActivitiesReadForAtendente`), porque `SetupService.InitializeTenant` só concede a
  permissão a tenants provisionados depois desta entrada — sem o backfill, o técnico de um tenant já
  existente veria 403 no primeiro acesso.
- Fotos de checklist e assinaturas exigem URL servível por `<img>` sem expor o JWT — resolvido por
  `PresignedGetURL` adicionada a `domain.ObjectStore` (extensão da interface compartilhada com o
  Knowledge Base), não por um proxy de streaming nem por blob no cliente.
- A integração com o plugin Helpdesk (Fase 1) exige estender `business/pkg/sdk` com uma interface
  opcional descoberta por type-assertion (mesmo precedente de `WatinkCoreScheduler`, ADR 0027), já
  que o SDK hoje não tem mecanismo genérico de plugin chamando serviço do core.

## Addendum — Fase 1: `WatinkCoreActivities` e a integração com Helpdesk

`internal/controllers` e `internal/services` já importam `internal/plugins` (`plugin_manager.go`,
`deal.go`, `event_listener.go`) — logo `plugins` **não pode** importar nenhum dos dois de volta
sem criar ciclo. `coreImpl.CreateActivity` (que implementa `sdk.WatinkCoreActivities`) portanto
**duplica** a lógica de defaults/SLA de `ActivityController.Create` em vez de extraí-la para um
pacote compartilhado — mesmo padrão já usado por `SendTicketMessage` (`manager.go:121-124`), que
reimplementa a pipeline de envio pelo mesmo motivo. A alternativa (extrair para um novo pacote em
`internal/domain`, sem dependência de `plugins`/`controllers`, importado por ambos) foi descartada
para não mexer no código da Fase 0 já validado e2e — fica registrada como refatoração possível se
a duplicação um dia divergir. Um teste unitário compara os dois cálculos de `slaDueAt` lado a lado
(mesma prioridade/instante → mesmo resultado) para pegar divergência futura em CI, já que nada no
build a detectaria sozinho.

Escopo da Fase 1 é estritamente `Protocol → Activity`: o Helpdesk cria um Protocol e, com a
Setting `helpdesk_auto_create_activity=true`, opcionalmente cria uma Activity vinculada
(`protocolId` preenchido), **independente de o Protocol ter ou não um `TicketID`** — é política do
tenant, não característica do canal de origem. A direção inversa (uma Activity agendada originar
automaticamente um Protocol de visita técnica) foi cogitada e descartada desta fase: inverteria o
sentido de dependência plugin→core (o core chamaria um recurso do plugin Helpdesk), e já tem lugar
mapeado no roadmap (Fase 3, junto ao trigger `activity` do FlowBuilder). Da mesma forma, o conceito
de "observador" (colaborador com visão só-leitura do status da Activity, distinto de assignee) não
existe no modelo hoje e fica fora desta fase — candidato a issue própria se confirmado como
necessidade real.

`coreImpl.CreateActivity` **bypassa deliberadamente** a permissão `activities:create` — quem chama
é o sistema agindo em nome do Protocol recém-criado, não uma requisição HTTP de um usuário
autenticado contra `/activities`, e não há como (nem motivo para) checar RBAC de Activities dentro
do handler do Helpdesk. Isso é uma exceção explícita ao padrão "toda rota de mutação tem
`RequirePermission`" do módulo Acessos — documentada aqui para não parecer um buraco de segurança
não-intencional. Quando o `userID` do criador do Protocol não é resolvível no contexto (ex.: chamada
de automação/sistema, sem usuário humano), a Activity nasce sem assignee (`AssigneeIDs` vazio) em
vez de falhar ou ser pulada — alguém com `activities:manage` atribui depois pela tela de gestão.
