# Componentes de Grupos e Comunidades

Stack: React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui + Lucide React.

## Estrutura de Arquivos

```
src/services/groupService.ts          # tipos (espelham domain.GroupEngine) + chamadas REST

src/pages/Groups/
├── index.tsx                    # Lista de grupos da conexão selecionada
├── GroupDetail.tsx               # Detalhe em abas (Participantes/Configurações/Convite/Solicitações)
├── GroupParticipantsPanel.tsx    # Tabela de participantes + ações (add/promote/demote/remove)
├── GroupSettingsPanel.tsx        # Nome/descrição/announce/locked/memberAddMode
├── GroupInviteCard.tsx           # Link de convite + revogar
├── JoinRequestsPanel.tsx         # Aprovar/rejeitar solicitações de entrada
├── CreateGroupDialog.tsx
├── GroupsErrorState.tsx          # Estados dedicados 402/429/501 (compartilhado com Communities)
├── groupTypes.ts                 # WhatsappOption, classifyGroupsApiError
└── hooks/
    └── useGroups.ts              # useGroupsConnection — seleção/persistência de whatsappId

src/pages/Communities/
├── index.tsx                     # Lista de comunidades
├── CommunityDetail.tsx           # Subgrupos vinculados + vincular/desvincular
└── LinkGroupDialog.tsx           # Seleciona grupo elegível para vincular
```

## useGroupsConnection

Hook central de escopo. Busca `GET /whatsapp`, persiste a conexão selecionada em
`localStorage` (`groupsWhatsappId`, via `useLocalStorage`), e corrige a seleção se a conexão
salva não existir mais na lista atual. Consumido por `Groups/index.tsx`, `GroupDetail.tsx`,
`Communities/index.tsx` e `CommunityDetail.tsx`.

## GroupsErrorState

Renderiza um dos três estados que a plan (§6.5) exige como telas dedicadas — nunca toast cru:

| `kind` | Origem HTTP | O que mostra |
|---|---|---|
| `blocked` | 402 | "Plugin bloqueado" + botão para `/admin/settings/marketplace` |
| `rateLimited` | 429 | Mensagem de proteção contra banimento (não é erro de sistema) |
| `notSupported` | 501 | "Conexão sem suporte a grupos" |
| `generic` | outro | Mensagem de erro genérica |

`classifyGroupsApiError` (`groupTypes.ts`) inspeciona `err.response.status` e mapeia para um
desses `kind`s — usado em toda chamada de API deste módulo (list/get/create/update/...).

## GroupParticipantsPanel

- `Table` com avatar (iniciais, via `Avatar` do design system — não Radix puro),
  nome/telefone/JID, badge de papel (Superadmin/Admin/Membro).
- `DropdownMenu` por linha: promover, rebaixar (some quando não aplicável), remover.
- Adicionar em massa via `Dialog` com `Textarea` (um número por linha ou separados por vírgula).
- Toda chamada usa `updateParticipants` e renderiza `ParticipantResult[]` retornado — um card
  "Resultado da última ação" lista cada JID com seu status (`ok`/`error`).

## GroupSettingsPanel

Formulário single-page: nome, descrição, dois `Switch` (announce/locked), `Select` para
`memberAddMode`. **Nota**: `joinApprovalMode` aparece desabilitado — `domain.GroupEngine` tem
`SetJoinApprovalMode` mas o plugin (`internal/plugins/groups.go`) ainda não expõe uma rota REST
dedicada para essa ação isolada (gap conhecido, documentado no componente); a aprovação em si já
funciona via a aba Solicitações (`join-requests`).

## Regras de design aplicadas

- Cards/painéis: `rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)]` — nunca `border`.
- Overlays (`Dialog`): `rounded-xl`.
- Nenhum componente novo em `components/ui/` — tudo reusa o conjunto existente
  (`page-layout`, `card`, `table`, `tabs`, `dialog`, `select`, `input`, `textarea`, `switch`,
  `badge`, `avatar`, `skeleton`, `button`).
- Ícones exclusivamente `lucide-react`.
