# Módulo: Plugins (Marketplace + Licenciamento)

> Documento de contexto para agentes. Descreve o **redesenho** do sistema de plugins do core (ADR 0024) — de "flag no banco" para **entitlement licenciado via Hub**. Contraparte servidora: repositório `hub` (Watink Hub), `docs/integration-clients.md` § Cliente A.

## Responsabilidade

Permitir que features **opt-in** (plugins) sejam **ativadas via Marketplace** por tenant, com gating real de licença para as pagas. O core é o **cliente** do licenciamento; a autoridade de catálogo/licença é o **Hub**, alcançado sempre pelo `plugin-manager` local — nunca direto.

**Fronteira core vs plugin (a regra que evita a fronteira derreter):** é **plugin** o que precisa ser **ativado via Marketplace** (seja `free` ou `pro`). É **core** o que está sempre-ligado e não se ativa (atendimento, CRM/Clientes, Pipeline, FlowBuilder, RAG). Foi por isso que "Clientes" virou core (ADR 0023) e o antigo `saas-plugin` foi removido (é infraestrutura de control plane, não add-on).

## Arquitetura — trilho duplo (ADR 0024 + Hub ADR 0001)

```
Hub (nuvem, autoridade) ──licença de plugin (token Ed25519)──▶ plugin-manager local :8081
                                                                      │  (verifica assinatura offline,
                                                                      │   cacheia com grace = exp do token)
                                                                      ▼
                                             business :8082  ──pull + cache ~60s──▶ status por plugin
                                                                      │
                                                       PluginInstallations (alocação por tenant)
```

- **Comercial do tenant** (mensalidade/suspensão) é do `watink-saas` — **não** se mistura com licença de plugin.
- **business nunca fala com o Hub direto**: sempre consulta o `plugin-manager` local (Decisão 2/4 do ADR 0024).
- Licença é **por instância + teto de tenants**; a **alocação nominal** (qual tenant usa) é do core (Hub ADR 0003).

## Distribuição e fronteira de código (proprietário)

O `plugin-manager` é **proprietário** e distribuído **apenas compilado** — o código-fonte vive **somente** no repo privado `alltomatos/watink-plugin-manager` e **não** acompanha o core (`watinkdev`, que é público). Motivo: é a **trava real de licenciamento**; com fonte aberto o cliente poderia remover as checagens.

- **Fonte:** `alltomatos/watink-plugin-manager` (privado). O pacote `licensetoken` (verify Ed25519) vive **dentro** desse módulo (`github.com/watink/plugin-manager/licensetoken`) — **não** mais em `business/pkg` (foi movido; era código morto no core, que é público).
- **Distribuição:** imagem `ghcr.io/alltomatos/watink-plugin-manager:<tag>`, publicada pela CI do repo privado. O compose do core consome via `image: ${PLUGIN_MANAGER_IMAGE:-ghcr.io/alltomatos/watink-plugin-manager:latest}` — **nunca** `build:` a partir de source no core.
- **Fronteira runtime:** o core depende só do **contrato HTTP** `GET /internal/licenses` — não do source. É o que mantém a extração limpa (o `business` nunca importa código do plugin-manager).
- **Dev:** `docker compose up` puxa a imagem. Para desenvolver o próprio plugin-manager, clone o repo privado e aponte `PLUGIN_MANAGER_IMAGE` para uma imagem local (ex.: `docker build -t pm:dev .` no repo privado → `PLUGIN_MANAGER_IMAGE=pm:dev`).

## Modelo de dados

**No core (migration real — hoje `PluginInstallations` só existe em `testutil`):**
```
PluginInstallations
  id          uuid PK
  tenantId    uuid       -- alocação: qual tenant
  pluginId    text       -- = pluginSlug do catálogo do Hub
  active      bool
  activatedAt timestamptz
  activatedBy uuid       -- User que ativou (auditoria)
  UNIQUE(tenantId, pluginId)
  INDEX(tenantId)
```
**NÃO** criar tabela de licença no core: a licença vive no `plugin-manager` (cache do token do Hub). O core só guarda a **alocação**. `activatedAt/activatedBy` são para auditoria da ativação, não licença.

**No plugin-manager (cache local):** tokens de licença assinados por plugin (`{status, tenantCap, exp}` derivado), chaves públicas do Hub, `instanceId` (fingerprint `INST-{ts}-{hash}`).

## Fluxos

**Ativar plugin `free`:** Marketplace → `POST /plugins/:slug/activate` → `business` cria `PluginInstallations(active=true)`. **Não toca o Hub.**

**Ativar plugin `pro`:** Marketplace → `POST /plugins/:slug/activate` → `business` pergunta ao `plugin-manager`: a instância tem licença válida do plugin e `alocados < tenantCap`? → **sim**: aloca (`active=true`); **sem licença**: retorna `checkoutUrl` (adquirir no Hub); **teto cheio**: 402 + sugestão de upgrade.

**Instância gerida por um Watink SaaS não tenta checkout** ([ADR 0026](../adr/0026-marketplace-respeita-gestao-watink-saas.md)): antes de chamar `pc.pmProxy.Checkout(slug)`, `PluginController.Activate` checa `isSaaSManaged()` (reusa `os.Getenv("SAAS_INTERNAL_TOKEN") != ""`, o mesmo sinal que `middleware.InternalSaaSOnly()` já usa). Se gerida, devolve `402` com mensagem própria ("contrate com o administrador da sua conta") em vez de acionar o Hub — o Hub rejeitaria (403) mesmo assim, porque `checkout.Handler` recusa compra avulsa para instância vinculada a um `Customer` (Hub ADR 0005). Não muda o gate de autorização em si (já era fail-closed sem licença); só evita a tentativa. Plugin já licenciado (via bundle do empreendedor ou compra avulsa antiga) ativa/desativa normalmente, governado ou não.

**Gating em runtime:** toda rota de plugin passa por `PluginRegistry.GetStatus(slug, tenantId)` que cruza **licença** (plugin-manager) × **alocação** (`PluginInstallations`):
- `active` → segue; `readonly` → só GET (bloqueia escrita); `blocked`/`unlicensed` → 402.

**Expiração (após grace = `exp` do token):** aplica o `degradeMode` **do manifesto do plugin** (`readonly` ou `blocked`) — configurável por plugin. Usa os estados `StatusReadOnly`/`StatusBlocked` do SDK que hoje existem mas estão mortos.

## Contratos

- **business → plugin-manager** (interno, pull + cache ~60s): `GET /internal/licenses` → por plugin: `{status: active|readonly|blocked|unlicensed, tenantCap, exp}`. Verificação Ed25519 via `licensetoken` (dentro do repo privado do plugin-manager) portado do Hub.
- **plugin-manager → Hub**: `POST /api/v1/plugins/heartbeat` e `GET /catalog` — ver `hub/docs/integration-clients.md` § A.1/A.2. Fingerprint, tokens, chaves públicas, `revocationList`.
- **Frontend → business**: `GET /plugins/catalog` (proxy do catálogo via pm — mata o 503 fixo), `GET /plugins/installed` (real: join `PluginInstallations` × status), `POST /plugins/:slug/activate|deactivate` (hoje **ausentes** — o frontend já os chama).

## Estado atual vs alvo (histórico) — **CONCLUÍDO em 2026-07-04**

> Auditoria de código confirmou que todos os itens abaixo já foram implementados. Tabela
> mantida como registro histórico do que foi corrigido; ver "Pendências reais remanescentes"
> logo abaixo para o que ainda falta.

| Sintoma (histórico, já corrigido) | Arquivo | Implementação atual |
|---|---|---|
| `GetStatus()` retorna `StatusActive` hardcoded | `business/internal/plugins/manager.go` | `PluginRegistry.GetStatus` cruza licença (pm) × alocação (`PluginInstallations`) — `business/internal/plugins/registry.go` |
| `activate`/`deactivate` inexistem (frontend chama, dá 503) | `business/internal/routes/routes.go` | Rotas implementadas, com alocação e teto — `business/internal/controllers/plugin_manager.go` |
| `/plugins/installed` sempre `[]` | `business/internal/controllers/plugin_manager.go` | Reflete `PluginInstallations` reais (join com status) |
| `/plugins/catalog` sempre 503 | `plugin_manager.go` | Proxy real do catálogo do Hub via pm (fail-safe `200 {offline:true}` se pm indisponível) |
| `.license_status.json` do pm nunca é lido pelo business | `plugin-manager/main.go` | `business/internal/pluginlicense/client.go` consome `GET /internal/licenses`, cache TTL+grace |
| `PluginInstallations` sem migration (só `testutil`) | `business/internal/testutil/db.go` | Migration real + `UNIQUE(tenantId, pluginId)` — `business/internal/database/database.go` |
| Heartbeat do pm não valida assinatura | `plugin-manager/main.go` | `licensetoken.Verify` (Ed25519), fail-closed em qualquer erro |
| `saas-plugin` redundante com watink-saas | `business/internal/plugins/saas.go` | Removido — confirmado ausente do diretório `internal/plugins/` |

## Pendências reais remanescentes

> **Estas quatro pendências foram formalizadas como a FASE 0 (bloqueante) do plano de
> expansão do marketplace para terceiros** — ver ADR 0025 e o plano executável em
> [`docs/agents/marketplace-terceiros.md`](marketplace-terceiros.md) (tarefas T0.1–T0.4).

- **`revocationList`** do Hub sempre vazia (`heartbeat/handler.go`) — revogação hoje só propaga no `exp` do token (TTL/lazy), não imediatamente. Decidir se essa lazy revocation é suficiente ou se vale implementar a lista.
- **`checkoutUrl`** no `business` (`plugin_manager.go`) sempre vazio — o Hub já expõe `POST /checkout` funcional, mas o fluxo "ativar `pro` sem licença → checkout" não está fiado a uma URL utilizável pelo usuário final no Marketplace.
- **Paridade `licensetoken` entre Hub e plugin-manager** é mantida só por convenção — são duas implementações independentes do parsing de claims (mesmos nomes de campo, tipos ligeiramente diferentes como `TenantCap int64` vs `int`), sem teste de integração cruzado que trave a paridade automaticamente.
- **Modo stub de dev** do `plugin-manager` (sem `HUB_URL` configurado) libera tudo (`active`) sem chamar `Verify` — correto para dev, mas sem guard explícito contra subir assim em produção por omissão de configuração.

## Edge cases

- **Hub offline:** token vale até `exp` (grace natural). Depois, `degradeMode`. Ativar novo plugin/tenant (crescimento) é **fail-closed** se o status estiver indeterminado.
- **plugin-manager offline/reiniciando:** o business usa o cache de ~60s; sem resposta além disso, ações de crescimento fail-closed; operação corrente segue até o cache/token expirar.
- **Teto atingido:** alocação nova bloqueada (402); alocações existentes seguem.
- **Downgrade/revogação:** Hub para de renovar (lazy) → expira em ≤ TTL; ou `revocationList` (imediata).
- **Plugin `free` desativado:** `deactivate` remove a alocação; sem efeito no Hub.
- **Token adulterado/expirado:** `pkg/licensetoken.Verify` rejeita → `unlicensed` → 402. Nunca reportar válido sem verificar assinatura + `exp`.
- **Chave pública desatualizada (pós-rotação):** o heartbeat entrega o conjunto de públicas válidas; a embarcada é só bootstrap.

## Riscos

- **Chave privada do Hub** é o segredo mais crítico do ecossistema (forja qualquer licença). Não vive no core — só a pública. Ver Hub ADR 0002.
- **Paridade `pkg/licensetoken`** Hub ↔ verificador do plugin-manager: um contrato divergente invalida licenças no mundo. Invariant de release.
- **Instância adulterada** (root na VPS) pode tentar ignorar o teto/gating: a defesa é a licença assinada (carrega `cap`) + o binário do core; adulterar exige recompilar, não só editar o banco. Telemetria (contadores no heartbeat) detecta divergência.
- **Reintroduzir acoplamento**: não voltar a ler flag local como autoridade nem a chamar o Hub direto do business.

## Critério de sucesso

1. Ativar um plugin `free` no Marketplace o faz aparecer na sidebar e responder suas rotas; desativar reverte — tudo por tenant.
2. Ativar um plugin `pro` sem licença retorna `checkoutUrl`; com licença e teto livre, aloca e funciona; com teto cheio, 402.
3. Revogar a licença no Hub degrada o plugin (`readonly`/`blocked` conforme manifesto) em ≤ `LICENSE_TTL`, sem apagar dados do tenant.
4. Hub e plugin-manager offline não derrubam plugins já ativos dentro do grace; ações de crescimento ficam fail-closed.
5. Token adulterado/expirado nunca libera a rota. `pkg/licensetoken` do Hub e o verificador do core aceitam/rejeitam identicamente (teste de paridade).
6. Nenhum caminho lê `PluginInstallations.active` como autoridade de licença nem chama o Hub direto do business.

## Invariants

- Sempre `auth.GetScoped(c, "Plugins")` em controllers — nunca `c.Get("tenantId")` bruto. Escritas/agregações em `Session(NewDB:true)` (armadilha do `db` escopado do GORM).
- `business` consulta **só** o `plugin-manager`; nunca o Hub direto.
- Licença = **token assinado verificado**, nunca flag local nem "confiar no corpo do heartbeat".
- Plugin `free` não toca o Hub; `pro` exige token válido + teto.
- Teto aplicado na **alocação** (fail-closed em crescimento); alocação nominal só no core.
- `degradeMode` vem do **manifesto do plugin** (por plugin), não global.

## O que NÃO fazer

- Não ler `PluginInstallations.active` como autoridade de licença — é só alocação.
- Não chamar o Hub a partir do `business` — sempre via `plugin-manager`.
- Não reportar licença válida sem verificar assinatura Ed25519 + `exp`.
- Não montar teto/licença no frontend — o frontend só envia `slug + ticket/tenant` e reflete o status.
- Não reintroduzir `saas-plugin` (control plane é o watink-saas) nem o `marketplace-hub` Node.
- Não trazer o **source do plugin-manager** de volta para o core (`watinkdev`, público) — é proprietário, vive só no repo privado `alltomatos/watink-plugin-manager` e é consumido como imagem (GHCR). Não usar `build:` no compose do core.
- Não distribuir código de plugin dinamicamente (supply chain — ADR 0003 original mantido nesse ponto). Plugins são embarcados; o que se licencia é o direito de uso.
- Não bloquear ativação de `free` por causa do Hub.

## Referências

- ADR 0024 (redesenho) · ADR 0025 (marketplace de terceiros — publishers, artefatos assinados, out-of-process; plano em [`marketplace-terceiros.md`](marketplace-terceiros.md)) · ADR 0026 (marketplace respeita instância gerida por Watink SaaS — sem checkout próprio) · ADR 0003 (superado no que diz respeito à flag) · ADR 0023 (Clientes → core)
- Hub: `watink-ecosistema/hub/docs/integration-clients.md` (§ A), `hub/docs/adr/0001-0003`, `hub/docs/adr/0005` (pacotes de licença/pool de créditos para empreendedores)
- watink-saas: ADR 0006 (licença de produto — trilho irmão, não confundir) · ADR 0008 (cliente do Hub para pacotes de licença de plugin)
