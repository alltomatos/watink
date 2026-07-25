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

### 1. Migration de permissões (legacy Node)

```bash
npx sequelize migration:create --name seed-permissions-<nome-plugin>
```

```typescript
// migration
const permissions = [
  { name: "view_<plugin>", description: "Visualizar <Plugin>" },
  { name: "edit_<plugin>", description: "Editar <Plugin>" },
];
await queryInterface.bulkInsert("Permissions", permissions, { ignoreDuplicates: true });
```

### 2. Proteção de rota (Backend Go)

```go
// router.go
r.GET("/plugins/<nome>", authMiddleware, checkPermission("<plugin>.view"), handler.Index)
r.POST("/plugins/<nome>", authMiddleware, checkPermission("<plugin>.edit"), handler.Create)
```

### 3. Proteção de interface (Frontend)

```tsx
import { useAuth } from "@/hooks/useAuth"

const { hasPermission } = useAuth()

{hasPermission("view_<plugin>") && <MenuItem>Plugin</MenuItem>}
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
