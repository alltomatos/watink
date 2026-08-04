# Desenvolvimento de Plugins

> **Licenciamento e ativação foram redesenhados (ADR 0024).** A fonte de verdade sobre o
> *sistema* de plugins (Marketplace, licença, gating, trilho com o Hub) é
> [`docs/agents/plugins.md`](../agents/plugins.md). **Este guia cobre só como CONSTRUIR um
> plugin** (estrutura, RBAC, multitenancy). As seções de ativação/licença abaixo foram
> atualizadas para o modelo novo.

## Conceito

Um plugin no Watink integra-se ao Backend Go e ao Frontend React. **Plugins são sempre embarcados
na imagem Docker** — não há download de código em runtime (ADR 0003/0024, anti-supply-chain). O
que o "Marketplace" faz é **ativar** (opt-in por tenant) uma feature embarcada e, para plugins
`pro`, validar a **licença** emitida pelo Hub. Um plugin é, por definição, uma feature que precisa
ser **ativada via Marketplace** — o que está sempre-ligado é core, não plugin.

## Estrutura de um Plugin

```
backend (business/):
  internal/plugins/<nome>/
    handler.go      → controllers HTTP (Gin)
    service.go      → regras de negócio
    repository.go   → queries PostgreSQL
    domain.go       → tipos e interfaces

frontend (frontend/src/):
  pages/<Nome>/
    index.tsx       → página principal
  components/<Nome>/
    *.tsx           → componentes específicos
```

## Integração de Permissões (RBAC)

> **Modelo atual (ADR 0022) — substitui o texto anterior desta seção.** O RBAC legado
> (`Group`/`Role`/migration Sequelize/`view_<plugin>`) foi descontinuado no reset de acessos.
> O catálogo hoje é `recurso:ação`, semeado em Go, e a barreira real é `auth.RequirePermission`
> no backend — permissão nunca é só cosmética de menu. Ver
> [`docs/agents/acessos.md`](../agents/acessos.md) para o modelo completo.

### 1. Seed de permissões (Go)

Adicione o recurso do plugin ao slice de `business/internal/database/database.go` (não é mais
migration Sequelize):

```go
// business/internal/database/database.go
{Resource: "<plugin>", Action: "read", Description: "Visualizar <Plugin>"},
{Resource: "<plugin>", Action: "manage", Description: "Gerenciar <Plugin>"},
```

Escolha o nome do recurso com cuidado se o domínio já tem um conceito homônimo no core (ex.:
o plugin de grupos usa `whatsappGroups`, não `groups`, porque `ConnectionGroup`/`ProxyGroup`/
`TagGroup` já existem e são coisas totalmente diferentes).

### 2. Proteção de rota (Backend Go)

Rotas registradas fora de um plugin (controllers comuns) aplicam `auth.RequirePermission`
diretamente na cadeia do Gin:

```go
// routes.go
protected.GET("/<plugin>", auth.RequirePermission("<plugin>", "read"), handler.Index)
```

**Dentro de um plugin**, `sdk.WatinkCore.RegisterRoute(method, path, handler)` só aceita **um**
`gin.HandlerFunc` — não há como encadear o middleware do jeito acima. Componha manualmente
(`auth.RequirePermission` é um middleware que chama `c.Next()`; a composição funciona porque
verificamos `c.IsAborted()` explicitamente em vez de depender do `c.Next()` interno):

```go
func withPermission(resource, action string, next gin.HandlerFunc) gin.HandlerFunc {
	check := auth.RequirePermission(resource, action)
	return func(c *gin.Context) {
		check(c)
		if c.IsAborted() {
			return
		}
		next(c)
	}
}

core.RegisterRoute("GET", "/<plugin>", withPermission("<plugin>", "read", handler.Index))
```

Lembre-se: `RegisterRoute` já embrulha o **gating de licença** (ADR 0024) — `RequirePermission`
é uma camada **adicional**, não um substituto. Uma rota de plugin sem `withPermission` fica
protegida por licença mas não por RBAC granular.

### 3. Proteção de interface (Frontend)

```tsx
import { Can } from "@/components/Can"

<Can user={user} perform="<plugin>:read" yes={() => <MenuItem>Plugin</MenuItem>} />
```

## Tipagem e Multitenancy

- **Sempre** use `string` para `tenantId` — nunca `number`
- No Backend Go: extraia o tenant com `tenantUUIDFromContext(c)`
- Toda query deve filtrar por `tenant_id`

## Ativação e Licenciamento (ADR 0024)

A ativação é **opt-in por tenant** via Marketplace e grava a **alocação** em `PluginInstallations`
(`active=true`). Essa flag **não é autoridade de licença** — é só o registro de que o tenant X
usa o plugin Y. A autoridade de licença é o Hub (token assinado), consultado pelo `business` via
`plugin-manager` local. Fluxo resumido:

- **Plugin `free`**: `POST /plugins/:slug/activate` → cria `PluginInstallations(active=true)`. Não toca o Hub.
- **Plugin `pro`**: `POST /plugins/:slug/activate` → o `business` pergunta ao `plugin-manager` se
  a instância tem **licença válida** e **teto livre** (`alocados < tenantCap`) → aloca, ou devolve
  `checkoutUrl` (adquirir no Hub), ou `402` (teto cheio). **Pendência conhecida:** hoje
  `checkoutUrl` sempre retorna vazio no `business` — o Hub já expõe `POST /checkout` funcional,
  mas o fio até uma URL utilizável pelo usuário final ainda não foi fechado.

O gating em runtime cruza **licença** (plugin-manager) × **alocação** (`PluginInstallations`) via
`PluginRegistry.GetStatus(slug, tenantId)`: `active` → segue; `readonly` → só GET; `blocked`/`unlicensed`
→ 402. Na expiração, aplica-se o `degradeMode` do **manifesto do plugin** (`readonly`|`blocked`).

> **NÃO** consulte o Hub diretamente do `business`, **nem** trate `PluginInstallations.active`
> como prova de licença. O `business` fala só com o `plugin-manager`; a licença é um **token
> Ed25519 verificado offline** (`pkg/licensetoken`).

## Contrato de licença (Hub ↔ plugin-manager ↔ business)

O contrato HTTP completo (heartbeat, catálogo, token assinado, `tenantCap`, `revocationList`) está
em `watink-ecosistema/hub/docs/integration-clients.md` § A e resumido em
[`docs/agents/plugins.md`](../agents/plugins.md). Pontos-chave para quem implementa no core:

- `plugin-manager` → Hub: `POST /api/v1/plugins/heartbeat` (renova tokens) e `GET /catalog`.
- `business` → `plugin-manager`: `GET /internal/licenses` (pull + cache ~60s) → por plugin
  `{status, tenantCap, exp}`, com a assinatura já verificada por `pkg/licensetoken`.
- `frontend` → `business`: `GET /plugins/catalog`, `GET /plugins/installed`,
  `POST /plugins/:slug/activate|deactivate`.
