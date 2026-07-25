# Plano de Execução — Marketplace de Terceiros (end-to-end)

> **Para o agente executor.** Este é o plano operacional do ADR 0025 (core) + ADR 0004 (Hub).
> Os ADRs são a fonte de verdade da **decisão**; este documento é a fonte de verdade da
> **execução**: tarefas por repositório, arquivos-âncora, critérios de aceite e ordem.
> Leia antes: [`docs/agents/plugins.md`](plugins.md) (estado atual do sistema),
> ADR 0024 (core), Hub ADR 0002/0003/0004.

**Status:** **Fase 0 concluída (2026-07-04)** — T0.1–T0.4 implementadas e verificadas via
workflow automatizado (build+testes rodados do zero nos 3 repos, fail-closed revisado
manualmente nos 4 arquivos-chave). Mudanças ainda **não commitadas** — pendente review humano
antes do commit por repo. Fase 1 (Publisher + curadoria embarcada) não iniciada — aguarda o
gate abaixo. **Gate de fases:** nenhuma tarefa de uma fase começa antes de TODOS os aceites da
fase anterior estarem verdes (exceção: documentação pode adiantar).

**Ressalvas abertas da Fase 0** (não bloqueantes, para o review humano antes do commit):
- Nenhum teste de integração real contra um plugin-manager/hub rodando foi exercido — só
  unit/mock, conforme escopo.
- `PM_ENV=production` explícito no compose de produção (fora deste repo) ainda não confirmado/documentado.
- 2 warnings pré-existentes de oxlint no `hub/console` (Fast Refresh em button.tsx/auth.tsx) — não relacionados a esta Fase.

## Repositórios envolvidos

| Repo | Caminho local | Papel neste plano |
|---|---|---|
| `watinkdev` (core, público) | `D:\01_PROJETOS\watink-ecosistema\watinkdev` | API de extensão, consentimento, Marketplace UI, guia de contribuição |
| `hub` (privado) | `D:\01_PROJETOS\watink-ecosistema\hub` | Publisher, review, artefato assinado, revocationList |
| `watink-plugin-manager` (privado, GHCR) | `D:\01_PROJETOS\watink-ecosistema\watink-plugin-manager` | Guard de produção, kill-switch, orquestrador local (Fase 2) |

**Validação por repo** (rodar antes de todo commit):
- core: `cd business && go fmt ./... && go build ./... && go test ./...` (+ `swag init` se mexer em rotas) · frontend: `npm run lint && npm run typecheck`
- hub: `make check`
- plugin-manager: `go fmt ./... && go build ./... && go test ./...`

**Convenções:** Conventional Commits, branch `feat/<tema>`|`fix/<tema>` → `develop` → `main`
(core) — ver `docs/dev/git_workflow_policy.md`. No hub/pm, seguir o CLAUDE.md de cada repo.
Toda tarefa que altera contrato HTTP atualiza a doc de contrato no mesmo PR
(`hub/docs/integration-clients.md` e/ou `docs/agents/plugins.md`).

## Invariants que valem durante TODO o plano (violar = parar e alertar)

1. `business` nunca fala com o Hub direto — sempre via `plugin-manager`.
2. Licença = token Ed25519 verificado; `PluginInstallations.active` é só alocação.
3. Fail-closed em crescimento; fail-closed em dúvida de licença no pm.
4. Nenhum código de terceiro in-process no `business`/`frontend` (ADR 0003 intacto).
5. Plugin de terceiro nunca acessa Postgres/AMQP direto — só a API de extensão escopada.
6. Campos novos de catálogo/heartbeat são **aditivos** (backward-compatible) até segunda ordem.
7. Segredos (X-Hub-Secret, tokens, credencial de publisher) nunca em log/resposta.

---

## FASE 0 — Pré-requisitos de segurança (bloqueante para tudo)

### T0.1 — `revocationList` real (Hub + plugin-manager)
**Repos:** hub, watink-plugin-manager. **Depende de:** nada.

- **Hub:** adicionar `revokeImmediately bool` a `plugin_licenses`; expor no Console/admin API
  (revogar com ou sem efeito imediato). No heartbeat
  (`api/internal/server/heartbeat/handler.go` — hoje devolve `[]string{}` fixo), popular
  `revocationList` com os `pluginSlug` das licenças da instância com
  `status=revoked && revokeImmediately`, mantendo cada entrada até o `exp` do último token
  emitido para aquela licença (persistir `lastTokenExp` na licença ao emitir).
  Plugin `suspended` (catálogo) implica revogação imediata de todas as suas licenças.
- **plugin-manager:** em `hubclient.go` (a semântica hoje é "suposição documentada",
  ~linhas 210-216) implementar a aplicação real: slug na lista → remover token do cache →
  status `blocked` (não aplicar `degradeMode` — revogação ≠ expiração comercial) →
  refletir imediatamente em `GET /internal/licenses`.
- **Aceite:** teste no hub provando que revogar com `revokeImmediately` põe o slug na
  resposta do heartbeat e que sem a flag não põe (lazy preservado); teste no pm provando que
  um slug revogado vira `blocked` no `GET /internal/licenses` no ciclo seguinte, sem esperar
  `exp`. `hub/docs/integration-clients.md` § A.1 atualizado com a semântica.

### T0.2 — Guard de produção no stub de dev do plugin-manager
**Repo:** watink-plugin-manager. **Depende de:** nada.

- Em `licenses.go` (stub em ~56-80): o modo stub (sem `HUB_URL`) só pode rodar se
  explicitamente autorizado. Introduzir `PM_ENV` (`production` default na imagem GHCR):
  `PM_ENV=production` + `HUB_URL` vazio → **recusar subir** com erro fatal claro no boot.
  Stub só com `PM_ENV=dev` explícito. Atualizar README/CLAUDE.md do pm e o compose de dev do
  core (setar `PM_ENV=dev` no `docker-compose.dev.yml` do watinkdev).
- **Aceite:** teste de boot cobrindo as 3 combinações (prod+sem-hub = fatal; dev+sem-hub =
  stub; prod+hub = normal). Imagem GHCR com default seguro.

### T0.3 — `checkoutUrl` ponta-a-ponta (business + frontend)
**Repo:** watinkdev. **Depende de:** nada (o Hub já tem `POST /api/v1/plugins/checkout`
funcional e idempotente em `api/internal/server/checkout/handler.go`).

- `business/internal/controllers/plugin_manager.go` (`Activate`, hoje retorna
  `checkoutUrl: ""` fixo): quando plugin `pro` sem licença, devolver instrução de checkout
  real. Rota nova `POST /plugins/:slug/checkout` no business → pm → Hub `POST /checkout`
  (o business **nunca** chama o Hub direto — o pm ganha rota proxy `POST /internal/checkout`
  se ainda não tiver). Sucesso → próximo heartbeat traz o token → business responde ao poll
  do frontend com o status novo.
- Frontend Marketplace: plugin `pro` sem licença mostra ação "Adquirir" que chama o checkout
  e faz poll do status (`GET /plugins/installed`) até `active` (timeout ~2× heartbeat, com
  mensagem de "aguardando licença").
- **Aceite:** fluxo manual completo em dev: ativar `pro` sem licença → adquirir → em ≤ 1
  ciclo de heartbeat o plugin está `active` e a rota responde. Swagger regenerado
  (`swag init`) no mesmo PR. Permissão: rota atrás de `auth.GetScoped(c, "Plugins")`.

### T0.4 — Teste de paridade `licensetoken` cross-repo
**Repos:** hub + watink-plugin-manager. **Depende de:** nada.

- Criar **golden files**: no hub, um teste gera tokens canônicos (válido, expirado,
  adulterado, kid desconhecido, claims extremos — `TenantCap` grande p/ pegar int64 vs int)
  e os grava em `testdata/parity/*.jwt` + chaves públicas de teste. Copiar o diretório
  (script `make parity-export` no hub / `make parity-import` no pm, ou cópia commitada) para
  o pm, onde um teste verifica cada golden com o `licensetoken.Verify` local e compara o
  resultado esperado (aceito/rejeitado + claims decodificados).
- **Aceite:** suite de paridade verde nos dois repos; caso de `TenantCap` > 2^31 coberto;
  procedimento de atualização dos goldens documentado nos dois CLAUDE.md (invariant de
  release do ADR 0002).

**Gate Fase 0 → 1:** T0.1–T0.4 aceitos + docs de contrato atualizadas.

---

## FASE 1 — Publisher + curadoria embarcada (marketplace fechado com terceiros)

### T1.1 — Entidade Publisher no Hub
**Repo:** hub. **Depende de:** gate F0.

- Models `publishers` (ver ADR 0004: status, `revenueSplitPct`, credencial cifrada via
  `cryptobox`) + `plugins.publisherId` nullable + migração. CRUD no Console admin (aba
  Publishers). Namespace de slug: terceiro é `publisher/plugin`; slug sem `/` reservado ao
  dono — validar no create do plugin. `audit_log` em toda mutação.
- **Aceite:** dono cria publisher no Console, cria plugin vinculado com slug namespaced;
  catálogo público expõe `publisher` (campo aditivo); plugin first-party segue sem publisher.

### T1.2 — Máquina de estados de review no catálogo
**Repo:** hub. **Depende de:** T1.1.

- `plugins.status`: `draft → submitted → in_review → approved → published` + `rejected`,
  `suspended` (ADR 0004). Só `published` sai no catálogo/heartbeat. Transições via Console
  com `audit_log`. `suspended` → dispara revogação imediata das licenças (usa T0.1).
- **Aceite:** teste de que `submitted`/`in_review`/`rejected` nunca aparecem no catálogo
  público; suspender plugin publicado o remove do catálogo e revoga licenças imediatamente.

### T1.3 — Guia de contribuição + template de plugin no core
**Repo:** watinkdev. **Depende de:** T1.1 (processo referencia o publisher).

- Criar `docs/dev/plugin-contrib.md`: processo do terceiro (cadastro de publisher → proposta →
  PR no core seguindo a estrutura de `docs/dev/plugins.md` → checklist de review → embarque →
  publicação no Hub). **Checklist de review de segurança** (multitenancy `tenantId` em toda
  query, `auth.GetScoped`, sem rede de saída não declarada, sem secret hardcoded, sem
  dependência nova sem aprovação, arquivos < 250L, TS-only no frontend, anti-MUI ADR 0008).
- Template esqueleto: `business/internal/plugins/_template/` (handler/service/repository/
  domain comentados, sem rota registrada — excluído do build por build tag ou nome `_`) +
  seção frontend correspondente no guia.
- **Aceite:** `docs/dev/plugin-contrib.md` publicado e linkado de `docs/dev/plugins.md`;
  template compila (`go build ./...` verde com o template presente).

**Gate Fase 1 → 2:** primeiro plugin de terceiro (ou um piloto interno simulando terceiro)
atravessa o processo completo: publisher → review → embarcado → publicado → ativado por
tenant → licenciado → revogável via T0.1.

---

## FASE 2 — Runtime out-of-process (a exceção assinada do ADR 0025 §2)

> Ordem interna: T2.1 (contrato) → T2.2/T2.3 em paralelo → T2.4 → T2.5. O contrato da API de
> extensão nasce versionado e muda por ADR.

### T2.1 — API de extensão + token escopado no business
**Repo:** watinkdev. **Depende de:** gate F1.

- Desenhar e implementar `/api/ext/v1/*` no business: superfície mínima inicial
  (ler/enviar mensagens de ticket, contatos, webhooks de eventos — definir no PR de design),
  autenticada por **token de extensão** (JWT próprio do business, claims
  `{instanceId, tenantId, pluginSlug, scopes[], exp}` — emitido pelo business na ativação,
  entregue ao container via pm). Middleware de **enforcement de scopes**: scope ausente =
  403 sempre. Toda query da API de extensão escopada por `tenantId` do token.
- **Aceite:** testes de enforcement (com/sem scope, tenant cruzado = 404/403, token expirado);
  contrato documentado em `docs/dev/extension-api.md`; Swagger regenerado.

### T2.2 — Scopes + consentimento na ativação
**Repos:** hub (declarativo) + watinkdev (consentimento/enforcement). **Depende de:** T2.1.

- Hub: schema de manifesto validado no publish (`scopes[]`), diff entre versões →
  `requiresReconsent` no catálogo (ADR 0004).
- Core: tela de ativação mostra os scopes em linguagem clara; consentimento fica registrado
  em `PluginInstallations` (`consentedScopes`, `consentedAt/By`); upgrade com
  `requiresReconsent` bloqueia o plugin (readonly) até novo consentimento.
- **Aceite:** ativar plugin com scopes exibe e registra consentimento; upgrade que amplia
  scopes exige re-consentimento antes de voltar a `active`.

### T2.3 — Artefato assinado no Hub
**Repo:** hub. **Depende de:** gate F1 (paralelo a T2.2).

- `plugin_versions` += `artifactRef`, `artifactDigest`, `artifactSignature` (assinatura do
  digest com `signing_keys`, claim `art` — ADR 0004 §3). Publish de versão out-of-process
  exige os três; embarcados seguem sem. Catálogo expõe (aditivo).
- **Aceite:** teste de emissão/verificação da assinatura de artefato; golden de paridade
  adicionado à suite T0.4 (o verificador vive no pm — T2.4).

### T2.4 — plugin-manager como orquestrador local
**Repo:** watink-plugin-manager. **Depende de:** T2.3 (assinatura) + T0.1 (kill-switch).

- Verificar `artifactSignature`/digest com as públicas do heartbeat **antes** de qualquer
  pull; pull por digest pinado (nunca tag mutável); lifecycle start/stop/upgrade do container
  do plugin (Docker API local); injetar o token de extensão (T2.1) no container; rede do
  container restrita ao business (sem Postgres/AMQP); `revocationList` → stop imediato.
  Fail-closed: assinatura inválida/digest divergente = não sobe, loga, reporta no heartbeat.
- **Aceite:** teste e2e local com um plugin de exemplo: publica versão assinada no Hub dev →
  pm verifica, puxa e sobe → plugin responde via API de extensão → revogar → container para
  em ≤ 1 ciclo. Digest adulterado nunca sobe.

### T2.5 — UI isolada de terceiros
**Repo:** watinkdev. **Depende de:** T2.4.

- Iframe sandboxado (origem do container do plugin, `sandbox` restritivo, `postMessage` com
  contrato tipado para tema/navegação/contexto do ticket) OU widgets declarativos por
  manifesto — decidir no PR de design, default iframe. Nunca `<script>` de terceiro na SPA.
- **Aceite:** plugin de exemplo renderiza UI no Marketplace/página própria via iframe;
  CSP da SPA não permite script cross-origin; revisão de segurança da ponte postMessage.

**Gate Fase 2 → produção:** revisão de segurança dedicada (threat model da API de extensão,
pentest do sandbox de rede do container, revisão da ponte de UI) + plugin piloto de terceiro
real operando em staging por período definido pelo dono.

---

## FASE 3 — WASM para nós do FlowBuilder (condicionada a demanda — NÃO iniciar sem decisão explícita do dono)

Nós customizados como módulos `.wasm` (wazero, capabilities explícitas), distribuídos como
artefato assinado (mesma disciplina de T2.3). Desenho detalhado exigirá ADR próprio quando
ativada — este plano só reserva o lugar.

---

## DAG resumido

```
T0.1  T0.2  T0.3  T0.4      ← paralelos, sem dependências entre si
  └────┴──┬──┴────┘
        gate F0
     T1.1 → T1.2
        └→ T1.3
        gate F1 (piloto ponta-a-ponta)
     T2.1 → T2.2
     T2.3 ─┬→ T2.4 → T2.5     (T2.3 ∥ T2.2; T2.4 exige T0.1)
        gate F2 (security review + piloto staging)
     [F3 sob demanda]
```

## O que NÃO fazer (além dos invariants)

- Não iniciar Fase 1 com qualquer item da Fase 0 pendente — os quatro são pré-requisitos de
  segurança, não melhorias.
- Não aceitar slug de terceiro sem namespace `publisher/` nem slug raiz para não-dono.
- Não usar tag mutável de imagem em lugar de digest pinado (T2.4).
- Não emitir token de extensão com scope que o tenant não consentiu.
- Não tratar revogação como expiração (`blocked` direto, sem `degradeMode`).
- Não expandir a superfície da API de extensão sem versionamento/ADR.
- Não implementar payout/gateway de pagamento — fora de escopo declarado (ADR 0004).
- Não colocar lógica de orquestração de container no business — é papel do plugin-manager.

## Encerramento de cada tarefa (checklist do executor)

1. Validação do repo verde (comandos acima) + testes novos cobrindo o aceite.
2. Docs de contrato atualizadas no mesmo PR (integration-clients.md / plugins.md / Swagger).
3. PR com resumo técnico, risco/impacto, evidência de teste, rollback (política do core).
4. Ao fechar uma fase: atualizar a tabela de status do CLAUDE.md do repo afetado e marcar o
   gate neste documento (editar o Status no topo).
