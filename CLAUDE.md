# CLAUDE.md

Guia para o Claude Code ao trabalhar neste repositório.

## Project Overview

Watink — plataforma de atendimento e automação no WhatsApp. Microsserviços com RabbitMQ, multitenancy via PostgreSQL RLS, sistema de plugins com licenciamento centralizado.

```
Frontend (React/Vite) ←REST/SSE→ Backend Go (Gin/GORM) ←SQL→ PostgreSQL
                                               ↕ AMQP
                                          RabbitMQ ←── Engine Go (whatsmeow) → WhatsApp
                                               ↕
                                   Plugin Manager · Marketplace Hub
```

## Status Atual (jun/2026)

| Área | Status |
|---|---|
| Frontend — migração MUI v4 → shadcn/ui (163 arquivos, Epic 4B/4D/4F) | ✅ Concluída |
| Frontend — JS/JSX → TypeScript (163 arquivos) | ✅ Concluída |
| Frontend — Design Token System (3 camadas) | ✅ Concluída |
| Frontend — ESLint/Lint governance | ✅ Concluída |
| Frontend — Política anti-MUI (ADR 0008) | ✅ Concluída |
| Backend Go — DI & organização de pacotes | ✅ Concluída (PR #58) |
| Backend Go — API Docs (Scalar + swaggo) | ✅ Concluída |
| Backend Go — Testes unitários (coverage +5pp) | ✅ Concluída (PR #60) |
| E2E — Playwright suite (21 testes + CI job) | ✅ Concluída (PR #61) |
| Dependabot Go deps (crypto/net upgrade) | ✅ Concluída (PR #62) |
| Frontend — Ticket Queue Visibility (filtros `isGroup` + `withUnreadMessages`) | ✅ Concluída (PR #98) |
| Frontend — TicketListItem type badges (community/group/newsletter) | ✅ Concluída (PR #98) |
| Frontend — ESLint rule: permite `hsl(var(--token))` como referência de token | ✅ Concluída (PR #98) |
| Frontend — MessagesList decomposição (799→362L, 9 módulos, GAP-Q) | ✅ Concluída (PR #99) |
| Frontend — Testes TicketListItem + TicketsManager (18 casos, GAP-R) | ✅ Concluída (PR #99) |
| Frontend — Suite de testes 65/65 verde (GAP-T) | ✅ Concluída (PR #100) |
| Frontend — TS-only enforcement (loader.js→ts, ADR 0008, GAP-4) | ✅ Concluída (PR #211) |
| Backend Go — Decomposição god-files controllers round-1 contact/tag/user < 250L | ✅ Concluída (PR #212) |
| Engine Go — events.go decomp + MessageBroker interface + 13 testes offline | ✅ Concluída (PR #213) |
| Engine Go — WhatsAppClient interface + testes offline send_poll/contacts | ✅ Concluída (PR #214) |
| Backend Go — Decomposição god-files controllers round-2 whatsapp/ticket/kb/message/pipeline | ✅ Concluída (PR #215) |
| Security — quic-go v0.59.1 (CVE-2026-40898 DoS) | ✅ Concluída (PR #216) |
| Backend Go — event_listener_message.go split por tipo de evento | ✅ Concluída (PR #217) |
| Backend Go — receive_message.go split dispatch vs enrich | ✅ Concluída (PR #218) |
| Backend Go — Fix N+1 TagController.List() — batch GROUP BY | ✅ Concluída (PR #219/#225) |
| Engine Go — WhatsAppClient interface expansion (Download+MarkRead) + testes send/download | ✅ Concluída (PR #220) |
| Frontend — Fix timeouts TransferTicketModal (waitFor + mock async) | ✅ Concluída (PR #222) |
| Engine Go — testes offline events_message + send_interactive (coverage +) | ✅ Concluída (PR #223) |
| Backend Go — Pipeline: description/type fields, AISuggest real LLM, stage upsert por nome | ✅ Concluída (PR #224) |
| Frontend — Módulo Tickets: separação grupos, avatar, auto-tag, notificações, pipeline integration | ✅ Concluída (PR #225) |
| Backend Go + Frontend — DealController GET/PUT + Pipeline UI redesign (creator/kanban/listing) | ✅ Concluída (PR #225) |
| Backend Go — DealController testes unitários (5 casos List + Update) | ⏳ Em review (PR #227) |
| FlowBuilder — Runtime Fase 0+1 (FlowGraph, FlowRun, interpreter, executores, suspend/resume, guard de ativação) | ✅ Concluída (PR #242/#243) |
| Base de Conhecimento (RAG) — microsserviço `watink-knowledge` (Python/FastAPI) + nó `knowledge` + guardrails+citação | ✅ Concluída (PR #256) |
| Base de Conhecimento — CI Python (ruff+pytest) + higiene `__pycache__` | ✅ Concluída (PR #257/#258) |
| Base de Conhecimento — fonte arquivo (S3/MinIO + parsers PDF/docx/xlsx) | ✅ Concluída (PR #259) |
| Base de Conhecimento — UI (lista, fontes, upload, status SSE tempo-real) | ✅ Concluída (PR #260) |
| Conexões — Subsistema de proxy anti-ban (cripto-at-rest, import Webshare, grupos+rotação, geo cidade/país, teste/test-all, auto-isolação no ban, filtros) | ✅ Concluída (PRs #292-#296) |
| Acessos (ADR 0022) — modelo Cargo/Setor/Alcance + `RequirePermission` fail-closed + anti-lockout | ✅ Concluída (PR #302) |
| Onboarding — Wizard `POST /initial-setup` (Nome Fantasia) + Checklist derivado no Dashboard | ✅ Concluída (PR #303) |
| Plugins — Redesenho Marketplace + Licenciamento via Hub (ADR 0024; Hub em `watink-ecosistema/hub`) | ✅ Concluída (auditado 2026-07-04) |
| Plugins — Marketplace de terceiros (ADR 0025 + Hub ADR 0004; plano em `docs/agents/marketplace-terceiros.md`) | 🔧 Fase 0 implementada (2026-07-04) — pendente review/commit; Fase 1 não iniciada |
| Plugins — Marketplace respeita instância gerida por Watink SaaS (ADR 0026; ADRs irmãos: Hub ADR 0005, watink-saas ADR 0008) | 🟡 Desenho aceito e verificado; implementação a fazer (mudança cirúrgica em `PluginController.Activate`) |

## Services & Ports

| Service | Dir | Stack | Porta |
|---|---|---|---|
| Backend Go | `business/` | Go 1.24 / Gin / GORM | 8082 |
| Engine Go | `engine-go/` | Go 1.24 / whatsmeow | — |
| Frontend | `frontend/` | React 18 / Vite / TypeScript / shadcn+Tailwind v4 | 3000 |
| Plugin Manager (proprietário) | repo privado `alltomatos/watink-plugin-manager` → imagem GHCR | Go / gorilla-mux | 8081 |
| Marketplace Hub | `marketplace-hub/` | Node/Express | 8090 |
| Backend Node (legacy) | `legacy/backend/` | Node/Express/Sequelize | 8080 |
| Engine Node (legacy) | `legacy/engine-standard/` | Node/whaileys | — |

## Commands

### Backend Go (`business/`)
```bash
cd business && go fmt ./...
cd business && go build ./...
cd business && go run cmd/server/main.go
cd business && go test ./...

# Regenerar documentação OpenAPI (obrigatório após adicionar/alterar rotas)
# Commitar docs/docs.go + docs/swagger.json + docs/swagger.yaml no mesmo PR
cd business && go run github.com/swaggo/swag/cmd/swag@latest init -g cmd/server/main.go -o docs/
```

> **API Docs (Scalar)**: `http://localhost:8082/api/v1/docs?token=<JWT>` — requer perfil `superadmin` ou permissão `swagger`.
> JSON OpenAPI: `http://localhost:8082/api/v1/swagger.json?token=<JWT>`

### Engine Go (`engine-go/`)
```bash
cd engine-go && go fmt ./...
cd engine-go && go build ./...
cd engine-go && go run cmd/engine/main.go
```

### Frontend (`frontend/`)
```bash
cd frontend && npm run dev        # Vite dev server (porta 3000)
cd frontend && npm run build      # build de produção
cd frontend && npm run lint       # ESLint
cd frontend && npm run typecheck  # TypeScript sem emitir
```

### Docker
```bash
docker compose -f docker-compose.dev.yml up
docker compose -f docker-compose.dev.yml logs --tail=100 watink-business
docker compose -f docker-compose.dev.yml logs --tail=100 watink-frontend
```

### Smoke Test
```bash
SMOKE_BASE_URL=http://localhost:3000 SMOKE_EMAIL=admin@test.com SMOKE_PASS=test1234 node scripts/playwright-smoke.js
```

→ Referência completa em [`docs/dev/commands.md`](docs/dev/commands.md)

## Git & PR Conventions

→ Detalhes em [`docs/dev/git_workflow_policy.md`](docs/dev/git_workflow_policy.md)

- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `hardening:`, `test:`
- **Branch naming**:
  - `feat/<tema>` — nova funcionalidade
  - `fix/<tema>` — correção de bug
  - `refactor/<tema>` — refatoração
  - `chore/<tema>` — manutenção/tooling
  - `docs/<tema>` — documentação
  - `hotfix/<tema>` — urgência em produção
- **Merge flow**: `feat/*` → `develop` → `main`; `hotfix/*` → `main` → back-merge `develop`
- **PR checklist**: resumo técnico, risco/impacto, evidência de teste, plano de rollback

## Core Engineering Rules

### Editing (Anti-Laziness)

1. **ZERO PSEUDOCÓDIGO** — proibido `// ...`, `// resto do código`, omissões em `Edit`/`Write`.
2. **EDIÇÕES CIRÚRGICAS** — `old_string` deve ser o menor trecho que isola a mudança.
3. **PROIBIDO INVENTAR CONTEXTO** — sempre use `Read` antes de `Edit` em arquivo desconhecido.
4. **CICLO OBRIGATÓRIO**: Read → Edit → Build.
5. **QUEBRA DE LOOP** — se `Edit` falhar 2 vezes seguidas ou `go build` repetir erro estrutural: PARE e alerte o desenvolvedor.

### Modularidade (Anti-God File)

- Arquivos > ~250 linhas devem ser divididos proativamente.
- Em Go, arquivos no mesmo diretório compartilham o pacote — divida sem medo.
- Nunca edite às cegas: use `Read` com `offset`/`limit` em arquivos grandes.

### Backend Go — DI & Segurança

- **DI PURA**: proibido Service Locator, Container Global ou Singleton. Dependências injetadas via construtor em `main.go`.
- **Multitenancy**: use sempre `tenantUUIDFromContext(c)` em controllers Gin. Nunca `c.Get("tenantId")` bruto.
- **Testes**: Mocks em structs locais dentro de cada `Test...` — sem variáveis globais de mock.

## Frontend Design System

→ Referência completa em [`docs/frontend/design-system.md`](docs/frontend/design-system.md)

Stack canônica: **React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui + Lucide React**.  
MUI v4 **completamente removido** — `@material-ui/*` não é dependência do projeto.

**Regras críticas (ADR 0008):**
- `@material-ui/*` e `@mui/*` são **PROIBIDOS** — qualquer import é erro de build.
- Componentes UI: usar exclusivamente `src/components/ui/` (shadcn/ui + Radix UI).
- Ícones: usar exclusivamente `lucide-react`. Não usar `@material-ui/icons`.
- Estilização: Tailwind classes + `cn()`. Proibido `makeStyles`, `withStyles`, JSS.
- Tokens semânticos em HSL cru — usar `hsl(var(--token))` em valores arbitrários Tailwind.
- Cards: sombra, não borda — `rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)]`.
- Todos os arquivos novos em `.tsx`. Proibido `.jsx` ou `.js` em `src/`.

## Security

- **NUNCA** commite `.env`, credenciais ou secrets.
- PostgreSQL RLS + JWT `tenantId` — inclua sempre `tenantId` nas queries.
- Plugin license validation é server-side no **Watink Hub** — token assinado Ed25519 verificado offline pelo `plugin-manager` local; `PluginInstallations.active` é só **alocação**, não autoridade de licença (ADR 0024). O `business` nunca fala com o Hub direto.

## Key Patterns

- **Frontend config**: `src/config.ts` lê `import.meta.env` com fallback `window.ENV`.
- **Engine sessions**: `.sessions_auth/` deve ser Docker volume — perder desconecta todas as sessões WhatsApp.
- **Redis cache**: mensagens com TTL 24h em `wbot:msg:{jid}:{id}`.
- **Plugin activation**: opt-in por tenant via Marketplace grava `PluginInstallations.active` (alocação); plugin `pro` exige licença válida do Hub (via `plugin-manager`, pull+cache ~60s) + teto de tenants. Ver [`docs/agents/plugins.md`](docs/agents/plugins.md) e ADR 0024.

## Módulo: Pipeline

**Responsabilidade:** Funis de vendas com estágios sequenciais, visualizações Kanban/Funil/Gantt/KPIs, e assistente de IA para criação de stages.

**Invariants:**
- Sempre usar `auth.GetScoped(c, "Pipelines")` — nunca `c.Get("tenantId")` bruto
- Create/Update são transacionais (GORM `Transaction()`)
- Stage upsert por nome (ADR 0009) — nunca delete+recreate simples
- `pipeline.type` persiste no banco e determina a view do board

**O que NÃO fazer:**
- Não retornar stages fixas em `AISuggest` — chamar o LLM via settings do tenant
- Não deletar stages sem migrar os Deals vinculados para `stages[0]`
- Não usar `PipelineWizard` — foi removido; fluxo único é `PipelineCreator`
- Não exibir sidebar de chat sem checar `aiPipelineEnabled = "true"`

**Referência:** [`docs/agents/pipeline.md`](docs/agents/pipeline.md)

## Módulo: QuickAnswers (Respostas Rápidas)

**Responsabilidade:** Biblioteca de templates de mensagem pré-escritos para uso no chat manual (autocomplete `/`) e em fluxos automáticos (dispatch via backend).

**Tipos suportados:** `text` · `interactive_buttons` · `list` · `media` · `poll` · `carousel` (pendente validação whatsmeow)

**Invariants:**
- Sempre usar `auth.GetScoped(c, "QuickAnswers")` — nunca `c.Get("tenantId")` bruto
- `UNIQUE(tenantId, shortcut)` — duplicatas rejeitadas no banco
- Dispatch é sempre backend-side via `POST /quickAnswers/:id/send` — frontend só envia `quickAnswerId + ticketId`
- Variáveis `{{contact_name}}` etc. resolvidas no backend, nunca no frontend; valor ausente → string vazia
- `capture_results` em enquetes é opt-in por registro, não global

**Preview:** A página de criação exibe simulação visual da bolha WhatsApp em tempo real. Variáveis `{{contact_name}}` etc. aparecem destacadas no preview — nunca substituídas. Botões e listas são renderizados visualmente (sem ação real).

**O que NÃO fazer:**
- Não montar payload de envio no frontend
- Não bloquear envio por variável ausente
- Não usar campos legados `MediaType`/`DataJson` — substituídos por `type`/`content`
- Não implementar carrossel antes de confirmar suporte nativo no whatsmeow
- Não substituir variáveis no preview — apenas destacar visualmente

**Referência:** [`docs/agents/quick-answers.md`](docs/agents/quick-answers.md)

## Módulo: Real-Time (SSE)

**Responsabilidade:** Push de eventos Business→Frontend (mensagens, tickets, sessões WhatsApp, etc.) em tempo real, via SSE, com fan-out cross-node por Redis Pub/Sub.

**Invariants:**
- Real-time é **100% server-push** — o cliente nunca envia dados reais pelo stream; mensagens vão por `POST /messages/:ticketId`. O stream só carrega inscrição em salas (via query).
- Pontos de emissão dependem da **interface `Broadcaster`**, nunca de uma implementação concreta — `RedisBroadcast` delega ao `SSEBroadcast` via `SSEHub`.
- O backbone Redis (`Publish`/`Start` + guard `SourceID==NodeID`) é agnóstico de transporte — não acoplar lógica de transporte nele.
- Eventos globais são **tenant-scoped** via `EmitToTenantRoom` — nunca `EmitToNamespace("/")` para dados de um tenant.
- Endpoint SSE faz `Flush()` por evento + heartbeat `: ping` (~20s) + header `X-Accel-Buffering: no`.

**O que NÃO fazer:**
- Não voltar a Socket.IO — `go-socket.io` está arquivado e é incompatível com o cliente v4 (ver ADR 0010).
- Não setar `Authorization` no `EventSource` (a spec não permite) — auth vai por query (TTL curto) ou cookie HttpOnly.
- Não emitir dado de tenant com `EmitToNamespace` — usar `EmitToTenantRoom`.
- Não confiar em real-time atrás de proxy sem desabilitar buffering/compressão na rota SSE.
- Não assumir que `user`/`queue`/`tag`/`quickAnswer`/`protocol` têm real-time — não têm emissor (Go nem legado); seguem refetch-only (débito registrado).

**Referência:** [`docs/agents/realtime.md`](docs/agents/realtime.md) · ADR 0010

## Módulo: FlowBuilder (Automação)

**Responsabilidade:** Runtime de automação genérico no WhatsApp — chatbot, sequências, agendamentos e campanhas são perfis do mesmo motor. O `FlowRun` é a instância de execução: fluxos interativos e não-interativos são o **mesmo registro** suspendendo em pontos diferentes do grafo.

**FlowRun (instância de execução):**
- Estados: `running` · `waiting_message` · `waiting_until` · `waiting_event` · `completed` · `aborted` · `expired`
- Campos: `tenantId` (RLS), `flowId`, `currentNodeId`, `subjectType` (`ticket`|`contact`|`none`), `subjectId` (nullable), `vars` (JSONB), `resumeAt` (nullable), `expiresAt`, e **SNAPSHOT do grafo no start** — a run executa a versão do fluxo que a iniciou.
- Substitui o antigo conceito `FlowSession` (que estava apenas comentado em `worker.go`).
- Cada destinatário de campanha = um `CampaignRecipient` materializado como `FlowRun` não-interativo.

**Trigger polimórfico:** classes `message-inbound` (keyword/firstContact/any) · `schedule` (cron) · `event` (ticket/deal) · `manual/api` · `webhook-inbound`. Autorado no **nó do grafo** e **projetado para colunas top-level no save** — o grafo é a verdade, as colunas são índice de leitura barato. O read-path faz fan-out por classe.

**Channel adapters:** ações são portas de saída plugáveis (`OutboundChannelAdapter`). `whatsapp`→engine-go · `email`→SMTP · `api`→HTTP · `pipeline`/`ticket`→serviço interno. O **engine-go permanece adapter burro** — `send-by-sessionId` via contrato AMQP `wbot.<tenant>.<session>.<cmd>`; pacing, rotação e e-mail ficam 100% no business.

**Invariants:**
- Sempre usar `auth.GetScoped(c, "Flows")` em controllers — nunca `c.Get("tenantId")` bruto.
- **No worker, RLS Postgres é INERTE** (o app nunca faz `SET app.current_tenant`) — toda query do worker carrega `WHERE tenantId` **manual**.
- Escritas sempre em `Session(NewDB: true)` — nunca reusar o `db` escopado do GORM para escrita.
- Contrato versionado `FlowGraph{schemaVersion, nodes, edges}` com structs Go espelhando `NodeData`/`Edge`; validado no Create/Update (rejeita tipo desconhecido, IDs duplicados, edges órfãs; ausência de `schemaVersion` = v1 default).
- **Dedup por `env.ID`** (Redis TTL 24h, padrão `wbot:msg:`) antes de qualquer envio real.
- **Fonte da verdade do tempo = `resumeAt`** varrido pelo scheduler (leader-lock Redis SetNX + lock por `FlowRun.id` + UPDATE condicional de status no resume) — **nunca `time.Sleep`** para delays longos.
- Reusar `interpolateVariables` do QuickAnswers — variável ausente → string vazia.
- LLM via settings do tenant, padrão `PipelineController.AISuggest`.
- Precedência: **"sessão manda"** (FlowRun ativo ignora novos triggers) — MAS **opt-out (PARAR/STOP/SAIR) vence sempre**.

**RAG (Fase 2):** retrieval pgvector (HNSW cosine, dimensão fixa 1536, `text-embedding-3-small`) tenant-scoped; guardrails "responder só do contexto" + citação obrigatória + handoff humano em baixa confiança; gate `aiKnowledgeEnabled` espelhando `aiPipelineEnabled`.

**Campanhas (Fase 4):** risco **ESTRUTURAL** de ban (fingerprint whatsmeow detectável pela Meta em 2–8 semanas; anti-ban mitiga o sinal comportamental, não o estrutural). Decisão de produto: construir **com aviso explícito de risco na UI + opt-in/suppression obrigatórios** + roadmap declarado para WhatsApp Business API oficial (BSP). Rotação Reputation-weighted LRU + token-bucket/jitter/batch-pause por conexão + circuit-breaker que retira chip degradado. Status real via cache de `session.status` (nunca DB stale).

**O que NÃO fazer:**
- Não usar `c.Get("tenantId")` bruto nem confiar em RLS no worker — sempre `WHERE tenantId` manual.
- Não reusar o `db` escopado em escritas — usar `Session(NewDB: true)`.
- Não colocar pacing/rotação/e-mail no engine-go — ele é adapter burro (só `send-by-sessionId`).
- Não usar `time.Sleep` para delays longos — agendar via `resumeAt` + scheduler.
- Não enviar sem dedup por `env.ID` no Redis.
- Não deixar novo trigger interromper FlowRun ativo — exceto opt-out (PARAR/STOP/SAIR).
- Não substituir variáveis no preview/contexto sem `interpolateVariables`; não bloquear por variável ausente.
- Não responder fora do contexto no RAG nem omitir citação; baixa confiança → handoff humano.
- Não disparar campanha sem aviso de risco na UI, opt-in e supressão.
- Não reintroduzir `FlowSession` — o conceito único é `FlowRun`.

**Referência:** [`docs/agents/flowbuilder.md`](docs/agents/flowbuilder.md)

## Módulo: Base de Conhecimento (RAG)

**Responsabilidade:** Ingestão e recuperação de conhecimento (RAG) no microsserviço `watink-knowledge` (Python/FastAPI). Fontes (texto, arquivo, URL/site, git) são vetorizadas em KBChunks (pgvector) e consumidas pelos nós `knowledge`/`agent` do FlowBuilder e (futuro) por Agentes standalone. O `business` (Go) é o único gateway: detém metadados, orquestra o turn-taking e valida auth/tenant.

**Arquitetura:**
- `business` (Go): CRUD de bases/fontes + UI, upload p/ S3, publica jobs de ingestão (AMQP), chama retrieval/agent (HTTP interno), orquestra FlowRun. Único exposto ao frontend.
- `watink-knowledge` (Python/FastAPI): ingestão assíncrona + Retrieval RAG + Agent Runtime. Stateless por chamada. Só rede interna do Swarm.
- Scraping delegado: Firecrawl (web) · browserless (JS). Embedding/rerank/web-search via omniroute.
- Mesmo PostgreSQL: KBChunk em `halfvec(2048)` HNSW cosine.

**Invariants:**
- O `business` é o **único gateway** — o frontend nunca fala com o `watink-knowledge` (só rede interna do Swarm + segredo interno).
- **RLS é INERTE** no serviço Python — toda query carrega `WHERE "tenantId" = ?` manual.
- Retrieval/ingestão sempre escopados por **`tenantId + knowledgeBaseId`**.
- Embedding via **omniroute**, modelo configurado em **Configurações → Agente de IA** (`aiEmbeddingModel`); **dimensão global fixa** pelo modelo (hoje 2048 → `halfvec`); `model`+`dim` gravados em cada KBChunk.
- **Configurações ganha**: campo `aiEmbeddingModel` (Agente de IA) + seção **Armazenamento S3** (global, superadmin).
- Ingestão **assíncrona** (worker AMQP), **idempotente por fonte** (re-ingest apaga chunks antigos e reinsere, transacional), lifecycle `pending→fetching→processing→ready|error`.
- **Dedup por hash de conteúdo**; **lock por `sourceId`** evita refresh concorrente.
- Status volta por **evento AMQP** → `business` atualiza a Source e emite **SSE** (Broadcaster) p/ a UI.
- Arquivos no **S3 Storage Driver** (global, subpasta `{tenantId}/{kbId}/{sourceId}/`).
- Guardrails no retrieval: responder só do contexto, citação obrigatória, `< minScore` → "não sei"/handoff. **Nunca alucinar.**
- **Um Agent Runtime**, dois pontos de entrada (Agent node agora, Agente standalone depois).

**O que NÃO fazer:**
- Não expor o `watink-knowledge` à internet nem deixar o frontend chamá-lo direto — sempre via `business`.
- Não confiar em RLS no serviço Python — sempre `WHERE tenantId` manual.
- Não colocar scraping/parsing no `business` nem no engine-go — scraping é Firecrawl/browserless; parsing/embedding é o `watink-knowledge`.
- Não usar chave OpenAI hardcoded p/ embedding — usar o omniroute via a setting `aiEmbeddingModel` (**Configurações → Agente de IA**).
- Não misturar dimensões no mesmo índice — trocar de modelo exige re-embed da base inteira.
- Não usar `vector(N)` p/ N>2000 — usar `halfvec` (HNSW até 4000).
- Não descartar o conteúdo do arquivo no upload (bug atual do `CreateSource`) — persistir no S3.
- Não responder fora do contexto nem omitir citação; baixa confiança → handoff.
- Não construir o Agente standalone como motor separado — reusar o Agent Runtime.

**Referência:** [`docs/agents/knowledge-base.md`](docs/agents/knowledge-base.md) · ADRs 0015 (atualizado), 0018 (microsserviço RAG), 0019 (S3 driver), 0020 (Agent Runtime)

## Módulo: Proxy (Anti-Ban / Conexões)

**Responsabilidade:** Dar a cada conexão WhatsApp um IP de saída próprio (proxy) para mitigar o sinal de **REDE/IP** do anti-ban. Complementa — não substitui — o risco estrutural do ADR 0016. Inclui pool/grupos com rotação (sticky/rotate), teste de conectividade+geo, e auto-isolação no ban.

**Invariants:**
- Senha do proxy SEMPRE cifrada at-rest (`cryptobox`/`PROXY_ENC_KEY`), campo `json:"-"`; nunca em resposta nem log (inclusive o payload AMQP com `proxyUrl`). Fail-closed se a chave faltar.
- **`Session(NewDB:true)` OBRIGATÓRIO** em qualquer escrita/agregação que reusa o `db` de `auth.GetScoped` (2+ ops acumulam condições → casa 0 linhas).
- **Fail-closed SEMPRE:** conexão com proxy configurado mas inutilizável NÃO conecta — nunca cai no IP do servidor.
- Proxy não-`active` (isolated/disabled/banned) **sai da rotação**; `pickGroupProxy` só pega `active`. Isolar = tirar o IP queimado do pool.
- Pick de grupo é ATÔMICO (`UPDATE ... FOR UPDATE SKIP LOCKED RETURNING`) — dois starts não pegam o mesmo IP.
- Schemes: só `socks5://` e `http://` (https rejeitado — whatsmeow #700). O engine roteia por **`SetProxyAddress`** (despacha socks5 ao dialer); SOCKS5 não verificado em smoke-test não vai pra prod.
- 1 proxy por conexão cobre ws+mídia (não setar `NoMedia` — IP sticky único). Sem hot-swap: troca só vale na próxima conexão.
- Geo (cidade/país) é **best-effort** via `ip-api.com`: **só falha de DIAL real rebaixa um proxy**; falha do serviço de geo NUNCA invalida.
- `engine-go` é **adapter burro**: recebe `proxyUrl` pronto no `session.start`; cripto/pacing/geo/rotação ficam no business.
- Auth admin-scoped via `auth.GetScoped(c, "Whatsapps")` — nunca `c.Get("tenantId")` bruto.

**O que NÃO fazer:**
- Não reusar o `db` de `GetScoped` em escritas sem `Session(NewDB:true)`.
- **Não fazer fail-OPEN:** ao deletar/desvincular proxy em modo `group`, zerar SÓ `proxyId` (preservar `proxyMode`/`proxyGroupId`) — flipar para `none` vaza o IP do servidor.
- Não acoplar saúde do proxy ao serviço de geo (ip-api fora ≠ proxy ruim).
- Não usar `SetProxy` cru para socks5 no engine (websocket pode vazar) — usar `SetProxyAddress`.
- Não logar `proxyUrl`/payload de `session.start` (credencial em claro).
- Não tratar proxy como mitigação do fingerprint estrutural (ADR 0016) nem do passkey.

**Referência:** [`docs/agents/proxy.md`](docs/agents/proxy.md) · ADR 0021 (proxy anti-ban) · ADR 0016 (risco estrutural)

## Módulo: Acessos (Usuários, Setores, Cargos, Permissões)

**Responsabilidade:** Autorização do tenant. Substitui o RBAC legado (Profile string + Group + Role inerte) por um modelo de **3 dimensões independentes**: **Cargo** (o que o User pode fazer, via `cargo_permissoes`), **Setor** (onde está — N:N via `user_setores`, com marca `ehGestor`), e **Alcance** (até onde vale — `próprio | setor | tenant | plataforma`). Permissão é **barreira real no backend** (`RequirePermission`), não mais cosmética de menu. Reset de banco autorizado (dev) — sem migração de dado legado.

**Invariants:**
- Sempre usar `auth.GetScoped(c, "Users"|"Setores"|"Cargos")` — nunca `c.Get("tenantId")` bruto.
- **Enforcement faseado**: rotas sensíveis (users/setores/cargos/conexões/faturamento/relatórios/reassign-close-ticket) ganham `RequirePermission` primeiro; demais rotas expandem depois. Nenhuma rota nova de escrita entra sem gate.
- Catálogo de Permission é `recurso:ação` (ex. `tickets:reassign`, `setores:manage`) — nunca granularidade de menu (`resource:view`) para ações que mutam estado.
- Gestor = marca `ehGestor` no vínculo `user_setores`, **não** um Cargo separado — o pacote de gestão soma às permissões do Cargo base. **Hoje esse pacote é concedido em nível de AÇÃO (`recurso:ação`) tenant-wide**: `gestorPackageHasPermission` só verifica se o user tem alguma linha `user_setores` com `ehGestor=true` + o Cargo "Gestor" do tenant — NÃO restringe por qual Setor pertence o recurso da requisição. O escopo de dados por Setor (Alcance=`setor` limitando ao(s) Setor(es) marcado(s)) é **roadmap, ainda NÃO implementado** — não prometer o que o código não faz.
- Gerente Geral/Administrador = mesmo Cargo/pacote, Alcance=`tenant` (ignora a marca de setor — vale para todos).
- **Dono do tenant (`Tenant.OwnerID`) é blindado**: sempre Administrador, não pode perder o Cargo, não pode ser excluído; bloquear remoção do último Administrador do tenant (anti-lockout).
- Setor e Queue são distintos: Setor organiza pessoas/gestão/permissão; Queue roteia Tickets. Setor→Queue é M:N via tabela de junção `setor_filas`; não fundir os dois conceitos.
- Superadmin (Alcance=`plataforma`) vive no plugin SaaS, fora do RBAC do tenant — não modelar como Cargo do tenant.
- Frontend: uma única **Central de Acessos** com abas (Usuários · Setores · Cargos) — Permissions não têm tela própria, aparecem dentro da edição de Cargo (matriz recurso×ação).

**O que NÃO fazer:**
- Não reintroduzir `Group`, `user_roles`, `group_roles`, `RolePermission.Scope/Conditions` — descontinuados no reset (ADR 0022). Se precisar de ABAC condicional no futuro, desenhar de novo, não reativar o campo morto.
- Não deixar uma rota de mutação sem `RequirePermission` "pra depois" — vira dívida idêntica ao estado anterior (permissão sem enforcement).
- Não modelar Gestor como Cargo próprio por Setor (ex. "Gestor de Vendas", "Gestor de Suporte") — multiplica cargos quase idênticos; usar a marca `ehGestor` + Cargo único "Gestor".
- Não permitir remover/rebaixar o último Administrador do tenant nem o dono (`OwnerID`) pela API — validar antes de qualquer DELETE/UPDATE em Users ou vínculos de Cargo.
- Não expor Permissions como CRUD solto no frontend — vivem dentro da tela de Cargo.
- Não confundir Setor com Queue nem fundir os dois modelos nesta refatoração (risco alto no motor de roteamento — fora de escopo).

**Referência:** [`docs/agents/acessos.md`](docs/agents/acessos.md) · ADR 0022 (modelo Cargo/Setor/Alcance + enforcement real)

## Módulo: Onboarding (Setup Wizard + Checklist)

**Responsabilidade:** Reduzir o time-to-value do primeiro acesso — Wizard de Setup Inicial (`POST /initial-setup`, single-step) cria Tenant+Cargo/Setor/Queue/User Administrador; Checklist pós-login (card no Dashboard) guia a criação do primeiro Setor real (com Queue vinculada) e do primeiro usuário adicional.

**Invariants:**
- Wizard continua **single-step** — Nome Fantasia (novo, obrigatório, vira `Tenant.Name`) + dados do admin. Não expandir para multi-step sem nova mentoria.
- Checklist usa **estado derivado**, nunca persistido: item completo quando a contagem de Setores/Usuários do tenant excede o criado automaticamente no setup (`> 1`). Não introduzir uma flag de "onboarding completo" no banco.
- Checklist **não cria nada por conta própria** — só linka para os fluxos reais já existentes na Central de Acessos (SetorController, UserController). Nenhum endpoint novo de criação.
- Checklist só é visível para `alcance IN (tenant, plataforma)` — quem não tem permissão de criar Setor/Usuário não deve ver a sugestão.
- "Criar setor" no checklist faz **auto-open do formulário de criação de Setor** (`/acessos/setores?autoOpen=create&suggestedName=...`, com chips Atendimento/Vendas/Suporte/Financeiro) — **não** cria Queue junto: `SetorController.Create` só faz `db.Create(&setor)`. A Queue é vinculada **depois**, na edição do Setor (`SetorQueuesSection` → `PUT /setores/:id/queues`). Não documentar um bundle "Setor + Queue numa ação só" que não existe.

**O que NÃO fazer:**
- Não transformar o wizard em multi-step para acomodar o guia de primeiro uso — isso é escopo do checklist pós-login, não do setup.
- Não persistir estado de progresso do checklist (flag/Setting) — a contagem em tempo real já resolve, inclusive para quem cria por fora do checklist.
- Não bloquear o uso do sistema até o checklist ser completado — ele é dispensável a qualquer momento.
- Não mostrar o checklist para Cargos sem alcance tenant/plataforma.

**Referência:** [`docs/agents/onboarding.md`](docs/agents/onboarding.md)

## Módulo: Clientes (CRM)

**Responsabilidade:** Entidade de CRM (Pessoa Física/Jurídica) do core do business — agrega Contacts e Addresses, trazendo o Watink para perto de um CRM/ERP. Substitui o antigo plugin licenciado "Gestão de Clientes" (`type: "pro"`, rota `/api/clientes`), que tinha apenas GET/POST e nenhum vínculo real com Contact.

**Invariants:**
- Sempre usar `auth.GetScoped(c, "Clients")` — nunca `c.Get("tenantId")` bruto.
- Client e Contact são entidades distintas que **não se fundem** (ADR 0023): um Contact pode existir e gerar Tickets sem nunca ser vinculado a um Client.
- `Contact.ClientID` é nullable, um Contact pertence a no máximo um Client. Vínculo é sempre **manual** — nenhuma heurística automática de matching nesta fase.
- Revincular um Contact que já pertence a outro Client é permitido, mediante confirmação explícita do agente ("Este contato pertence a Cliente Y. Deseja mover para Cliente X?") — nunca bloqueado silenciosamente.
- Histórico do Client (Tickets/Deals) é resolvido por **transitividade** via `Ticket.Contact.ClientID` — `Ticket`/`Deal` nunca ganham `ClientID` desnormalizado (ADR 0023).
- **Nome Social** (exclusivo de PF) — quando preenchido, substitui o nome civil em **toda** superfície de exibição (lista de Tickets, bolha de chat, cabeçalho, notificações, Pipeline/Deal, Protocol, relatórios). Nunca exibir os dois nomes lado a lado.
- `Client.Document` (CPF/CNPJ) cifrado at-rest, mesmo padrão do módulo Proxy (`cryptobox`, fail-closed se a chave faltar).
- `Client` usa soft-delete (`DeletedAt`) — nunca hard delete.
- Endereço: CEP resolvido via ViaCEP (URL configurável em Settings do tenant, pré-preenchida com o default — nunca hardcoded no frontend). Coordenadas (`geog geography(Point,4326)`, PostGIS) resolvidas via Nominatim/OpenStreetMap no momento do save — geocoding é **best-effort**, falha nunca bloqueia o salvamento do Client.
- Um Client pode ter múltiplos Addresses e múltiplos Contacts.
- Tela de Clientes segue o padrão visual em abas da Central de Acessos (Dados Básicos / Contatos / Endereços).

**O que NÃO fazer:**
- Não fundir Contact e Client numa única entidade — são conceitos distintos que se relacionam (ver ADR 0023 e CONTEXT.md).
- Não desnormalizar `ClientID` em Ticket/Deal para "otimizar" consultas — quebra a resolução automática de histórico quando um Client ganha um novo Contact.
- Não bloquear duro a revinculação de um Contact já vinculado a outro Client — pedir confirmação, não proibir.
- Não implementar matching automático de Contact→Client (por e-mail, documento, etc.) nesta fase — vínculo é 100% manual; roadmap futuro se necessário.
- Não persistir CPF/CNPJ em texto plano.
- Não fazer hard delete de Client.
- Não chamar ViaCEP direto do frontend (client-side) — a chamada é sempre via backend, com URL configurável em Settings.
- Não bloquear o salvamento do Client se o geocoding (Nominatim) falhar.
- Não reintroduzir a rota antiga do plugin (`/api/clientes`) coexistindo com o novo core.

**Referência:** [`docs/agents/clients.md`](docs/agents/clients.md) · ADR 0023

## Módulo: Plugins (Marketplace + Licenciamento)

**Responsabilidade:** Ativação **opt-in por tenant** de features (plugins) via Marketplace, com gating real de licença para as pagas. O core é **cliente** do licenciamento; a autoridade de catálogo/licença é o **Watink Hub** (`watink-ecosistema/hub`), alcançado sempre pelo `plugin-manager` local — nunca direto. Substitui o modelo "flag no banco" (ADR 0024, supera 0003).

**Fronteira core vs plugin:** é plugin o que precisa ser **ativado via Marketplace** (`free` ou `pro`); é core o que está sempre-ligado (atendimento, Clientes, Pipeline, FlowBuilder, RAG). Por isso Clientes virou core (ADR 0023) e o `saas-plugin` foi **removido** (control plane é o `watink-saas`). Plugins reais restantes: `helpdesk`, `webchat`.

**Invariants:**
- Sempre `auth.GetScoped(c, "Plugins")` — nunca `c.Get("tenantId")` bruto; escritas/agregações em `Session(NewDB:true)`.
- `business` consulta **só** o `plugin-manager` (pull+cache ~60s); nunca o Hub direto.
- `plugin-manager` é **proprietário**: fonte só no repo privado `alltomatos/watink-plugin-manager`, distribuído como imagem `ghcr.io/alltomatos/watink-plugin-manager` (compose usa `image:`, **nunca** `build:`). O core (público) fala com ele só pelo contrato HTTP `GET /internal/licenses`.
- Licença = **token Ed25519 verificado offline** (pacote `licensetoken`, dentro do repo privado do plugin-manager — não mais em `business/pkg`) — nunca flag local nem "confiar no corpo do heartbeat".
- Licença é por **instância + teto de tenants**; a **alocação** nominal (qual tenant) é do core (`PluginInstallations`). Teto aplicado na alocação (**fail-closed** em crescimento).
- Plugin `free` não toca o Hub; `pro` exige token válido + teto livre.
- `degradeMode` (`readonly`|`blocked` na expiração) vem do **manifesto do plugin**, por plugin.

**O que NÃO fazer:**
- Não ler `PluginInstallations.active` como autoridade de licença — é só alocação.
- Não chamar o Hub a partir do `business` — sempre via `plugin-manager`.
- Não reportar licença válida sem verificar assinatura Ed25519 + `exp`.
- Não montar teto/licença no frontend (só envia `slug + tenant/ticket` e reflete o status).
- Não reintroduzir `saas-plugin` nem o `marketplace-hub` Node; não distribuir código de plugin dinamicamente (embarcado — anti-supply-chain).
- Não trazer o **source do `plugin-manager`** de volta ao core (`watinkdev` é público) — é compiled-only, vive só no repo privado `alltomatos/watink-plugin-manager` e é consumido como imagem GHCR (não usar `build:` no compose).

**Referência:** [`docs/agents/plugins.md`](docs/agents/plugins.md) · ADR 0024 (supera 0003) · ADR 0025 + plano [`docs/agents/marketplace-terceiros.md`](docs/agents/marketplace-terceiros.md) (expansão para terceiros) · Hub: `watink-ecosistema/hub`

## Domain Docs

- **Glossário**: [`CONTEXT.md`](CONTEXT.md)
- **ADRs**: [`docs/adr/`](docs/adr/) — ver **ADR 0009** para stage upsert, **ADR 0008** para política anti-MUI, **ADR 0007** para decomposição de componentes. **FlowBuilder/Automação**: **0011** FlowRun unificado · **0012** trigger polimórfico · **0013** contrato versionado FlowGraph · **0014** channel adapters · **0015** pgvector RAG · **0016** campanhas anti-ban (risco estrutural + opt-in + roadmap BSP) · **0017** scheduler multi-node. **Base de Conhecimento/RAG**: **0015** (atualizado) pgvector RAG · **0018** microsserviço watink-knowledge + trust boundary · **0019** S3 Storage Driver · **0020** Agent Runtime. **Acessos/RBAC**: **0022** modelo Cargo/Setor/Alcance + enforcement real (supera **0005**, ABAC via RolePermission.Scope/Conditions nunca implementado). **Clientes/CRM**: **0023** Client como entidade core (sai do plugin "pro"), transitividade Contact→Client, documento cifrado at-rest. **Plugins/Licenciamento**: **0024** redesenho do sistema de plugins (Watink Hub como autoridade, token assinado Ed25519, trilho duplo, licença por instância+teto, fronteira core/plugin = ativação; supera **0003** no ponto da flag) · **0025** marketplace de terceiros (publishers, artefatos assinados, runtime out-of-process em fases; plano executável em `docs/agents/marketplace-terceiros.md`; ADR irmão: Hub 0004)
- **Arquitetura**: [`docs/dev/architecture.md`](docs/dev/architecture.md)
- **Frontend DS**: [`docs/frontend/design-system.md`](docs/frontend/design-system.md)
- **Git Workflow**: [`docs/dev/git_workflow_policy.md`](docs/dev/git_workflow_policy.md)
- **Plugins**: [`docs/dev/plugins.md`](docs/dev/plugins.md)
- **Migrations**: [`docs/dev/migrations.md`](docs/dev/migrations.md)
- **Agent config**: [`docs/agents/`](docs/agents/)
- **Roadmap**: [`ORCHESTRATOR-ROADMAP.md`](ORCHESTRATOR-ROADMAP.md) — Epics e milestones do projeto

## Agent Skills

### Issue Tracker
- **Platform**: GitHub (`gh` CLI)
- **Config**: [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)

### Triage Labels
- **Config**: [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md)

### Domain
- **Config**: [`docs/agents/domain.md`](docs/agents/domain.md)
- Use sempre os termos canônicos de `CONTEXT.md` — nunca os termos marcados como `_Avoid_`.
