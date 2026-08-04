# Grupos e Comunidades

Gestão ativa de grupos e comunidades do WhatsApp — plugin `pro` (`slug: "groups"`),
ativável por tenant no Marketplace. **Reescrito** (esta versão descrevia uma tela `/groups`
que nunca chegou a existir — `/groups` estava livre tanto no backend quanto no frontend até o
plugin ser implementado).

## Funcionalidades

- **Grupos**: listar (escopado por conexão), criar, ver detalhe em abas (Participantes,
  Configurações, Convite, Solicitações).
- **Participantes**: adicionar em massa, promover/rebaixar/remover individualmente — toda ação
  em massa mostra resultado item a item (`ParticipantResult[]`), nunca um "sucesso" genérico.
- **Configurações**: nome, descrição, `announce` (só admin manda mensagem), `locked` (só admin
  edita), quem pode adicionar membros.
- **Convite**: ver link atual, revogar e gerar novo.
- **Solicitações de entrada**: aprovar/rejeitar quando `joinApprovalMode` está ativo.
- **Comunidades**: listar, criar, ver subgrupos vinculados, vincular/desvincular grupo.

## Arquitetura

- **Rotas**: `/groups`, `/groups/:jid`, `/communities`, `/communities/:jid`. Todas exigem
  `activePlugins.includes("groups")` **e** permissão `whatsappGroups:read` (menu) —
  `whatsappGroups:manage`/`whatsappGroups:admin` gateiam ações específicas no backend.
- **Serviço**: `src/services/groupService.ts` — tipos espelhando
  `business/internal/domain/group_engine.go` e chamadas REST para o plugin.
- **Seletor de conexão**: toda tela é escopada por `whatsappId` (persistido via
  `useLocalStorage("groupsWhatsappId")`, `src/pages/Groups/hooks/useGroups.ts`) — um grupo do
  WhatsApp não existe sem uma conexão.
- **Estados de erro dedicados** (`GroupsErrorState.tsx`): 402 (plugin bloqueado) → CTA para o
  Marketplace; 429 (throttle) → mensagem de proteção contra banimento, não erro de sistema; 501
  (provider sem suporte) → indica a conexão. Nenhum desses vira toast genérico.
- **Gap conhecido**: `GET /communities` no backend deriva a lista filtrando `ListGroups()` por
  `isCommunity` — em conexões `izapia` isso fica sempre vazio (a API da izapia não retorna esse
  campo nos endpoints de grupo, ver `engine-go/docs/groups-api.md`). Funciona normalmente em
  conexões `enginego`.

Ver [`COMPONENTS.md`](COMPONENTS.md) para a estrutura de arquivos e responsabilidade de cada
componente.
