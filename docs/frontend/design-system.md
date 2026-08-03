# Frontend Design System

## Stack (ago/2026)

**React 18 + TypeScript + Tailwind v4 + shadcn/ui + Vite**. MUI v4 removido (ADR 0008). Novos componentes exclusivamente em `.tsx` + shadcn/ui.

Identidade visual: **corporativa/B2B** (painel operacional), não app de consumo. Ver [Paleta Corporativa](#paleta-corporativa) e [Regras Anti-Consumer-App](#regras-anti-consumer-app) abaixo — resultado do redesign corporativo (Epics #503–#506, jul-ago/2026).

## Estrutura de Diretórios

```
frontend/src/
  components/
    ui/              → componentes shadcn/ui + Watink-native (.tsx)
    ThemedToastContainer/ → ToastContainer com tema atado ao dark mode
  lib/
    utils.ts         → cn() helper (clsx + tailwind-merge)
    notify.ts        → ponto único de disparo de toast (notify.success/info/warning/error)
  theme/
    tokens/
      primitives.ts  → paleta base em hex (NUNCA usada direto em componentes)
      semantic.ts    → tokens com significado, exportados para o loader
      components.ts  → tokens de componentes (radius, spacing, card…)
    bridge.css       → mapeia tokens semânticos → vars shadcn/ui (--primary, --border…)
    loader.ts        → injeta tokens semânticos como CSS vars em HSL cru no :root em runtime
    tokens/colors.css → fallback estático dos tokens semânticos em HSL cru
  index.css
    @theme inline    → registra --color-* para Tailwind gerar bg-*, text-*, border-* utilities
    @layer base      → --radius, --color-* (hsl resolvido para uso em style={{}})
```

## Arquitetura de Tokens (3 camadas)

```
primitives.ts   →  valores brutos (hex, px, ms)
    ↓
semantic.ts     →  tokens com significado (action-primary, bg-surface, border-default…)
    ↓ loader.ts injeta como CSS vars em HSL cru (ex: "221 83% 53%")
colors.css      →  fallback estático dos mesmos tokens em HSL cru no :root
    ↓
bridge.css      →  mapeia tokens semânticos → variáveis shadcn/ui
                   (--primary, --border, --muted, --card…)
    ↓
index.css @theme →  Tailwind v4 gera utilitários (bg-primary, border-border…)
                    adicionando hsl() sobre os tokens HSL cru
```

`semantic.ts` define 8 presets (apple/google/whatsapp/saas × light/dark) trocados em runtime pelo `ThemeProvider` (`context/DarkMode`) — o app troca `data-theme`/`data-app-theme` no `<html>`, nunca a classe `.dark` do Tailwind (o `dark:` variant do Tailwind está **inerte** no projeto; não usar).

## Paleta Corporativa

O preset **apple** (usado como `light`/`dark` de fallback) teve `action-primary` recalibrado do azul iOS (`#007AFF`) para o mesmo azul corporativo já usado no preset `saas` — objetivo: menos "app de consumo", mais painel B2B.

| Token | Antes (iOS blue) | Depois (corporativo) |
|---|---|---|
| `action-primary` (light) | `211 100% 50%` (`#007AFF`) | `221 83% 53%` (`#2563EB`) |
| `action-primary-hover` (light) | `220 100% 50%` | `224 76% 48%` (`#1D4ED8`) |
| `action-primary` (dark) | `210 100% 52%` | `213 94% 68%` (`#60A5FA`) |

Ao ajustar cor de marca no futuro, mude `semantic.ts` (fonte da verdade) — nunca hardcode hex em componente. Os outros 3 presets (google/whatsapp/saas) não foram tocados; `saas` já era o alvo estético e serviu de referência.

## REGRA CRÍTICA — Variáveis CSS + Tailwind v4

Os tokens semânticos armazenam **canais HSL crus** (ex: `221 83% 53%`), sem `hsl()`.
O Tailwind v4 adiciona `hsl()` via `@theme inline` em `index.css`.

```css
/* ❌ ERRADO — resulta em hsl(hsl(...)) = CSS inválido */
--primary: hsl(var(--action-primary));

/* ✅ CORRETO */
--primary: var(--action-primary);

/* ❌ ERRADO — hex não é válido como canal HSL */
--primary: var(--blue-500);

/* ✅ CORRETO — usa token semântico HSL cru */
--primary: var(--action-primary);
```

Para adicionar novas cores ao Tailwind, declare em `index.css` no bloco `@theme inline`:
```css
@theme inline {
  --color-minha-cor: hsl(var(--meu-token-semantico));
}
```

Para usar cores em `style={{}}` inline, use as vars `--color-*` (já têm `hsl()` resolvido):
```tsx
style={{ color: 'var(--color-primary)' }}   // ✅
style={{ color: 'var(--primary)' }}          // ❌ — HSL cru, não é cor CSS válida
```

**Cuidado com `bg-[var(--token)]`/`text-[var(--token)]` em classe arbitrária Tailwind**: isso emite `background-color: 221 83% 53%` (HSL cru sem `hsl()`) — CSS inválido, a regra é descartada silenciosamente pelo browser. Use sempre `bg-[hsl(var(--token))]` em classes arbitrárias, ou prefira um utilitário já registrado em `@theme` (`bg-primary`, `bg-status-success-bg`, …).

## Design Language

**Superfícies e cards — sombra, não borda:**
```tsx
// ✅ Cards/superfícies de conteúdo
"rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)]"

// ✅ Overlays flutuantes (dropdown, popover, dialog)
"rounded-xl shadow-[0px_8px_24px_rgba(0,0,0,0.12)]"

// ❌ PROIBIDO — borda visível não faz parte do visual Watink
"border bg-card shadow-sm"
```

**Border-radius padrão:**
| Elemento | Classe | Valor |
|---|---|---|
| Cards e painéis | `rounded-2xl` | 16px |
| Overlays (dropdown, popover, select) | `rounded-xl` | 12px |
| Botões e inputs | `rounded-md` | 8px |
| Badges/pills | `rounded-full` | — |
| Container de ícone em KPI card (`MetricCard`) | `rounded-xl` | 12px — deliberadamente menos arredondado que o card em volta (era `rounded-2xl`, ajustado no redesign corporativo) |

**Separadores:** `border-b border-border`. Nunca usar `border-slate-700` fora do sidebar.

**Números em destaque (KPIs, valores tabulares):** usar `tabular-nums` para não haver "dança" de largura ao trocar dígitos — ver `components/ui/metric-card.tsx`.

## Regras Anti-Consumer-App

Regras adicionadas no redesign corporativo para afastar o produto de uma estética de app de consumo:

1. **PROIBIDO emoji como ícone estrutural** (título de página/seção, botão, badge de status, item de menu). Use `lucide-react`. Emoji só é aceitável como *conteúdo* informal em áreas de chat WhatsApp-style (reações, texto de exemplo de mensagem) — nunca como ícone de UI.
   ```tsx
   // ❌ PROIBIDO
   <h1>🎫 Helpdesk</h1>

   // ✅ CORRETO
   <h1 className="flex items-center gap-2">
     <Ticket className="h-5 w-5 text-muted-foreground" />
     Helpdesk
   </h1>
   ```
2. **PROIBIDO cor Tailwind nomeada hardcoded** (`bg-blue-100`, `text-red-700`, `border-green-200`…) fora de contexto de tema/marca legítimo (ex.: preview de mensagem WhatsApp). Use tokens semânticos (`bg-status-success-bg text-status-success-text`) ou `StatusChip`/`Badge`. O lint hoje cobre hex/rgba cru mas **não** cobre paleta nomeada do Tailwind — revisão manual em code review é necessária até isso ser fechado (ver GAP no fim do documento).
3. **PROIBIDO** `<Button variant="..." className="bg-blue-600 hover:bg-blue-700">` ou qualquer override de cor via `className` que sobrescreva a variant — se a cor que você precisa não existe como variant, adicione a variant (ex.: `destructive-ghost`), não hardcode.

## Sidebar

| Propriedade | Valor |
|---|---|
| Largura expandida | `w-[200px]` |
| Largura colapsada | `w-[70px]` |
| Fundo | `bg-[var(--slate-800)]` (`#1E293B`) |
| Borda direita | `border-[var(--slate-700)]` |
| Toggle | Header, lado direito |
| Persistência | `localStorage` key `wt:sidebar:collapsed` |
| Mobile | Sempre fechado (< 1024px), sem persistir |

**PROIBIDO** usar `border-border` dentro do sidebar — use `border-[var(--slate-700)]`.

O componente ativo é `components/MainSidebar/`. `components/layout/sidebar.tsx` e `components/layout/header.tsx` são código morto do MUI-era — o primeiro foi removido no Epic #506; o segundo ainda não tem nenhum import ativo (candidato a remoção futura, fora de escopo desta leva).

## Componentes de Página (shell)

`components/ui/page-layout.tsx` exporta `PageContainer` / `PageHeader` / `PageContent`. **Só existe um nome hoje** — `PageLayout` era um alias duplicado do mesmo componente e foi removido no Epic #506; todo código novo usa `PageContainer`.

```tsx
<PageContainer>
  <PageHeader
    title={
      <span className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        Clientes
      </span>
    }
  >
    {/* ações do header: busca, botão "Novo X" */}
  </PageHeader>
  <PageContent>
    {/* conteúdo da página */}
  </PageContent>
</PageContainer>
```

`Tickets` é a exceção deliberada: é um workspace de chat com shell próprio (`MainContainer`/`MainHeader`), não uma página CRUD — não forçar `PageHeader` genérico nela, só os tokens de cor/spacing (herdados automaticamente por serem semânticos).

## Componentes Compartilhados (Epic #505)

Introduzidos para eliminar os padrões que antes eram copiados manualmente página a página. **Preferir sempre estes componentes em código novo** em vez de recriar a lógica de loading/empty/error/form:

### `DataTable` (`components/ui/data-table.tsx`)
Tabela genérica que resolve loading (skeleton via `TableRowSkeleton`), empty state e error state automaticamente — sem `colSpan` manual sincronizado com o header (causa histórica de divergência entre as ~10 implementações de tabela copiadas antes deste componente existir).

```tsx
const columns: DataTableColumn<Client>[] = [
  { key: "name", header: "Nome", cell: (c) => <span className="font-medium">{c.name}</span> },
  { key: "actions", header: "Ações", className: "text-right w-[100px]", cell: (c) => <ActionsCell client={c} /> },
];

<DataTable
  columns={columns}
  data={clients}
  getRowKey={(c) => c.id}
  loading={loading}
  emptyTitle="Nenhum cliente encontrado"
  emptyDescription="Cadastre o primeiro cliente para começar."
/>
```

### `EmptyState` / `ErrorState` (`components/ui/empty-state.tsx`, `error-state.tsx`)
Usados internamente pelo `DataTable`, mas também standalone em qualquer área sem dado (ex.: sidebar de detalhe sem seleção). `ErrorState` aceita `onRetry` — diferencia estado de erro de estado vazio, algo que antes não existia (falha de fetch degradava silenciosamente para "Nenhum X encontrado").

### `FormField` (`components/ui/form-field.tsx`)
Wrapper padrão de campo de formulário: label + controle + erro/helper text + indicador de obrigatório num único lugar. Substitui as 4 variantes de exibição de erro (`<span>`/`<p>`/`aria-invalid`/nenhum) e os 2 elementos de label (`<Label>` vs `<label className="text-sm font-medium">`) que coexistiam antes.

```tsx
<FormField htmlFor="email" label="Email" required error={touched.email ? errors.email : undefined}>
  <Field name="email">{({ field }) => <Input {...field} id="email" type="email" />}</Field>
</FormField>
```

### `notify` (`lib/notify.ts`) + `ThemedToastContainer`
Ponto único de disparo de toast — `notify.success/info/warning/error(...)`. `notify.error` delega ao `errors/toastError.ts` já existente (que resolve mensagem do backend via i18n e trata HTTP 402 como caso especial de billing). `ThemedToastContainer` (montado em `routes/index.tsx`) faz o `ToastContainer` do `react-toastify` acompanhar o dark mode do app — antes ficava sempre no tema claro padrão da lib, independente do tema escolhido pelo usuário.

**GAP conhecido**: `notify`/`ThemedToastContainer` foram introduzidos mas a migração dos ~180 call sites existentes (`toast.success(...)`/`toast.error(...)` diretos, ~105 deles ignorando o `toastError` helper) para `notify.*` **não foi feita** — é trabalho incremental futuro, não um requisito do Epic #505.

## Inventário de `components/ui/`

| Componente | Uso |
|---|---|
| `button.tsx` | 6 variants: `default` `destructive` `outline` `secondary` `ghost` `destructive-ghost` `link` × 4 sizes (`default` `sm` `lg` `icon`). `destructive-ghost` foi adicionado no redesign corporativo para cobrir o padrão de botão de excluir com ícone (antes reimplementado inline em ~10 lugares como `variant="ghost" className="text-destructive hover:bg-destructive/10"`) |
| `badge.tsx` | `rounded-full` (era `rounded-md` antes do redesign — corrigido para bater com a doc) |
| `status-chip.tsx` | Pill de status com 5 variantes semânticas (`success/error/warning/info/default`) × 3 tamanhos + dot opcional — preferir a `Badge` quando o significado é status (não rótulo genérico) |
| `metric-card.tsx` | KPI card do Dashboard — `tabular-nums` no valor, ícone em `rounded-xl` |
| `data-table.tsx`, `empty-state.tsx`, `error-state.tsx`, `form-field.tsx` | Ver seção acima |
| `avatar.tsx`, `card.tsx`, `checkbox.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `page-layout.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `skeleton.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `title.tsx`, `tooltip.tsx` | Primitivas shadcn/ui padrão — sem desvio de contrato |

**Ainda não existem no projeto** (avaliar antes de implementar algo equivalente do zero): `alert.tsx`, um wrapper de `Form` (react-hook-form) — o projeto usa **Formik + Yup** em ~1/3 dos formulários; os demais são `useState` sem validação. Não introduzir uma segunda lib de formulário sem decisão explícita.

## Regras de Componentes

1. **PROIBIDO** novo `makeStyles` — estilização nova obrigatoriamente em Tailwind.
2. **PROIBIDO** novo import de `@material-ui/core` em qualquer arquivo.
3. **TypeScript obrigatório** — todos os arquivos novos em `.tsx`.
4. **React 18 obrigatório** — shadcn/ui exige React 18+.
5. Antes de criar uma tabela/formulário/empty-state nova do zero, checar se `DataTable`/`FormField`/`EmptyState`/`ErrorState` já resolvem — ver seção "Componentes Compartilhados" acima.

## Status do Rollout (redesign corporativo — Epics #503-#506)

O redesign cobriu a **fundação** (tokens, paleta, componentes compartilhados) e um **conjunto de telas de referência** (Sidebar, Dashboard, Clients, Settings, Tickets) — não o produto inteiro. Ao tocar uma página fora dessa lista, ela provavelmente ainda usa os padrões antigos (tabela HTML manual, formulário sem `FormField`, emoji como ícone). Isso é esperado, não é regressão — é trabalho pendente.

**Feito:**
- Tokens/dark mode/fontes consertados (#503)
- `action-primary` recalibrado para azul corporativo; `Button`/`Badge` alinhados à doc; variant `destructive-ghost` (#504)
- `DataTable`/`EmptyState`/`ErrorState`/`FormField`/`notify`/`ThemedToastContainer`; emoji estrutural removido nos pontos identificados (#505)
- `PageLayout`/`PageContainer` unificados; `components/layout/sidebar.tsx` morto removido; `ClientsTable` migrada para `DataTable`; Settings (`GeneralSection`, `HelpdeskSection`) migrado para `FormField`; `MetricCard` com `tabular-nums` (#506)

**Pendente (não é bug, é escopo futuro):**
- Rollout de `DataTable`/`FormField` para as ~25 páginas restantes fora da leva de referência (ex.: Helpdesk ainda usa tabela HTML manual sem `DataTable`/`EmptyState`)
- Migração dos ~180 call sites de `toast.*` direto para `notify.*`
- Cobertura de lint para cor Tailwind nomeada hardcoded (hoje só hex/rgba cru são pegos)
- `components/layout/header.tsx` morto (candidato a remoção, não removido ainda)

## Referência

Auditoria completa (tokens, componentes, formulários, tabelas, toasts, i18n) feita em ago/2026 via `ui-ux-pro-max` skill — histórico de decisão nos PRs #507-#510.
