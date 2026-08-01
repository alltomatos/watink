# Watink
Plataforma open-source de atendimento e automação no WhatsApp com arquitetura de microsserviços, multitenancy via PostgreSQL RLS, e sistema de plugins com licenciamento centralizado.

## Design System & UI Patterns

A fonte canônica de padrões visuais, componentes e tokens é o **Watink Design System v2** localizado em `docs/Watink Design System v2/`.  
O espelho sincronizado vive em `docs/desgner-system/`.  
Governança: `docs/adr/frontend/005-design-system-governance.md`.

### Tech Stack (UI/Frontend)
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4 (Utility-first) + CSS Custom Properties
- **Components**: shadcn/ui (Radix UI primitives) — `frontend/src/components/ui/`
- **Language**: TypeScript obrigatório — arquivos `.tsx`. JS legado READ-ONLY.
- **Icons**: Lucide React
- **Tokens**: `frontend/src/theme/tokens/*.css` (colors, typography, spacing, motion)
- **Tema dinâmico**: `theme/loader.js` — 8 variantes (apple/google/whatsapp/saas × light/dark)

### Princípios de Design
- **Tokens como fonte de verdade**: Cores em HSL raw (`--token: H S% L%`), consumidas como `hsl(var(--token))`. Nunca hardcoded hex.
- **Reuso estrito**: Proibido criar componentes base do zero — estender os 22 componentes em `src/components/ui/`.
- **MUI completamente removido** (jun/2026): `@material-ui/*` não é dependência do projeto. Qualquer import causa erro de build. Stack obrigatória: shadcn/ui + Tailwind + Lucide. Ver ADR 0008.
- **Componentes DS**: `Button`, `Card`, `MetricCard`, `StatusChip`, `Avatar`, `PageLayout`, `Dialog`, `Input`, `Badge`, `Table`, `Tabs`…

## Language

**Ticket**: Unidade central de atendimento — representa uma conversa ativa entre um Contact e um User em um Queue. Criada automaticamente ao receber uma mensagem ou manualmente por um agente.
_Avoid_: Case, chamado, issue, conversation

**Contact**: Pessoa ou grupo do WhatsApp que envia ou recebe mensagens. Pode ser individual (pessoa) ou grupo (isGroup=true). Vincula-se a um Ticket como remetente. Pode existir sem nunca virar um **Client** — mensagem/Ticket não pressupõe cadastro de CRM.
_Avoid_: destinatário, pessoa — não confundir com **Client**: todo Client agrega 1+ Contacts, mas nem todo Contact é (ou precisa ser) um Client.

**Client**: Entidade de CRM (Pessoa Física ou Jurídica) do core do business — agrega 1+ Contacts (`Contact.ClientID`, vínculo sempre manual; um Contact pertence a no máximo um Client) e 1+ ClientAddresses. Nome Social (exclusivo de PF) substitui o nome civil em toda exibição do sistema quando preenchido. `Document` (CPF/CNPJ) cifrado at-rest; soft-delete via `DeletedAt` (nunca hard delete). Histórico (Tickets/Deals) é resolvido por transitividade via `Contact.ClientID` — nunca desnormalizado.
_Avoid_: Customer — não confundir com **Tenant** (organização cliente da plataforma SaaS) nem com **Contact** (identidade WhatsApp).

**ClientAddress**: Endereço vinculado a um Client (rótulo, CEP, logradouro, bairro, cidade, UF, `isPrimary`). Endereço textual resolvido via ViaCEP (URL configurável em Settings, não hardcoded); coordenadas (`geog geography(Point,4326)`, PostGIS) resolvidas best-effort via Nominatim/OpenStreetMap no momento do save — falha de geocoding nunca bloqueia o salvamento do Client.

**User**: Agente ou administrador da plataforma que atende Tickets. A autoridade de um User é resolvida por 3 dimensões independentes (ADR 0022): **Cargo** (o que pode fazer), **Setor(es)** (onde está, N:N, com marca opcional de Gestor) e **Alcance** (até onde vale — próprio/setor/tenant/plataforma). Substitui o antigo campo `Profile` e o vínculo singular `GroupID`.
_Avoid_: Agent, attendant, operador, atendente, Profile, perfil

**Queue**: Fila de roteamento de Tickets — mecanismo técnico de distribuição (estratégia Round-Robin ou Balanced, saudações). Distinta de **Setor** (unidade organizacional de pessoas/permissões): um Setor tem 1+ Queues (`setor_filas`), mas Queue não carrega gestão nem permissões.
_Avoid_: Department, team, setor (não são sinônimos — ver **Setor**)

**ChannelSession**: Sessão ativa de um canal de comunicação (WhatsApp/Telegram). Contém QR code, status de conexão, e configurações por tenant. Representa o estado runtime de um Whatsapp.
_Avoid_: Session, conexão, wbot, instancia

**Whatsapp**: Configuração persistente de um número de WhatsApp. Referência lógica que dá origem a ChannelSessions. Associa-se a Queues via tabela de junção.
_Avoid_: WABA, número, telefone, channel

**Message**: Mensagem individual dentro de um Ticket. Pode ser de texto, mídia, reação ou sistema. Rastreada por Ack (0=pending, 1=sent, 2=delivered, 3=read, 4=error).
_Avoid_: Msg, texto, notificação

**Flow**: Automação visual construída no FlowBuilder. Define chatbots, menus de navegação, e integrações API/Webhook. Executado pelo FlowWorker via RabbitMQ.
_Avoid_: Automation, workflow, bot, chatbot

**Pipeline**: Funil de vendas com estágios sequenciais. Possui `type` ("kanban" ou "funnel") que determina a visualização padrão no board — kanban abre a view de colunas com drag-drop; funnel abre a view de 4 tabs (Quadro, Gantt, KPIs, Funil). Campo `description` opcional descreve o propósito do funil. Cada Pipeline pertence a um tenant (RLS).
_Avoid_: Funnel, CRM, sales-flow

**PipelineStage**: Etapa/coluna dentro de um Pipeline. Possui `name`, `order` (posição sequencial) e `pipelineId`. IDs de stages são estáveis — ao editar um pipeline, stages são preservadas por nome (upsert); stages removidas têm seus Deals migrados para a primeira stage disponível antes da remoção.
_Avoid_: Column, step, fase

**PipelineType**: Enum `"kanban" | "funnel"`. Determina a view padrão do board e ativa features visuais enterprise (alerta de estagnação 7+ dias, totais monetários por coluna) quando `"funnel"`. O threshold de estagnação será configurável via plugin Helpdesk/SLA no futuro.
_Avoid_: board-type, view-mode

**Deal**: Oportunidade comercial dentro de um Pipeline. Rastreia progresso de vendas vinculado a um Contact. Possui `value` (decimal), `status` ("open" por padrão), `stageId` (FK para PipelineStage — preservado pelo upsert de stages), e `ticketId` opcional.
_Avoid_: Opportunity, lead, negócio

**AISuggest (Pipeline)**: Funcionalidade de sugestão de stages via chat integrado ao PipelineCreator. Usa o provedor de IA configurado nas Settings do tenant (`aiProvider`, `aiModel`, `aiApiKey`). Requer `aiEnabled = "true"` e `aiPipelineEnabled = "true"`. Provedor `"custom"` usa `aiCustomBaseURL` como base URL OpenAI-compatível.
_Avoid_: IA automática, bot de pipeline

**Tag**: Marcador categorial aplicado polimorficamente a entidades (Tickets, Contacts, etc.) via EntityTag. Agrupa-se em TagGroups.
_Avoid_: Label, marca, categoria

**Protocol**: Registro formal de atendimento no Helpdesk. Vincula-se a um Contact e opcionalmente a um Ticket.
_Avoid_: Atendimento, registro, chamado helpdesk

**KnowledgeBase**: Coleção nomeada de fontes (KnowledgeBaseSource) vetorizadas para RAG, consumida pelos nós `knowledge`/`agent` do FlowBuilder e (futuro) por Agentes standalone. Ingestão e retrieval rodam no microsserviço `watink-knowledge`; metadados (base/fontes) ficam no `business`. Tenant-scoped.
_Avoid_: FAQ, wiki, documentação

**KnowledgeBaseSource**: Fonte de conteúdo de uma KnowledgeBase — `type` ∈ {text, file, url, website, git}. Carrega o lifecycle de ingestão (`status`, `lastError`, `chunkCount`, `lastIngestedAt`) e o controle de atualização (`updatable`, `refreshSchedule` cron, `nextRefreshAt`). Arquivos ficam no S3 Storage Driver.
_Avoid_: source (isolado), documento, fonte de dados

**watink-knowledge (Knowledge Service)**: Microsserviço Python/FastAPI que executa ingestão e Retrieval RAG. Stateless por chamada — o estado (FlowRun, turn-taking) permanece no `business` (Go). Fala com o `business` por AMQP (ingestão assíncrona + eventos de status) e HTTP interno (retrieval/agent). Só na rede interna do Swarm; nunca exposto à internet.
_Avoid_: RAG service (genérico), serviço de IA, knowledge backend

**Ingestion pipeline**: Fluxo `fetch → parse/scrape → chunk → embed → store` que transforma uma KnowledgeBaseSource em KBChunks pesquisáveis. Assíncrono (worker AMQP), idempotente por fonte, com lifecycle de status (`pending→fetching→processing→ready|error`).
_Avoid_: ingest (isolado), pipeline (genérico), processamento de fonte

**Agent Runtime**: Núcleo único de raciocínio LLM (loop pensa→recupera→responde) com Retrieval RAG como tool e guardrails compartilhados. Exposto de duas formas: o **Agent node** (dentro de um flow) e o **Agente standalone** (futuro). Vive no `watink-knowledge`; o `business` orquestra o turn-taking.
_Avoid_: agente (genérico), bot de IA, LLM loop

**Agent node**: Nó do FlowBuilder que entrega a conversa ao Agent Runtime — atendimento autônomo multi-turno sobre uma KnowledgeBase, suspendendo/retomando em `waiting_message` até resolver ou fazer handoff. Distinto do Knowledge node.
_Avoid_: nó de IA, nó LLM, chatbot node

**Knowledge node**: Nó do FlowBuilder que faz **um** lookup RAG controlado (recupera → responde/sugere/busca → avança). `responseMode`: `auto`|`suggest`|`search`. Distinto do Agent node (multi-turno autônomo).
_Avoid_: nó RAG, nó de conhecimento (genérico)

**S3 Storage Driver**: Abstração S3-compatível (MinIO no dev; R2/AWS S3 em produção) para guardar arquivos de fontes. Config global de sistema (superadmin); isolamento por subpasta `{tenantId}/{kbId}/{sourceId}/`. O `business` faz upload; o `watink-knowledge` baixa para parsing.
_Avoid_: object store (genérico), bucket, file storage

**Proxy (conexão / anti-ban)**: Proxy de saída (`http`/`socks5`) atrelado a uma conexão WhatsApp, dando a ela um IP próprio para mitigar o sinal de REDE/IP do anti-ban. Senha cifrada at-rest. Distinto do **omniroute** (gateway de IA) e do proxy reverso de infra/SSE.
_Avoid_: proxy de LLM, proxy reverso, gateway

**ProxyGroup**: Pool de proxies de onde uma conexão tira o IP, com estratégia de rotação `sticky` (mesmo IP) ou `rotate` (troca o IP a cada reconexão, via pick LRU atômico).
_Avoid_: grupo de proxy (genérico), pool

**ConnectionGroup**: Agrupamento nomeado de conexões WhatsApp (`Whatsapps`) para organização/operação em lote. Distinto de grupo de chat do WhatsApp.
_Avoid_: grupo de WhatsApp, grupo de conexão (genérico)

**isolar (proxy)**: Tirar um proxy da rotação marcando-o como `isolated` (IP queimado), manual ou automaticamente quando a conexão leva ban — evita contaminar outras conexões. Distinto de `disabled` (parado/falhou teste) e `banned`.
_Avoid_: banir proxy, desativar proxy

**ProxyMode**: Como uma conexão usa proxy: `none` (IP do servidor), `single` (um proxy fixo) ou `group` (tira do ProxyGroup com rotação).
_Avoid_: tipo de proxy, modo de conexão

**omniroute**: Gateway OpenAI-compatível do tenant (`aiCustomBaseURL`) que roteia chat, embeddings, rerank e web-search para múltiplos provedores. Endpoint único de IA para o `business` e o `watink-knowledge` — usado por embeddings/Retrieval RAG do core. Distinto de **AiGateway** (plugin "Assistentes de IA"): este é plural e plugin-scoped, usado só para completions dos Assistants.
_Avoid_: gateway (genérico), proxy de LLM, OpenRouter

**aiEmbeddingModel**: Setting do tenant (Agente de IA) com o nome do modelo de embedding roteado pelo omniroute (ex.: `openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free`, 2048 dims). Determina a dimensão do `halfvec`.
_Avoid_: embedding model (genérico), modelo de vetor

**QuickAnswer**: Template de mensagem pré-escrito com tipo estruturado (`text`, `interactive_buttons`, `list`, `media`, `poll`, `carousel`), acionado via atalho `/shortcut` no chat ou por fluxos automáticos via dispatch backend.
_Avoid_: Template, canned response, resposta padrão

**PollResults**: Registro de respostas de enquetes enviadas via QuickAnswer do tipo `poll`, armazenando opção selecionada por contato (`poll_message_id`, `contact_jid`, `option_selected`, `answered_at`). Criado apenas quando `capture_results: true`.

**QuickAnswer dispatch**: Ação de envio de uma QuickAnswer pelo backend, que resolve variáveis de interpolação e despacha o payload ao engine via RabbitMQ. Acionado por `POST /quickAnswers/:id/send`.

**Tenant**: Organização cliente na plataforma SaaS. `Name` é o Nome Fantasia informado no Wizard de Setup Inicial (não mais um placeholder autogerado). Isolamento de dados garantido na prática por filtro `WHERE "tenantId"` manual em todas as queries — a RLS por `app.current_tenant` existe no design mas está **inerte** (o `SET LOCAL app.current_tenant` falha silenciosamente: bind param no `SET` + fora de transação; bug rastreado, correção em andamento). Cada Tenant possui Users, Queues, Whatsapps, e Settings próprios. Não confundir com **Client**: o Tenant é o cliente do Watink; o Client é o cliente do Tenant (CRM).
_Avoid_: Account, organization, empresa, cliente

**Wizard de Setup Inicial**: Formulário público single-step (`POST /initial-setup`), exibido quando o sistema detecta zero usuários/tenants. Coleta Nome Fantasia (vira `Tenant.Name`), dados do Administrador e CPF/CNPJ opcional; cria atomicamente Tenant+Cargos-padrão+Setor+Queue+Tag+Settings.
_Avoid_: Onboarding wizard, tela de setup, cadastro inicial

**Checklist de Onboarding**: Card dispensável no Dashboard, pós-login, visível só para Alcance tenant/plataforma. Guia a criação do primeiro Setor real e do primeiro usuário adicional via os fluxos já existentes — estado derivado por contagem, nunca persistido.
_Avoid_: Tour guiado, first-run experience, getting started

**Cargo**: Conjunto nomeado de Permissions que define **o que** um User pode fazer — o portador de permissões (ex.: Atendente, Gestor, Gerente Geral, Administrador). Tenant-scoped. Renomeia o antigo **Role**; a herança é resolvida de verdade no backend via `RequirePermission` (ADR 0022), não apenas no frontend. O escopo (meu setor vs tenant inteiro) NÃO mora no Cargo — vem do **Alcance**, dimensão ortogonal.
_Avoid_: Role, papel, função, Profile, perfil

**Permission**: Capacidade granular de ação no sistema, no formato `recurso:ação` (ex.: `tickets:reassign`, `setores:manage`). Associada a Cargos via `cargo_permissoes`. Barra a ação de verdade no backend (`RequirePermission`) — não é mais só um gate de visibilidade de menu no frontend.
_Avoid_: Ability, capacidade, permissão (genérica), permissão de menu (legado)

**Setor**: Unidade organizacional que agrupa Users (M:N via `user_setores`) para fins de gestão, relatórios e roteamento — distinto de Cargo (que carrega permissões). Um Setor tem 1+ Queues associadas (`setor_filas`, M:N). A visibilidade de Tickets de um agente **deveria** derivar do(s) Setor(es), mas isso **ainda NÃO está implementado**: hoje `ListTickets` é tenant-scoped + filtro de fila via query string do client (derivação Setor→fila é roadmap). O vínculo `user_setores` carrega a marca `ehGestor` (ver **Gestor**).
_Avoid_: Group (descontinuado — ver abaixo), Team, Department, equipe (isolado)

**Alcance**: Dimensão ortogonal ao Cargo que define até onde a autoridade de um User se estende: `próprio` (só o que é seu) · `setor` (só o(s) Setor(es) que gerencia) · `tenant` (toda a organização) · `plataforma` (todos os tenants — reservado ao Superadmin, plugin SaaS). Um Gestor e um Gerente Geral podem ter o mesmo Cargo/permissões; o que muda é o Alcance.
_Avoid_: Scope (isolado, ambíguo com RolePermission.Scope legado), nível de acesso

**Gestor (Responsável do Setor)**: Marca (`ehGestor=true`) no vínculo `user_setores` de um User para um Setor específico. Não é um Cargo separado — é o Cargo do usuário + o pacote do Cargo "Gestor" do tenant, somado quando há qualquer vínculo `ehGestor=true`. **Hoje esse pacote é concedido em nível de AÇÃO tenant-wide** — o escopo de dados por Setor (Alcance=`setor` limitando aos Setores marcados) é roadmap, ainda NÃO implementado (`gestorPackageHasPermission` não verifica o Setor-alvo do recurso). Um User pode ser Gestor de múltiplos Setores simultaneamente (ex.: Comercial e Vendas).
_Avoid_: Manager (isolado), supervisor (termo legado sem permissões reais), líder

**Gerente Geral**: Cargo com Alcance=`tenant` — mesmas capacidades de gestão de um Gestor, mas aplicadas a TODOS os Setores da organização, sem precisar de marca por Setor.
_Avoid_: Supervisor geral, admin operacional

**Administrador do Tenant**: Cargo com Alcance=`tenant` e todas as Permissions do catálogo. O dono do tenant (`Tenant.OwnerID`) é blindado como Administrador: não pode perder o Cargo, não pode ser excluído, e o sistema bloqueia a remoção do último Administrador (proteção anti-lockout).
_Avoid_: Admin (isolado, ambíguo com Superadmin)

**Superadmin**: Nível de Alcance=`plataforma` — gerencia todos os Tenants. Vive no plugin SaaS (cross-tenant), fora do RBAC de um tenant individual. Não é um Cargo do tenant.
_Avoid_: Admin, super admin (sem hífen), root

**Group**: Conceito legado e DESCONTINUADO (ADR 0022) — substituído por **Setor** (agrupa pessoas) + **Cargo** (carrega permissões). Não usar em código novo, docs ou conversas.
_Avoid_: (termo a evitar — use Setor ou Cargo conforme o caso)

**DistributionStrategy**: Estratégia de atribuição de Tickets a Users dentro de um Queue. Valores: `AUTO_ROUND_ROBIN` (sequência cíclica) ou `AUTO_BALANCED` (menor carga).
_Avoid_: Assignment, alocação, round-robin (isolado)

**DomainEvent**: Evento de domínio emitido pelo sistema (TicketAssigned, MessageReceived, TicketStatusChanged, ContactCreated, SessionStatusChanged). Transportado via RabbitMQ ou EventBus interno.
_Avoid_: Event (genérico), notificação, trigger

**RabbitMQService**: Serviço de mensageria que publica comandos (`wbot.commands`) e consome eventos (`wbot.events`) entre Business e Engine. Gerencia DLQ com retry exponencial.
_Avoid_: Message broker, queue service, AMQP

**CommandPublisher**: Interface publicadora de comandos RabbitMQ com apenas PublishCommand(routingKey, payload). Usada por controllers que enviam mensagens ao Engine.
_Avoid_: RabbitMQ client, publisher interface

**EventConsumer**: Interface consumidora de eventos RabbitMQ. Publico é interno via EventListener — controllers não consomem diretamente events.
_Avoid_: RabbitMQ subscriber, consumer interface

**EventBus**: Interface interna do Go para publish/subscribe de DomainEvents. Distinto de RabbitMQ — é para eventos internos dentro do mesmo processo.
_Avoid_: Event system, message bus, event dispatcher

**CommandPublisher**: Interface publicadora de comandos RabbitMQ com apenas PublishCommand(routingKey, payload). Usada por controllers que enviam mensagens ao Engine.
_Avoid_: RabbitMQ client, publisher interface

**EventConsumer**: Interface consumidora de eventos RabbitMQ. Publico é interno via EventListener — controllers não consomem diretamente events.
_Avoid_: RabbitMQ subscriber, consumer interface

**EventBus**: Interface interna do Go para publish/subscribe de DomainEvents. Distinto de RabbitMQ — é para eventos internos dentro do mesmo processo.
_Avoid_: Event system, message bus, event dispatcher

**FlowWorker**: Consumidor de eventos do `api.events` exchange que executa Flows automaticamente quando Tickets mudam de estado.
_Avoid_: Flow executor, automation engine, bot runner

**Engine**: Microsserviço Go (engine-go) que gerencia conexões WhatsApp via whatsmeow. Consome comandos de sessão e emite eventos de volta ao Business.
_Avoid_: Bot, connector, wbot engine

**TicketType**: Classificação visual de um Ticket derivada de suas flags booleanas — `individual | group | community | newsletter`. Derivado de `isGroup`, `isCommunity`, `isSubGroup`, `isNewsletter`. Exibido como badge de ícone no avatar do `TicketListItem` (community=violet, group=emerald, newsletter=sky).
_Avoid_: ChatType, contactType, conversationType

**Broadcaster**: Interface de emissão de eventos real-time ao frontend — `EmitToRoom`, `EmitToTenantRoom`, `EmitToNamespace`. Desacopla os pontos de emissão do transporte; implementações: `RedisBroadcast` (Socket.IO, legado) e `SSEBroadcast` (alvo). Ver ADR 0010.
_Avoid_: Emitter, socket service, notifier

**Room (Sala)**: Canal lógico de entrega de um evento real-time. Taxonomia: `tenant:{id}` (isolamento por tenant), `chat:{ticketId}` (mensagens de uma conversa), `notification`, `tickets:{status}`, `helpdesk-kanban`. No SSE, o cliente declara as salas na query do stream.
_Avoid_: Channel, topic, namespace, grupo

**Tenant Room**: Sala `tenant:{tenantId}` que isola broadcasts globais (ticket, whatsappSession, contact) por tenant. Auto-inscrita a partir do `tenantId` do JWT na conexão.
_Avoid_: Tenant channel, broadcast room

**Hub**: Registro local de conexões SSE de um nó Business. O consumidor do Redis Pub/Sub entrega eventos às conexões locais via `hub.deliver(room, payload)`, filtrando por sala/tenant.
_Avoid_: Connection pool, registry, SSE manager

**FlowRun**: Instância de execução de um Flow — registro de runtime que representa um único percurso de automação sobre o grafo. Modelo genérico: execuções INTERATIVAS (chatbot aguardando resposta) e NÃO-INTERATIVAS (campanha disparando) são o MESMO tipo de registro, diferindo apenas no ponto onde suspendem. Estados: `running | waiting_message | waiting_until | waiting_event | completed | aborted | expired`. Campos: `tenantId` (RLS), `flowId`, `currentNodeId`, `subjectType` (`ticket | contact | none`), `subjectId` (nullable), `vars` (JSONB), `resumeAt` (nullable), `expiresAt`, e um SNAPSHOT do grafo no start (a run executa a versão que iniciou, não a versão atual do Flow).
_Avoid_: FlowSession, flow instance, execution context, run de fluxo

**FlowSession**: Conceito legado e DESCONTINUADO — existia apenas comentado em `worker.go`. Substituído integralmente por **FlowRun**. Não usar em código novo, docs ou conversas.
_Avoid_: (termo a evitar — use FlowRun)

**FlowTrigger**: Gatilho polimórfico que inicia um FlowRun. Autorado no NÓ inicial do grafo (grafo = fonte da verdade) e PROJETADO para colunas top-level no save (colunas = índice de leitura barato). Classes: `message-inbound` (keyword / firstContact / any), `schedule` (cron), `event` (ticket / deal), `manual/api`, `webhook-inbound`. O read-path faz fan-out por classe. Precedência (Decisão A — "sessão manda"): um FlowRun ativo ignora novos triggers, MAS o opt-out (PARAR / STOP / SAIR) vence sempre.
_Avoid_: trigger (genérico), gatilho, webhook handler, start condition

**Trigger polimórfico**: O modelo de FlowTrigger acima — uma única abstração de gatilho cobrindo múltiplas classes (mensagem, cron, evento, manual, webhook), resolvidas por fan-out no read-path. Grafo é a verdade; colunas top-level são índice derivado no save.
_Avoid_: multi-trigger, trigger genérico

**Channel Adapter (OutboundChannelAdapter)**: Porta de saída plugável pela qual as ações de um Flow emitem efeitos no mundo externo. O `engine-go` permanece adapter BURRO (send-by-sessionId via contrato AMQP `wbot.<tenant>.<session>.<cmd>`); pacing, rotação e e-mail ficam 100% no business. Implementações por canal: `whatsapp → engine-go`, `email → SMTP`, `api → http`, `pipeline/ticket → serviço interno`.
_Avoid_: connector, sender, output handler, port (isolado)

**Campaign**: Disparo em massa de um Flow não-interativo para um conjunto de destinatários. RISCO ESTRUTURAL de ban declarado (fingerprint whatsmeow detectável pela Meta independente de comportamento); o produto exibe AVISO explícito de risco na UI, exige opt-in/suppression, e declara roadmap para WhatsApp Business API oficial (BSP) como caminho zero-risco. Rotação Reputation-weighted LRU + token-bucket/jitter/batch-pause por conexão + circuit-breaker que retira chip degradado.
_Avoid_: blast, broadcast (de marketing), disparo em massa, mailing

**CampaignRecipient**: Cada destinatário de uma Campaign, materializado como um FlowRun não-interativo independente. Carrega o estado de envio individual (running/completed/aborted) e participa do dedup e do pacing por conexão.
_Avoid_: target, lead de campanha, contato de envio

**CampaignSuppression**: Lista de exclusão (opt-out) obrigatória para Campaigns — contatos que NÃO devem receber disparos. Consultada antes de materializar CampaignRecipients. O opt-out (PARAR/STOP/SAIR) também aborta FlowRuns ativos.
_Avoid_: blacklist, denylist, unsubscribe list, lista negra

**KBChunk**: Fragmento indexado de uma KnowledgeBase para Retrieval RAG. Embedding em **`halfvec(2048)`** (HNSW `halfvec_cosine_ops`, pgvector ≥ 0.7), gerado via omniroute, com **`model`+`dim` gravados no chunk** (permite migração de modelo). Tenant-scoped por `WHERE "tenantId"` manual (RLS inerte no serviço).
_Avoid_: chunk (isolado), embedding row, vector, pedaço de KB

**Retrieval RAG**: Recuperação de KBChunks relevantes por similaridade vetorial (`halfvec` HNSW cosine) para fundamentar respostas de IA, tenant+KB-scoped. Guardrails: "responder só do contexto", citação obrigatória da fonte, e handoff humano em baixa confiança (nada acima do `minScore` → "não sei"). Gated por `aiKnowledgeEnabled` (espelha `aiPipelineEnabled`).
_Avoid_: busca semântica, RAG (isolado), context injection

**warmupTier**: Nível de aquecimento/reputação de uma conexão WhatsApp, usado como peso na rotação Reputation-weighted LRU de Campaigns. Conexões mais aquecidas recebem maior volume; status real vem do cache de `session.status` (nunca do DB stale).
_Avoid_: warmup level, reputation score, tier (isolado), aquecimento

**Circuit-breaker (Campanhas)**: Mecanismo que retira automaticamente da rotação uma conexão WhatsApp degradada (queda de status/reputação), interrompendo disparos por aquele chip para conter o sinal de ban. Avalia status via cache de `session.status`, não DB stale.
_Avoid_: kill switch, breaker (isolado), failover, disjuntor

**FlowRunLog**: Registro de auditoria/observabilidade dos passos de execução de um FlowRun — transições de nó, resumes, ações de Channel Adapter e erros. Tenant-scoped, distinto do snapshot do grafo (que é imutável por run).
_Avoid_: run log, trace, execution history, audit trail (genérico)

**Plugin**: Feature **opt-in** que precisa ser **ativada via Marketplace** (por tenant), `free` ou `pro`. Oposto de core (sempre-ligado, sem ativação). Sempre embarcada na imagem — o Marketplace ativa/licencia, não baixa código (ADR 0024/0003). Plugins atuais: `helpdesk`, `webchat`.
_Avoid_: add-on (genérico), módulo (é core), extensão, app

**Marketplace**: Tela no core onde um tenant descobre e **ativa** plugins. Consome o catálogo do Hub (via `plugin-manager`) e reflete o status de licença/alocação. Não monta payload de licença nem fala com o Hub direto.
_Avoid_: loja, store, marketplace-hub (nome antigo do embrião Node, descontinuado)

**Watink Hub**: Sistema central do dono (`watink-ecosistema/hub`, na nuvem) — autoridade de catálogo e **licença de plugin** (token assinado Ed25519) e da licença do `watink-saas`. O `business` nunca fala com ele direto: sempre via `plugin-manager` local. Antigo "Watink Manager".
_Avoid_: Watink Manager, Manager, marketplace-hub, confundir com `plugin-manager` local

**plugin-manager (local)**: Serviço Go (`:8081`) em cada instalação; cliente do Hub para licença de plugin. Faz heartbeat, verifica o token Ed25519 offline, cacheia com grace (= `exp` do token) e serve o status ao `business` (pull+cache ~60s).
_Avoid_: Manager, Hub, Plugin Manager (ambíguo)

**Licença de Plugin**: Direito de uma **instância** usar um plugin `pro`, materializado como token Ed25519 `{instanceId, pluginSlug, tenantCap, degradeMode, exp}` curto, renovado por heartbeat. Autoridade real de gating — não a flag `PluginInstallations.active`.
_Avoid_: chave de licença (é o `licenseKey`), flag de ativação

**Alocação (de plugin)**: Vínculo de um plugin a um tenant específico, registrado em `PluginInstallations` (`active`, `activatedAt/By`). Respeita o **teto** (`tenantCap`) da licença de instância. É alocação, **não** autoridade de licença.
_Avoid_: instalação de plugin (ambíguo), ativação como sinônimo de licença

**degradeMode**: Comportamento na expiração da licença `pro`, declarado no **manifesto do plugin**: `readonly` (vê dados, bloqueia escrita) ou `blocked` (402). Por plugin, não global. Reativa os estados `StatusReadOnly`/`StatusBlocked` do SDK.
_Avoid_: fallback, modo offline, degradação (genérico)

**Assistant**: Entidade de domínio do plugin "Assistentes de IA" — automação conversacional configurável por conexão, com 4 modos: `pipeline` (reage a eventos de um Pipeline com mensagem proativa), `flow` (delega a conversa a um Flow do FlowBuilder), `persona` (conversa multi-turno via Agent Runtime + RAG), `router` (apresenta menu e delega a sub-Assistants na mesma conexão). Plugin `pro`, ativado por tenant no Marketplace. Distinto de **Agent node** (nó dentro de um Flow) — Assistant é a "entrada standalone" do Agent Runtime prevista no ADR 0020, plugável fora do grafo.
_Avoid_: atendente, bot, chatbot (reservados a **User**/**Flow**)

**AssistantRouterOption**: Opção de menu de um Assistant em modo `router` — `label`, `order`, `targetAssistantId` (FK para outro Assistant na MESMA conexão). Tabela relacional (não JSON), mesmo precedente de **PipelineStage**.

**AiGateway**: Provedor de IA cadastrado dentro do plugin "Assistentes de IA" (Configurações → Agentes de IA, visível só com o plugin ativo) — `name`, `provider`, `apiKey` (cifrado at-rest, `cryptobox`), `baseUrl` opcional, `model`. Cada Assistant em modo `persona` (ou `pipeline` com resposta ativa) escolhe um `AiGateway` para completions. Distinto de **omniroute**: `omniroute` é o endpoint único core-wide usado por embeddings/Retrieval RAG (sempre-ligado, uma config por tenant); `AiGateway` é plural, plugin-scoped, e serve só a geração de resposta dos Assistants.
_Avoid_: gateway (genérico), confundir com omniroute


## Entity Relationships (Canonical)

```
Tenant ──1:N──> User
Tenant ──1:N──> Queue
Tenant ──1:N──> Whatsapp
Tenant ──1:N──> Setting
Tenant ──1:N──> Ticket

User ──M:N──> Queue        (via user_queues)
User ──N:1──> Cargo         (cargoId; cargo base do usuário)
User ──M:N──> Setor         (via user_setores; carrega ehGestor bool)
User.alcance ← enum: próprio | setor | tenant | plataforma

Queue ──M:N──> Whatsapp     (via whatsapp_queues)
Queue ──self──> Queue        (ParentID)

Setor ──M:N──> Queue        (via setor_filas; Setor organiza, Queue roteia)
Cargo ──M:N──> Permission   (via cargo_permissoes)

Contact ──1:N──> Ticket
Client ──1:N──> Contact     (Contact.ClientID nullable; vínculo manual)
Client ──1:N──> ClientAddress
Ticket ──1:N──> Message
Ticket ──N:1──> Queue
Ticket ──N:1──> User (assignee)
Ticket.TicketType ← derivado de flags: isGroup, isCommunity, isSubGroup, isNewsletter

Whatsapp ──1:N──> Ticket
```

**[REMOVIDO no ADR 0022 — reset de banco]**: `Group`, `user_permissions`, `user_roles`, `group_permissions`, `group_roles`, `RolePermission.Scope/Conditions` (ABAC nunca implementado). Substituídos por `user_setores`, `setor_filas`, `cargo_permissoes`.

## RabbitMQ Routing Key Pattern

`wbot.{tenantId}.{sessionId}.{domainEvent}`

### Command Direction (Business → Engine)
- `wbot.{t}.{s}.session.start|stop|delete`
- `wbot.{t}.{s}.message.send.text|media`
- `wbot.{t}.{s}.message.markAsRead`

### Event Direction (Engine → Business)
- `wbot.{t}.{s}.session.qrcode|pairing_code|status|history_sync`
- `wbot.{t}.{s}.message.received|ack|revoke|reaction`
- `wbot.{t}.{s}.contact.update` — inclui persistência de `isCommunity` via engine event
