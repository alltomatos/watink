# Inventário (WMS) — Contexto para Agentes

## Responsabilidade

Motor de estoque (Product/SKU/Warehouse/InventoryMovement) — o "motor matemático" central para
qualquer vertical do Watink que lide com bens físicos ou serviços quantificáveis (delivery,
Atividades/OS, varejo). Estratégia de **Divulgação Progressiva de Complexidade** (PRD original,
notebook "Watink Ecosistema - Plugin Estoque"): o modelo de dados é sempre único (avançado); o
que varia por tenant é qual superfície de API fica disponível.

- **Modo Simples (core, sempre ligado, grátis):** um "Armazém Principal" e uma tabela de preço
  "Base" resolvidos automaticamente pelo backend, nunca expostos no payload. CRUD de
  Produtos/SKUs + entrada/saída manual.
- **Modo Avançado (plugin PRO `inventory-advanced`):** múltiplos armazéns, transferências,
  fichas técnicas (BOM), tabelas de preço extras. Gate de licença via Marketplace — não existe
  coluna `tenant_settings.inventory_mode`; o frontend decide o que mostrar consultando o status
  do plugin, mesmo padrão de Helpdesk/Webchat/Grupos (evita duas fontes de verdade sobre o que
  já é autoridade do licenciamento).

## Arquitetura / fluxo

- **Models (core):** `business/internal/models/inventory.go` — `Product`, `ProductSKU`,
  `ProductComposition`, `PriceTable`, `SKUPrice`, `Warehouse`, `WarehouseBalance`,
  `InventoryMovement`. Todos migrados via `database.Migrate()` (`AutoMigrate` +
  `addCustomIndexes`), independente de qual modo o tenant usa — o schema é sempre unificado.
- **Service (core):** `business/internal/services/inventory_service.go`
  (`InventoryService.RegisterMovement`) — único caminho de escrita para
  `InventoryMovements`/`WarehouseBalances`.
- **Controller (core, Modo Simples):** `business/internal/controllers/inventory.go` — rotas
  `/inventory/products*` e `/inventory/movements/{in,out}`, sempre disponíveis, sem gate de
  licença, `auth.GetScoped(c, "Inventory")`.
- **Plugin PRO:** `business/internal/plugins/inventory_advanced.go` (slug
  `inventory-advanced`) — rotas `/warehouses*`, `/inventory/transfer`, `/price-tables*`,
  `/products/:id/composition`. Não cria tabela nova nenhuma. Como `internal/plugins` é
  importado por `internal/application/usecases`, que por sua vez fica a montante de
  `internal/services`, o plugin **não pode importar `internal/services`** (import cycle) — a
  lógica de `RegisterMovement` é deliberadamente duplicada em
  `business/internal/plugins/inventory_shared.go` (`registerInventoryMovement`), mesmo
  precedente de `coreImpl.CreateActivity` (ver módulo Atividades no `CLAUDE.md` raiz). Se o
  contrato de locking mudar num lado, muda no outro — não há teste de paridade automático
  entre os dois hoje (dívida conhecida, mesma classe do teste de paridade de `slaDueAt` do
  Fase 1 de Atividades).

## Modelo de dados

- `Product` — `tenantId`, `categoryId`, `name`, `unit` (UN/KG/L), `isComposite`, soft-delete.
- `ProductSKU` — `productId`, `skuCode`, `barcode`, `minQuantity`, soft-delete. É a entidade
  real referenciada por `WarehouseBalance`/`InventoryMovement`, não `Product`.
- `ProductComposition` — `parentSkuId`, `childSkuId`, `quantityRequired` (BOM, só populada em
  Modo Avançado, tabela sempre existe).
- `PriceTable`/`SKUPrice` — `SKUPrice.priceCents` é **`int64` (centavos)**, não `float64` — é o
  invariante monetário global do ecossistema; diverge deliberadamente de `Plan.Price`/
  `Deal.Value` (que são `float64 decimal(10,2)`, dívida técnica antiga, não um padrão a copiar
  em código novo).
- `Warehouse` — soft-delete; "Armazém Principal" nunca pode ser removido (checagem no plugin).
- `WarehouseBalance` — PK composta `(warehouseId, skuId)`, saldo atômico, **nunca** recalculado
  somando o histórico.
- `InventoryMovement` — append-only, sem `DeletedAt`, sem caminho de `UPDATE` em nenhum service.

## Contratos

- **Sempre `auth.GetScoped(c, "Inventory")`** — nunca `c.Get("tenantId")` bruto.
- **Locking:** `RegisterMovement` roda em transação com `SELECT ... FOR UPDATE` na linha de
  `WarehouseBalance` antes de decidir o novo saldo — impede que duas saídas concorrentes
  derrubem o saldo abaixo de zero (coberto por
  `TestInventoryService_RegisterMovement_ConcurrentOUTsNeverGoNegative`).
- **Correção de erro:** nunca `UPDATE` em `InventoryMovements`. Um lançamento errado se
  corrige com um novo movimento de compensação (`OriginType=MANUAL`), nunca editando o
  histórico.
- **Hard delete proibido:** `Product`/`ProductSKU`/`Warehouse` são sempre soft-delete. O
  controller rejeita a exclusão de um Produto se algum de seus SKUs tiver histórico em
  `InventoryMovements` (`409 Conflict`) — usar ajuste de estoque em vez disso.
- **`inventory.low_stock`:** emitido via `EmitToTenantRoom`/`core.EmitSocketEvent("tenant:"+id,
  ...)` sempre que o saldo resultante de um movimento fica abaixo de `SKU.MinQuantity` — nunca
  `EmitToNamespace("/")`.
- **Transferência (Modo Avançado)** é sempre um par `OUT` no armazém de origem + `TRANSFER` no
  destino, cada um passando pelo mesmo `registerInventoryMovement` — não é um tipo de escrita
  separado com lógica própria.

## Edge cases

- **Criar produto sem estoque inicial:** `InitialStock=0` no `CreateProduct` não gera nenhum
  `InventoryMovement` — o SKU existe com saldo implícito zero (sem linha em
  `WarehouseBalances` até o primeiro movimento).
- **Preço zero/ausente no cadastro simples:** `PriceCents<=0` não cria `SKUPrice` — o produto
  fica sem preço até uma edição posterior.
- **Remover Armazém com saldo:** bloqueado (`409`) enquanto qualquer `WarehouseBalance` daquele
  armazém for diferente de zero.

## Limites (o que NÃO resolve nesta fase)

- Sem onboarding dedicado criando Armazém/Tabela "Base" no wizard de setup — a criação é
  **lazy** (`FirstOrCreate` no primeiro uso), decisão deliberada para não acoplar o módulo ao
  fluxo de Onboarding existente.
- Sem integração ainda com Atividades (OS) nem com um futuro Plugin de Delivery — o PRD original
  descreve ambos consumindo esta API interna, mas a integração em si é trabalho futuro.
- Sem bloco `agent` no FlowBuilder consultando disponibilidade de estoque (roadmap do PRD, não
  implementado nesta fase).
- Sem teste de paridade automatizado entre `inventory_service.go` (core) e
  `inventory_shared.go` (plugin) — mudança de contrato de locking precisa ser replicada
  manualmente nos dois lugares.

## Ops

- Catálogo do Hub: plugin `inventory-advanced` (id 4) está `published`, versão `1.0.0`,
  R$ 499,99 (`priceCents=49999`), `degradeMode=readonly`. Já ativável via Marketplace.
- Migração via `AutoMigrate` no bootstrap principal (`database.Migrate()`) — não há
  `OnInstall` real rodando em produção (mesmo padrão de Helpdesk).

## Critério de sucesso (invariantes verificáveis)

`POST /inventory/products` cria Produto+SKU+preço sem expor Warehouse/PriceTable · entrada/saída
manual sempre no Armazém Principal resolvido pelo backend · saída que excede o saldo retorna
`409` · duas saídas concorrentes nunca deixam saldo negativo · saldo abaixo de `minQuantity`
emite `inventory.low_stock` tenant-scoped · produto com histórico de movimentação não pode ser
hard-deletado nem soft-deletado sem checagem · Modo Avançado (armazéns extras, transferência,
BOM, tabelas de preço extras) só responde com licença `inventory-advanced` ativa.
