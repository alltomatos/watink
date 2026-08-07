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

## Campanhas de Grupo

4ª aba da página "Grupos WhatsApp" (`/grupos-whatsapp/campanhas`, `CampanhasTab.tsx`) — postar uma
mensagem programada em vários grupos de uma vez. **Entidade própria** (`GroupCampaign` e afins) —
nunca confundir com o `Campaign` do FlowBuilder (disparo a contato, ADR 0016); ver
[ADR 0030](../../adr/0030-campanhas-de-grupo-divergencias-do-0016.md).

- **Serviço**: `src/services/groupCampaignService.ts` — tipos espelhando os modelos Go 1:1, cobre
  CRUD + ações (`start`/`test`/`pause`/`resume`/`cancel`) + relatório paginado.
- **Editor** (`pages/GroupCampaigns/GroupCampaignEditor.tsx`, rotas `/group-campaigns/new` e
  `/group-campaigns/:campaignId`): layout de duas colunas como o `QuickAnswerEditor`. O aviso de
  risco (`CampaignRiskWarning.tsx`) é **sempre renderizado, nunca colapsável**, e o checkbox de
  aceite trava Salvar e Disparar — mandato do ADR 0016/0030, não uma escolha de UX. O editor de
  variante de mensagem (`CampaignVariantsEditor`/`CampaignVariantContentEditor`) **reusa** os
  editores de tipo das Respostas Rápidas (`pages/QuickAnswers/editors/`), filtrados aos 5 tipos
  liberados na v1 (sem Carrossel, sem PIX).
- **Relatório** (`pages/GroupCampaigns/GroupCampaignReport.tsx`, rota
  `/group-campaigns/:campaignId/report`): seletor de ocorrência → tiles de resumo (lidos direto de
  `GroupCampaignRun`, sem recálculo no frontend) → tabela paginada de envios → feed de respostas
  paginado com citação (`quoted`) e janela (`window`) sempre separadas, nunca somadas num único
  "engajamento". Taxa de resposta por variante calculada client-side (caminha as páginas de sends
  da ocorrência selecionada + replies da campanha, com teto documentado no código).
- **Gap conhecido**: o texto do aviso de risco em `CampaignRiskWarning.tsx` foi implementado
  sinalizado como pendente de aval final do dono do produto (issue #600) — checar se ainda está
  marcado como provisório no código antes de tratá-lo como definitivo.
