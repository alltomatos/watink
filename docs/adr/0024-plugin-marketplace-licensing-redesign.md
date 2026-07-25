# Redesenho do sistema de plugins: de flag no banco para entitlement licenciado via Hub

O sistema de plugins do core era, na prática, um arcabouço vazio. A documentação prometia
"validação de licença server-side é autoridade", mas o código não validava nada: `GetStatus()`
retornava `StatusActive` hardcoded (`business/internal/plugins/manager.go:28`), os endpoints
`POST /plugins/:slug/activate|deactivate` que o frontend chama **não existiam** (503),
`/plugins/installed` sempre devolvia `[]`, `PluginInstallations` não tinha migration (só existia
em `testutil`), e o `plugin-manager` local escrevia um `.license_status.json` que o `business`
nunca lia. A flag local — que também não era lida — seria a única "autoridade" se fosse. Para
software que roda em VPS de terceiros, isso não sustenta um modelo comercial.

Decidimos redesenhar o sistema em torno de um **Hub central** (novo projeto `watink-ecosistema/hub`,
ADR 0001 de lá) como autoridade única de catálogo e licença, com o core no papel de **cliente**.
As decisões estruturais:

**Fronteira core vs plugin = ativação.** É plugin o que precisa ser **ativado via Marketplace**
(`free` ou `pro`); é core o que está sempre-ligado. Isso dá a regra geral que faltava desde o
ADR 0023 (por que "Clientes" virou core) e determina que o `saas-plugin` — ponte de control
plane, sempre-ligada — **sai do sistema de plugins** (é redundante com o `watink-saas`, e por
isso removido). Plugins reais que restam: `helpdesk` e `webchat`.

**Trilho duplo.** O comercial do tenant (mensalidade, suspensão) continua no `watink-saas` via
push+snapshot. A licença de **plugin** é domínio do Hub, entregue por Hub → `plugin-manager`
local → `business`. O `watink-saas` não intermedia licença de plugin. Consequência boa: o
`plugin-manager` local, hoje um esqueleto morto, vira o elo real que faltava.

**Licença de instância + alocação por tenant.** O Hub licencia a **instalação** (`instanceId`)
com um **teto** de tenants; o core decide **quais** tenants recebem o plugin (`PluginInstallations`),
respeitando `alocados < tenantCap`. O Hub nunca conhece os `tenantId` de uma instalação — só
contadores agregados (Hub ADR 0003).

**Licença = token assinado, não flag.** O Hub emite um token Ed25519 de curta duração
(`exp = iat + TTL`, default 48h) que o `plugin-manager` valida **offline** pela chave pública
(Hub ADR 0002); o `business` consulta o `plugin-manager` (pull + cache ~60s), **nunca o Hub
direto**. O TTL é o grace: Hub offline mantém o plugin até `exp`; depois, degradação. Fail-closed
nas ações de crescimento (ativar novo plugin/tenant) quando o status é indeterminado após o grace.

**Degradação configurável por plugin.** Quando a licença `pro` expira, o plugin entra em
`readonly` (vê dados, não escreve) ou `blocked` (402) conforme o `degradeMode` declarado no
**manifesto do plugin** — reativando os estados `StatusReadOnly`/`StatusBlocked` do SDK, hoje
mortos. Preserva dados (coerente com "suspensão nunca apaga" do watink-saas).

Este ADR **supera o ADR 0003** (`plugin-builtin-flag`) no que toca à autoridade: a ativação
continua sem download de código (plugins seguem embarcados na imagem — o ponto anti-supply-chain
do 0003 permanece válido), mas a **flag no banco deixa de ser autoridade** — ela é apenas o
registro de **alocação**; a autoridade de licença é o token assinado do Hub.

**Consequences:**
- `PluginInstallations` ganha migration real (`unique(tenantId, pluginId)`, `activatedAt/By`),
  deixando de existir só em `testutil`. **Não** se cria tabela de licença no core — a licença
  vive no `plugin-manager`.
- Implementar as rotas ausentes `POST /plugins/:slug/activate|deactivate`, tornar
  `/plugins/installed` e `/catalog` reais, e trocar `GetStatus()` hardcoded por cruzamento
  licença × alocação.
- `pkg/licensetoken` (verificador Ed25519) é portado do Hub para o `plugin-manager`; manter
  paridade com o Hub é um invariant de release.
- O `saas-plugin` é removido; o `marketplace-hub` (Node) embrionário é descontinuado (absorvido
  pelo Hub).
- Contexto completo e plano de tarefas em [`docs/agents/plugins.md`](../agents/plugins.md);
  contrato servidor em `watink-ecosistema/hub/docs/integration-clients.md` § A.

## Atualização (2026-07-03) — Distribuição proprietária do plugin-manager

Decidido: o `plugin-manager` é **proprietário** e distribuído **apenas compilado**.
Como o core (`alltomatos/watink-dev`) é **público**, manter o fonte do enforcement de
licença dentro dele exporia (e permitiria remover) as checagens. Portanto:

- **Fonte** do plugin-manager sai do core e passa a viver **somente** no repo privado
  `alltomatos/watink-plugin-manager` (par do `alltomatos/watink-hub`).
- **Distribuição** via imagem `ghcr.io/alltomatos/watink-plugin-manager:<tag>`,
  publicada pela CI do repo privado. O compose do core consome com `image:`
  (`PLUGIN_MANAGER_IMAGE` como override de dev) — **nunca** `build:` a partir de
  source no core.
- O pacote `licensetoken` (verify Ed25519), que o P-2 havia colocado em
  `business/pkg/licensetoken` (código morto no core público), foi **movido para dentro
  do plugin-manager** — alinhando com a intenção deste ADR ("portado do Hub para o
  plugin-manager") e com a fronteira proprietária.
- Fronteira de runtime inalterada: o `business` depende só do contrato HTTP
  `GET /internal/licenses`; nunca importa código do plugin-manager.

Caveat: o fonte do plugin-manager permanece no **histórico público** do `watinkdev`
(a remoção é só no HEAD). Limpar o histórico exigiria reescrita (`git filter-repo`) —
decisão separada, ainda não executada.

## Atualização (2026-07-04) — Implementação concluída ponta-a-ponta

Auditoria de código confirmou que todos os itens da lista de "Consequences" acima e da
tabela "Estado atual vs alvo" (`docs/agents/plugins.md`) **já foram implementados**:

- `GetStatus()` faz cruzamento real licença × alocação (`business/internal/plugins/registry.go`).
- Rotas `POST /plugins/:slug/activate|deactivate` implementadas (`business/internal/controllers/plugin_manager.go`).
- `/plugins/installed` e `/plugins/catalog` refletem dados reais (join com `PluginInstallations` / proxy do `plugin-manager`).
- `PluginInstallations` tem migration real com `UNIQUE(tenantId, pluginId)` (`business/internal/database/database.go`).
- `plugin-manager` valida assinatura Ed25519 no heartbeat via `licensetoken.Verify`, fail-closed em qualquer erro.
- `saas-plugin` removido do core (só resta o control plane `watink-saas`, entidade distinta).

Pendências reais remanescentes (não é mais "arcabouço vazio", é lapidação):

- **`revocationList`** do Hub sempre vazia — revogação hoje só propaga no `exp` do token (TTL/lazy), não imediatamente.
- **`checkoutUrl`** no `business` (`plugin_manager.go`) sempre retorna vazio — fluxo de ativação `pro` sem licença não está fiado a uma URL de checkout utilizável pelo usuário final.
- **Paridade `licensetoken` entre Hub e plugin-manager** é mantida por convenção (duas implementações independentes do parsing de claims), sem teste de integração cruzado que trave a paridade automaticamente.
- Modo stub de dev do `plugin-manager` (sem `HUB_URL`) libera tudo sem verificar assinatura — correto para dev, mas sem guard explícito contra subir assim em produção.

Ver tabela atualizada em [`docs/agents/plugins.md`](../agents/plugins.md).
