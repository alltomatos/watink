# Plano de Execução — Plugin "Grupos e Comunidades"

> **Para o agente executor.** Plano operacional de um plugin novo, first-party, embarcado
> (ADR 0003/0024 — nada de terceiro/out-of-process aqui, ver `docs/agents/marketplace-terceiros.md`
> só como referência de fases/aceite, não como pré-requisito). Leia antes:
> [`docs/dev/plugins.md`](../dev/plugins.md) (como construir um plugin), `docs/agents/plugins.md`
> (licenciamento), e a doc de contrato da izapia (link na Fase 0).

**Status:** ✅ **implementado e fechado** (issues #514-#524, todas as fases concluídas —
código, testes, frontend, catálogo do Hub). Este documento permanece como registro da pesquisa
original e das decisões de design; onde a implementação divergiu do planejado aqui, a fonte de
verdade passa a ser o código e `engine-go/docs/groups-api.md` (contrato final, com as
divergências documentadas explicitamente). Principais divergências:

- **Sequência real**: engine-go e business rodaram em paralelo (não em série), como decidido
  na sessão de fechamento do plano — T2.1/T2.2 não esperaram o gate de engine-go completo.
- **`PUT /groups/:id` único** em vez de uma rota POST por campo de configuração (subject/
  announce/locked/... eram rotas separadas no desenho original de T0.1) — alinhado ao que o
  `enginego.Provider` já implementava.
- **Shape real da comunidade na izapia é diferente do inferido em T0.1** — validado ao vivo
  (criação + leitura + limpeza de uma comunidade de teste real) durante T1.3, com o mapeamento
  corrigido em `izapia.Provider`. Ver `engine-go/docs/groups-api.md`.
- **Catálogo do Hub ficou em `status: draft`** — preço não definido pelo dono na sessão de
  execução; plugin não está visível no Marketplace até publicação manual.
- **`GET /communities` não tem método próprio em `domain.GroupEngine`** — deriva de
  `ListGroups()` filtrado por `isCommunity`, o que deixa a lista sempre vazia em conexões
  `izapia` (campo que a API dela não retorna). Ver invariant correspondente em `CLAUDE.md`.
- **`joinApprovalMode` não tem rota REST dedicada no plugin** — `domain.GroupEngine` tem o
  método, mas `internal/plugins/groups.go` não expõe um endpoint isolado para ele; a UI
  desabilita o toggle correspondente (a aprovação em si funciona via `join-requests`).

Estado original da pesquisa (útil para contexto histórico) preservado abaixo.

**Decisões já tomadas com o dono:**
- Escopo do MVP: **completo** — grupos (CRUD, participantes, convite, configurações) +
  comunidades (criar, vincular/desvincular subgrupo).
- Tipo de catálogo: **`pro`** — passa pelo trilho de licença/checkout do Hub (igual Helpdesk).

---

## 1. Estado atual (levantado nos 4 repos)

| Repo | O que já existe | O que falta |
|---|---|---|
| `engine-go` | Lê passivamente metadados de grupo (`GetGroupInfo` do whatsmeow) só para taguear mensagens recebidas como comunidade/subgrupo (`groupMeta` em `internal/whatsapp/service.go`/`events_message.go`). Nenhuma ação de escrita. Só expõe `/health` via HTTP (`internal/health/server.go`) — todo o resto é comando AMQP fire-and-forget (`internal/command/router.go`, tipos fechados: `session.*`, `message.*`, `contact.*`, `history.*`). | Toda a superfície de gestão ativa de grupo/comunidade (criar, participantes, convite, configs) e uma forma **síncrona** de responder (ver §3). |
| `business` (`watinkdev`) | Abstração de provider já existe e é o encaixe natural: `domain.WhatsAppEngine` (porta) com duas implementações — `internal/infrastructure/enginego/provider.go` (AMQP, routing key `wbot.<tenantId>.<sessionId>.<cmd>`) e `internal/infrastructure/izapia/provider.go` (HTTP, resolve credencial por tenant via `models.IzapiaConfig` + `cryptobox`). Extensões opcionais já seguem o padrão de type-assertion (`RichMessageEngine`). `models.Whatsapp.EngineType` decide qual provider é usado por conexão; `IzapiaSessionID` guarda o `{sid}` da izapia. Plugins embarcados seguem o padrão `internal/plugins/<nome>/*.go` (ver `helpdesk.go`) + `PluginManager.Register` em `internal/routes/routes.go`. | Um plugin `groups`/`communities`, a nova porta de extensão `GroupEngine`, e as duas implementações da porta. |
| `hub` | Catálogo (`CatalogEntry`: slug, type, priceCents, taxRatePercent, description...) e todo o trilho de licença Ed25519 já funcionam (usado pelo Helpdesk). | Só a entrada de catálogo nova — nada de mecanismo novo. |
| `watink-plugin-manager` | Nada específico a mudar — só passa a servir o catálogo com a entrada nova no próximo heartbeat. | — |
| iZapia (SaaS externo, mesmo time) | **Já implementa tudo isso** — 18 rotas de grupo + 4 de comunidade sob `/api/v1/sessions/{sid}/...`, ver §2. | — |

**Consequência prática:** a izapia já resolveu o design deste domínio. O caminho de menor risco é
**espelhar o contrato dela** (nomes de campo, shape de resposta) tanto na nova API interna do
engine-go quanto na API pública que o plugin expõe no `business` — evita reinventar semântica e
deixa os dois providers (`enginego`, `izapia`) quase simétricos em código.

## 2. Referência — contrato izapia (`https://api.izapia.com/openapi.json`)

Auth: `Authorization: Bearer <api-key>`. Sessão identificada por `{sid}` plano (sem hierarquia).
Envelope de resposta uniforme: `{ok, data, raw, error}`. Grupo/comunidade identificados pelo
**JID completo** (`123456789@g.us`), não por um ID numérico separado.

**Grupos** (`/api/v1/sessions/{sid}/groups...`): listar, criar (`subject`+`participants[]`),
entrar por link (`join`), pré-visualizar por link sem entrar (`preview`), consultar por id,
`announce` (só admin manda mensagem), `description`, `invite` (get) / `invite/revoke`,
`join-approval-mode`, `join-requests` (listar/aprovar-rejeitar), `leave`, `locked` (só admin edita
metadados), `member-add-mode`, **`participants`** (endpoint único com `action: add|remove|
promote|demote` + `participants: jid[]`), `picture`, `subject`.

**Comunidades** (`/api/v1/sessions/{sid}/communities...`): criar (`name`), consultar (grupos
vinculados + participantes agregados), vincular grupo (`.../groups/{groupId}`), desvincular
(`.../groups/{groupId}/remove`). Não há gestão de participante no nível de comunidade — sempre
via grupo individual.

> Guardar esse levantamento completo (tabela de 18+4 rotas) como anexo de referência do PR da
> Fase 0 — não repetir aqui a tabela inteira para não desatualizar; a fonte de verdade é o
> OpenAPI ao vivo.

## 3. Decisão arquitetural central (para validar/travar na Fase 0)

**Problema:** o `enginego.Provider` hoje só sabe *publicar comando* (fire-and-forget via AMQP) —
não tem canal de retorno síncrono. Gestão de grupo é inerentemente request/response (ex.: "lista
os grupos" precisa da lista *agora*, não de um evento que chega depois). A izapia resolve isso
sendo uma API HTTP normal.

**Proposta:** dar ao `engine-go` uma **segunda porta HTTP interna** (novo `net/http` server, porta
própria, só acessível dentro da rede docker — nunca exposta publicamente, análogo ao `/health`
mas com superfície real), com rotas que **espelham 1:1 o contrato da izapia** para grupos/
comunidades (`GET/POST /sessions/{sid}/groups`, etc.), implementadas chamando o `*whatsmeow.Client`
já vivo em memória (`WhatsAppService.clients[sessionID]`) — sem AMQP no meio, é uma chamada
request/response comum.

**Por que não estender o padrão AMQP existente:** exigiria inventar um mecanismo de RPC sobre
fire-and-forget (correlation id + reply-to + timeout) só para este domínio, enquanto o resto do
engine-go continua fire-and-forget — mistura dois paradigmas por pouco ganho. A API HTTP interna
resolve o mesmo problema com o padrão mais simples e ainda entrega **paridade de contrato** com a
izapia de graça (o `enginego.Provider` e o `izapia.Provider`, no `business`, ficam quase
código-espelho: um chama `http://engine-go:PORT/sessions/{sid}/groups`, o outro chama
`https://api.izapia.com/api/v1/sessions/{sid}/groups`).

**Consequência no `business`:** nova porta de extensão opcional (mesmo padrão de
`RichMessageEngine`, type-assertion sobre o `WhatsAppEngine` resolvido):

```go
// domain/interfaces.go
type GroupEngine interface {
    ListGroups(ctx, w models.Whatsapp) ([]GroupInfo, error)
    GetGroup(ctx, w models.Whatsapp, groupJID string) (*GroupInfo, error)
    CreateGroup(ctx, w models.Whatsapp, subject string, participants []string) (*GroupInfo, error)
    UpdateParticipants(ctx, w models.Whatsapp, groupJID string, action string, participants []string) ([]ParticipantResult, error)
    UpdateGroupSettings(ctx, w models.Whatsapp, groupJID string, patch GroupSettingsPatch) error // subject/description/picture/announce/locked/memberAddMode
    GetInviteLink(ctx, w models.Whatsapp, groupJID string) (string, error)
    RevokeInviteLink(ctx, w models.Whatsapp, groupJID string) (string, error)
    JoinByLink(ctx, w models.Whatsapp, link string) (string, error) // groupJID
    LeaveGroup(ctx, w models.Whatsapp, groupJID string) error
    ListJoinRequests(ctx, w models.Whatsapp, groupJID string) ([]JoinRequest, error)
    ResolveJoinRequests(ctx, w models.Whatsapp, groupJID string, action string, participants []string) error

    CreateCommunity(ctx, w models.Whatsapp, name string) (*CommunityInfo, error)
    GetCommunity(ctx, w models.Whatsapp, communityJID string) (*CommunityInfo, error)
    LinkGroupToCommunity(ctx, w models.Whatsapp, communityJID, groupJID string) error
    UnlinkGroupFromCommunity(ctx, w models.Whatsapp, communityJID, groupJID string) error
}
```

Ambos providers implementam essa interface: `enginego.Provider` via a nova API HTTP interna,
`izapia.Provider` via o `Client` HTTP já existente (`internal/infrastructure/izapia/client.go`),
quase proxy puro dos endpoints já mapeados no §2. O plugin embarcado (§4) faz
`engine, _ := resolver.EngineFor(whatsapp)`, type-asserta para `domain.GroupEngine`, e devolve 501
claro se algum dia surgir um terceiro provider sem essa extensão implementada.

## 4. Repos envolvidos e papel

| Repo | Caminho local | Papel |
|---|---|---|
| `engine-go` | `watinkdev/engine-go` | Nova API HTTP interna de grupos/comunidades sobre whatsmeow (mirror do contrato izapia) |
| `watinkdev` (business + frontend) | `watinkdev/business`, `watinkdev/frontend` | Porta `GroupEngine` + 2 implementações, plugin embarcado `internal/plugins/groups/`, rotas REST, RBAC, telas |
| `hub` | `hub` | Entrada de catálogo nova (`slug`, `type=pro`, preço, descrição, ícone) |
| `watink-plugin-manager` | `watink-plugin-manager` | Nenhuma mudança de código — só serve o catálogo atualizado |

**Validação por repo antes de commit:** engine-go/business seguem os mesmos comandos do
`marketplace-terceiros.md` (`go fmt/build/test`, `swag init` se mexer em rotas,
`npm run lint && npm run typecheck` no frontend); hub `make check`.

## Invariants (violar = parar e alertar)

1. `enginego.Provider` e `izapia.Provider` continuam sendo os **únicos** pontos que sabem qual
   transporte usar — o plugin/handler nunca fala AMQP ou HTTP externo diretamente, só a interface
   `domain.GroupEngine`.
2. A nova API HTTP interna do engine-go **nunca** sai da rede docker interna (sem porta publicada
   externamente, sem TLS público) — é um detalhe de implementação do `enginego.Provider`, não uma
   API pública do Watink.
3. Toda rota do plugin no `business` é `tenantId`-scoped e passa pelo gating de licença padrão
   (`RegisterRoute`, ADR 0024) — nenhuma rota de grupo escapa do `PluginRegistry.GetStatus`.
4. Ações de escrita em massa (adicionar N participantes, criar M grupos em sequência) passam por
   **rate limiting/throttling explícito** — WhatsApp bane números por flood de ações administrativas
   de grupo tanto quanto por flood de mensagens (mesmo risco documentado em `risk.go`/ADR de
   anti-ban do engine-go). Nenhuma ação em lote pode ser fire-and-forget sem limite de taxa.
5. Grupo/comunidade é identificado pelo **JID completo** ponta a ponta (nunca inventar um ID
   numérico próprio do Watink pra isso) — mantém paridade com izapia e evita uma tabela de
   mapeamento extra para manter sincronizada.
6. Campos novos de catálogo são aditivos (mesma regra do marketplace-terceiros).

---

## FASE 0 — Design e contrato (bloqueante)

### T0.1 — Fechar o contrato da API HTTP interna do engine-go
**Repo:** engine-go. **Depende de:** nada.
- Definir porta (env `GROUPS_API_PORT`, sugestão `8084`), autenticação interna mínima (rede docker
  já é a fronteira, mas considerar um shared-secret simples tipo `X-Internal-Token` — decidir se
  reaproveita algum segredo já injetado no compose), e o subconjunto exato de rotas do §2 a
  implementar no MVP completo (grupos + comunidades = as 22 rotas do levantamento, menos
  `preview`/`join`/`join-requests` se decidir que Watink não faz o tenant "entrar" em grupos de
  terceiros no MVP — **decisão do dono**, listar explicitamente as incluídas/excluídas no PR).
- **Aceite:** doc curta `engine-go/docs/groups-api.md` com a lista final de rotas, payloads,
  porta e auth, linkada deste plano.

### T0.2 — Fechar a assinatura de `domain.GroupEngine` e o slug do plugin
**Repo:** watinkdev. **Depende de:** T0.1 (payloads precisam bater).
- Validar a interface do §3 contra o T0.1 fechado; definir `slug` do plugin (sugestão:
  `grupos-comunidades`), nomes de permissão RBAC (`view_groups`, `edit_groups`,
  `manage_communities`), e o prefixo de rota REST do plugin (sugestão: `/groups`, `/communities`,
  sem colidir com `internal/controllers/connection_group.go`/`proxy_group.go`/`tag_groups.go` —
  que são conceitos de "grupo" totalmente diferentes já existentes no core, cuidado ao nomear
  models/handlers pra não confundir).
- **Aceite:** assinatura final da interface + nomes travados num comentário no topo do arquivo
  novo `domain/group_engine.go` (ou seção em `interfaces.go`).

**Gate Fase 0 → 1:** T0.1 + T0.2 aceitos.

---

## FASE 1 — engine-go: API HTTP interna de grupos/comunidades

### T1.1 — Servidor HTTP interno + rotas de leitura
**Repo:** engine-go. **Depende de:** gate F0.
- Novo pacote `internal/groupsapi/` (mux próprio, sobe junto do `health.Start`), rotas GET:
  listar grupos da sessão, consultar grupo, consultar comunidade. Usa
  `WhatsAppService.getConnectedClient(sessionID)` + métodos nativos do whatsmeow
  (`GetJoinedGroups`, `GetGroupInfo`, `GetSubGroups`) — sem cache próprio novo além do que já
  existe (`groupMetaMap`), já que aqui a call é síncrona e barata.
- **Aceite:** testes de unidade cobrindo sessão não conectada (erro claro), grupo inexistente
  (404), happy path com client fake (padrão já usado em `service_test.go`).

### T1.2 — Rotas de escrita (grupo)
**Repo:** engine-go. **Depende de:** T1.1.
- Implementar criar/entrar-por-link/participantes(add,remove,promote,demote)/convite(get,revoke)/
  configurações(subject,description,picture,announce,locked,memberAddMode)/join-approval/
  join-requests/leave, conforme o subconjunto fechado em T0.1. Aplicar o rate limit do invariant 4
  aqui (é a única camada que fala com whatsmeow de fato).
- **Aceite:** testes cobrindo cada ação, incluindo rejeição por rate limit e propagação de erro do
  whatsmeow (ex.: "not admin") como 4xx claro no envelope de resposta.

### T1.3 — Rotas de comunidade (criar, vincular, desvincular)
**Repo:** engine-go. **Depende de:** T1.1.
- **Aceite:** testes cobrindo criação, vínculo e desvínculo, incluindo o caso de tentar vincular
  um grupo que já pertence a outra comunidade.

**Gate Fase 1 → 2:** T1.1–T1.3 aceitos, doc `groups-api.md` atualizada com o contrato real (se
divergiu do desenho da Fase 0).

---

## FASE 2 — business: porta, providers, plugin embarcado

### T2.1 — `domain.GroupEngine` + implementação `enginego.Provider`
**Repo:** watinkdev. **Depende de:** gate F1.
- Implementar a interface fechada em T0.2 chamando a API HTTP interna do engine-go (cliente HTTP
  simples, timeout curto, sem retry automático em escrita — evita duplicar ação de grupo).
- **Aceite:** testes com servidor HTTP fake local cobrindo happy path + timeout + erro 4xx/5xx
  propagado como erro tipado (`utils.NewFriendlyError`, padrão já usado no `izapia.Provider`).

### T2.2 — Implementação `izapia.Provider`
**Repo:** watinkdev. **Depende de:** gate F1 (pode rodar em paralelo a T2.1).
- Mesma interface, chamando o `Client` já existente contra os endpoints do §2, resolvendo
  `w.IzapiaSessionID` como `{sid}`.
- **Aceite:** testes com o mesmo padrão de mock HTTP já usado nos outros métodos do provider
  izapia.

### T2.3 — Plugin embarcado `internal/plugins/groups/`
**Repo:** watinkdev. **Depende de:** T2.1 + T2.2.
- Estrutura seguindo o padrão do Helpdesk (`groups.go` manifest/OnActivate, `groups_handler.go`,
  `groups_participants_handler.go`, `groups_community_handler.go`, `groups_service.go` — service
  resolve o provider via `WhatsAppEngineResolver` + type-assert `domain.GroupEngine`, devolve 501
  claro se o provider resolvido não implementar a extensão).
- Rotas REST no plugin (via `core.RegisterRoute`): `GET/POST /groups`, `GET/PUT /groups/:id`,
  `POST /groups/:id/participants`, `GET/POST /groups/:id/invite-link`, `POST /groups/:id/leave`,
  `GET/POST /groups/:id/join-requests`, `POST /groups/join`, `GET/POST /communities`,
  `GET /communities/:id`, `POST/DELETE /communities/:id/groups/:groupId` — `:id`/`:groupId` são o
  JID (invariant 5), path-encoded.
- Migration de permissões (`view_groups`, `edit_groups`, `manage_communities`) seguindo o padrão
  Sequelize descrito em `docs/dev/plugins.md`.
- Registrar em `internal/routes/routes.go`: `pluginManager.Register(&plugins.GroupsPlugin{})`.
- **Aceite:** testes de handler cobrindo RBAC (403 sem permissão), gating de licença (402 sem
  alocação/licença — reusa o `PluginRegistry` real via teste de integração leve), e o 501 quando o
  provider da conexão não suporta a extensão.

**Gate Fase 2 → 3:** T2.1–T2.3 aceitos, `swag init` rodado, Swagger publicado.

---

## FASE 3 — frontend

### T3.1 — Páginas e componentes
**Repo:** watinkdev/frontend. **Depende de:** gate F2.
- `pages/Grupos/` (lista + detalhe + gestão de participantes + link de convite) e
  `pages/Comunidades/` (lista + vincular/desvincular subgrupo), seguindo a convenção de
  `pages/Helpdesk/`. Gating de menu via `hasPermission("view_groups"|"manage_communities")`.
  Ação "adquirir" no Marketplace se `pro` sem licença (fluxo já existe, T0.3 do
  `marketplace-terceiros.md`).
- **Aceite:** `npm run lint && npm run typecheck` verdes; fluxo manual em dev cobrindo criar grupo,
  adicionar/remover participante, gerar link de convite, criar comunidade e vincular um grupo.

---

## FASE 4 — Hub: catálogo

### T4.1 — Cadastrar o plugin no catálogo
**Repo:** hub. **Depende de:** gate F2 (pode ser feito em paralelo à Fase 3, já que só afeta
licenciamento, não a UI).
- Console admin: criar `CatalogEntry` com o `slug` travado em T0.2, `type=pro`, preço/imposto
  definidos pelo dono, descrição/ícone/screenshots (usar as telas da Fase 3 quando prontas).
- **Aceite:** catálogo público (`GET /api/v1/plugins/catalog` via plugin-manager) expõe a entrada;
  ativação `pro` sem licença no core mostra "Adquirir" e completa o fluxo de checkout existente.

---

## FASE 5 — Endurecimento e documentação

### T5.1 — Rate limiting / anti-ban de verdade
**Repo:** engine-go (principalmente), business (limite por-tenant se fizer sentido).
- Validar com dados reais (ou heurística conservadora) o teto de ações administrativas de grupo
  por minuto/hora por sessão antes de liberar em produção — este é o maior risco operacional do
  plugin (contas banidas = reputação do produto).
- **Aceite:** teste/estimativa documentada + limite configurável, default conservador.

### T5.2 — Documentação de contrato
**Repos:** engine-go, watinkdev, hub.
- Atualizar `docs/dev/plugins.md` (se este plugin revelar alguma lacuna no guia genérico),
  `hub/docs/integration-clients.md` se o catálogo ganhar algum campo novo, e linkar
  `engine-go/docs/groups-api.md` de volta neste documento.
- **Aceite:** docs revisadas no mesmo PR de cada fase que as afeta (não acumular para o final).

---

## DAG resumido

```
T0.1 → T0.2
   gate F0
T1.1 → T1.2
     → T1.3
   gate F1
T2.1 ─┬→ T2.3
T2.2 ─┘
   gate F2
T3.1  (frontend)      T4.1 (hub, paralelo)
   T5.1 → T5.2 (fecha antes de produção)
```

## O que NÃO fazer

- Não inventar um ID numérico próprio para grupo/comunidade — usar o JID sempre (invariant 5).
- Não expor a nova API HTTP do engine-go fora da rede interna docker.
- Não liberar ações de escrita em massa sem rate limiting (T5.1) — nem em staging com número real.
- Não misturar o plugin novo com os models `ConnectionGroup`/`ProxyGroup`/`TagGroup` já existentes
  no core — são conceitos homônimos e não relacionados.
- Não tratar `PluginInstallations.active` como prova de licença (mesma regra do resto do sistema).

## Próximos passos imediatos

1. Validar com o dono o subconjunto de rotas do T0.1 (incluir `join`/`preview`/`join-requests` no
   MVP ou deixar para uma iteração 2?).
2. Abrir o PR de T0.1 (engine-go) e T0.2 (watinkdev) em paralelo — são só design, sem código de
   produção ainda.
