# API HTTP interna de Grupos/Comunidades (`internal/groupsapi/`)

> Produto de T0.1 do plano em `docs/agents/plugin-grupos-comunidades.md`. Contrato fechado
> antes de qualquer código — muda aqui primeiro, código depois.

## Por que existe

`enginego.Provider` (o transporte AMQP fire-and-forget usado por toda conexão `engineType:
enginego`) não tem canal de retorno síncrono. Gestão de grupo é request/response por natureza
("lista os grupos" precisa da lista *agora*). Esta API dá ao engine-go uma segunda porta HTTP,
só para esse domínio, chamando o `*whatsmeow.Client` já vivo em memória
(`WhatsAppService.clients[sessionID]`, ver `internal/whatsapp/service.go:73`).

**Nunca sai da rede docker.** Compose usa `expose:`, nunca `ports:`. Sem TLS público, sem rota
externa — é detalhe de implementação de `enginego.Provider`, não API do Watink.

## Transporte

- Porta: env `GROUPS_API_PORT`, default `8084`.
- Auth: header `X-Internal-Token`, valor = env `GROUPS_API_TOKEN`. **Fail-closed**: se
  `GROUPS_API_TOKEN` não estiver setado no ambiente, o servidor **não sobe** (mesma postura de
  `cryptobox`/`PROXY_ENC_KEY` no `business`) — nunca abre a porta sem auth.
- Sessão identificada por `sessionID` (int, o `Whatsapp.ID` do core) no path — diferente da
  izapia, que usa um `sid` opaco (aqui a sessão já é first-class no engine-go).

## Envelope — espelho do envelope da izapia

A izapia usa `{ok, data, raw?, error{code, message, details?}}` para toda resposta (verificado
ao vivo no OpenAPI dela, `api.izapia.com/openapi.json`). O engine-go replica o mesmo formato —
é o que torna `enginego.Provider` e `izapia.Provider`, no `business`, código-espelho:

```json
// sucesso
{ "ok": true, "data": { ... } }

// erro
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "grupo não encontrado" } }
```

Códigos de erro usados aqui (subconjunto do vocabulário da izapia, reaproveitado por
consistência): `INVALID_INPUT` (400) · `NOT_FOUND` (404) · `AUTH_FAILED` (401, token interno
ausente/errado) · `NOT_ADMIN` (403, ação exige admin no grupo) · `RATE_LIMITED` (429) ·
`PROVIDER_ERROR` (502, erro do whatsmeow não classificado) · `SESSION_NOT_CONNECTED` (409).

## DTO canônico do Watink

Este é **nosso** DTO — normalizado a partir do whatsmeow no engine-go, e a partir do JSON real
da izapia (capturado ao vivo abaixo) no `business`. Nenhum dos dois providers expõe o formato
nativo dele direto; ambos traduzem para isto.

```go
type GroupInfo struct {
    JID              string         `json:"jid"`              // "120363xxxxx@g.us" — chave estável ponta a ponta (invariant 5)
    Subject          string         `json:"subject"`
    Description      string         `json:"description"`
    Owner            string         `json:"owner"`             // JID (ou @lid) do criador
    IsCommunity      bool           `json:"isCommunity"`
    IsSubGroup       bool           `json:"isSubGroup"`
    ParentJID        string         `json:"parentJID,omitempty"` // presente quando IsSubGroup
    Announce         bool           `json:"announce"`          // só admin manda mensagem
    Locked           bool           `json:"locked"`            // só admin edita metadados
    MemberAddMode    string         `json:"memberAddMode"`     // "admin_add" | "all_member_add"
    JoinApprovalMode bool           `json:"joinApprovalMode"`
    PictureURL       string         `json:"pictureURL,omitempty"`
    CreatedAt        int64          `json:"createdAt"`         // unix seconds
    Participants      []Participant `json:"participants"`
}

type Participant struct {
    JID          string `json:"jid"`
    PhoneNumber  string `json:"phoneNumber,omitempty"` // vazio quando só @lid resolvido (privacidade)
    DisplayName  string `json:"displayName,omitempty"`
    IsAdmin      bool   `json:"isAdmin"`
    IsSuperAdmin bool   `json:"isSuperAdmin"`
}

type ParticipantResult struct {
    JID    string `json:"jid"`
    Status string `json:"status"` // "ok" | "error"
    Error  string `json:"error,omitempty"`
}

type JoinRequest struct {
    JID         string `json:"jid"`
    RequestedAt int64  `json:"requestedAt"`
}

type CommunityInfo struct {
    GroupInfo
    LinkedGroups []GroupInfo `json:"linkedGroups"`
}
```

**Nota de campo (`memberAddMode`):** whatsmeow expõe isso como `GroupMemberAddMode` com valores
`admin_add`/`all_member_add` — os dois nomes acima são literais do enum nativo, não inventados.

## Probe real contra a izapia (paridade — anexo de referência)

Capturado em 2026-08-04 contra uma sessão conectada real
(`GET /api/v1/sessions/{sid}/groups`), via MCP `izapia_request` — o OpenAPI da izapia não tipa
`data` (é `description`-only), então o shape só existe por captura ao vivo:

```json
[
  {
    "created": 1785463827,
    "description": "",
    "group_id": "120363410762725180@g.us",
    "owner": "61852109279407@lid",
    "participants": [
      { "is_admin": true,  "is_super_admin": true,  "jid": "61852109279407@lid" },
      { "is_admin": false, "is_super_admin": false, "jid": "54439448715448@lid" }
    ],
    "subject": "Watink plugins"
  }
]
```

`GET /groups/{groupId}` devolve o mesmo shape de um único grupo (não um array).

**Campos ausentes na resposta real da izapia** que o DTO canônico exige: `announce`, `locked`,
`memberAddMode`, `joinApprovalMode`, `pictureURL`, `isCommunity`, `isSubGroup`, `parentJID`,
`phoneNumber`/`displayName` por participante (só `jid` cru, tipicamente `@lid`, sem número nem
nome resolvido). **Consequência para T2.1 (`izapia.Provider`):** esses campos ficam com
zero-value (`false`/`""`) quando a izapia não os retorna nessa chamada — não é um bug de
mapeamento, é o que a API de origem entrega. Se o produto precisar desses campos de verdade
(ex.: mostrar quem é admin com nome), T2.1 precisa de uma chamada adicional (`GET contacts` ou
similar) para resolver `@lid`→nome/telefone — **fora do escopo do MVP**, registrar como known
gap na tela de Participantes (mostra JID quando nome não resolvido).

**Atualização (T1.3, 2026-08-04) — comunidade validada ao vivo, shape original estava
errado.** Criada e removida uma comunidade de teste na mesma sessão do probe original
(`POST .../communities` seguido de `POST .../groups/{id}/leave` para limpar). O shape real é
**completamente diferente** do que a inferência original (`CommunityInfo` = grupo +
`linkedGroups`) assumia:

```json
// POST /sessions/{sid}/communities → resposta
{
  "community_id": "120363428629289471@g.us",  // NÃO "group_id"
  "created": 1785847047,
  "description": "",
  "owner": "54439448715448@lid",
  "participants": [{ "is_admin": true, "is_super_admin": true, "jid": "54439448715448@lid" }],
  "subject": "..."
}

// GET /sessions/{sid}/communities/{communityId} → resposta
{
  "groups": [                                   // NÃO "linkedGroups"
    { "group_id": "120363426723543087@g.us", "is_default_sub_group": true, "subject": "..." }
  ],
  "participant_count": 1,
  "participants": ["54439448715448@lid"]        // array de string, NÃO de objeto
}
```

**Consequência:** `GET /communities/{id}` não devolve `subject`/`owner`/`description` no nível
raiz nenhum, e os participantes vêm como JID cru sem `is_admin`/`is_super_admin`. Isso foi
corrigido no `izapia.Provider` (`client_groups.go`/`groups.go`, lado `business`) — `GetCommunity`
não popula mais esses campos (ficam vazios, documentado no código, não é bug). O contrato da
API HTTP interna do engine-go em si (rotas de escrita de comunidade abaixo) não muda — o
whatsmeow nativo (`CreateGroup` com `IsParent`, `GetSubGroups`) segue com sua própria forma,
já implementada e testada (`groups_community.go`).

## Rotas (20 — MVP; exclui `groups/join` e `groups/preview`, ver decisão §1 do plano)

Prefixo: nenhum (mux dedicado, só este domínio). `{sessionID}` sempre no path.

| Método | Path | whatsmeow por trás |
|---|---|---|
| GET | `/sessions/{sessionID}/groups` | `GetJoinedGroups` |
| GET | `/sessions/{sessionID}/groups/{groupJID}` | `GetGroupInfo` |
| POST | `/sessions/{sessionID}/groups` | `CreateGroup` |
| POST | `/sessions/{sessionID}/groups/{groupJID}/participants` | `UpdateGroupParticipants` |
| **PUT** | `/sessions/{sessionID}/groups/{groupJID}` | subject/description/announce/locked/memberAddMode/picture — **um único PUT**, ver nota abaixo |
| GET | `/sessions/{sessionID}/groups/{groupJID}/invite` | `GetGroupInviteLink(false)` |
| POST | `/sessions/{sessionID}/groups/{groupJID}/invite/revoke` | `GetGroupInviteLink(true)` |
| POST | `/sessions/{sessionID}/groups/{groupJID}/leave` | `LeaveGroup` |
| POST | `/sessions/{sessionID}/groups/{groupJID}/join-approval-mode` | `SetGroupJoinApprovalMode` |
| GET | `/sessions/{sessionID}/groups/{groupJID}/join-requests` | `GetGroupRequestParticipants` |
| POST | `/sessions/{sessionID}/groups/{groupJID}/join-requests` | `UpdateGroupRequestParticipants` |
| POST | `/sessions/{sessionID}/communities` | `CreateGroup` com `IsParent: true` |
| GET | `/sessions/{sessionID}/communities/{communityJID}` | `GetSubGroups` + `GetGroupInfo` |
| POST | `/sessions/{sessionID}/communities/{communityJID}/groups/{groupJID}` | `LinkGroup` |
| POST | `/sessions/{sessionID}/communities/{communityJID}/groups/{groupJID}/remove` | `UnlinkGroup` |

> **Divergência do desenho original (registrada aqui, T1.2):** o rascunho inicial deste
> documento (T0.1) listava uma rota POST por campo (`/subject`, `/description`, `/announce`,
> `/locked`, `/member-add-mode`, `/picture`). A implementação real (T1.2, `groups_write.go` em
> `internal/whatsapp/` e `internal/groupsapi/`) consolidou tudo num único
> **`PUT /sessions/{sessionID}/groups/{groupJID}`**, espelhando exatamente o que o
> `enginego.Provider` do lado `business` (T2.2, já implementado antes deste ponto) já esperava:
> um PUT só com os campos alterados. `izapia.Provider` (T2.1) continua fazendo uma chamada por
> campo — os dois providers não precisam ter a mesma forma de request, só a mesma interface
> `domain.GroupEngine`.

## Campo `tenantId` nos payloads de escrita

Toda rota de **escrita** (POST/PUT, exceto leitura) espera um campo `tenantId` (string) no
corpo JSON. Diferente do resto do contrato REST do `business` (que resolve tenant via JWT), a
API interna do engine-go não tem autenticação por tenant — só a sessão. `tenantId` existe
**apenas** para que `classifyGroupWriteError` (abaixo) consiga rotear o evento `session.risk`
para o tenant certo quando uma ação de grupo dispara um sinal de risco. Rotas de leitura não
levam `tenantId`.

## `pictureURL` no PUT de configurações

O campo `pictureURL` do body do PUT carrega **base64 da imagem**, não uma URL — nome herdado do
campo de leitura equivalente (`GroupInfo.pictureURL`, que na resposta *é* uma URL, resolvida
pelo WhatsApp após o upload). Mesma convenção usada pelo campo `image` do
`SetGroupPhoto` na izapia (`client_groups.go`, lado `business`).

**Excluídas do MVP** (decisão §1 do plano — risco de ban por entrar em massa em grupos de
terceiros): `GET /groups/preview` (`GetGroupInfoFromLink`), `POST /groups/join`
(`JoinGroupWithLink`).

### Payloads de escrita (exemplos)

```json
// POST /groups
{ "subject": "Nome do grupo", "participants": ["551199999999@s.whatsapp.net"] }

// POST /groups/{groupJID}/participants
{ "action": "add" | "remove" | "promote" | "demote", "participants": ["jid1", "jid2"] }
// resposta: { "ok": true, "data": { "participants": [ParticipantResult, ...] } }

// POST /groups/{groupJID}/subject        { "subject": "novo nome" }
// POST /groups/{groupJID}/description    { "description": "novo texto" }
// POST /groups/{groupJID}/announce       { "announce": true }
// POST /groups/{groupJID}/locked         { "locked": true }
// POST /groups/{groupJID}/member-add-mode { "mode": "admin_add" | "all_member_add" }
// POST /groups/{groupJID}/join-approval-mode { "enabled": true }
// POST /groups/{groupJID}/join-requests  { "action": "approve" | "reject", "participants": ["jid1"] }
// POST /communities                       { "name": "Nome da comunidade" }
```

## Rate limiting (T1.4)

Token bucket **por `sessionID`**, aplicado antes de qualquer chamada whatsmeow de escrita
(criar, participantes, configs, convite, join-requests, leave, comunidade). Rejeição →
`429 {ok:false, error:{code:"RATE_LIMITED", message:"..."}}`. Este é o limitador de **defesa
em profundidade** — o limitador principal, que cobre também conexões `izapia` (que nunca
passam por aqui), vive no `groups_service.go` do plugin no `business` (correção §2.2 do plano).

**Default: 20 ações de escrita por sessão a cada janela de 1 minuto** (mesmo valor nos dois
limitadores, engine-go e business). Não é derivado de dados reais de produção — WhatsApp não
publica um limite oficial para ações administrativas de grupo, e a instância Watink não tinha
volume suficiente até o fechamento desta issue para calibrar empiricamente. É uma estimativa
conservadora por analogia: fica **abaixo** do que se observa tolerado para envio de mensagens
em contas não-verificadas (dezenas por minuto), partindo da premissa de que ações
administrativas (add/remove/promote em massa) têm um padrão mais "visivelmente automatizado"
para os sistemas de detecção da Meta do que mensagens individuais espaçadas. **Ambos os
limites são configuráveis** (`groupsThrottle.limit`/`.window` no business,
`throttle.limit`/`.window` no engine-go) — ajustar aqui exige mudar os dois lados
manualmente, não há config compartilhada entre os dois processos. Reavaliar quando houver
volume real de uso em produção (sinal: taxa de `session.risk` emitido por ações de grupo vs.
mensagens, comparada por período).

## Erros do whatsmeow → HTTP (implementado em T1.2)

`internal/whatsapp/groups_errors.go` define `classifyGroupWriteError`, chamado por toda
operação de escrita em `groups_write.go` — **diferente** de `risk.go`'s `riskIQCodes`
(401/403/429/463 tratados igualmente como risco para envio de mensagem), grupos distinguem:

- **401/429/463** → `ErrGroupRateLimited` → `429 {code: "RATE_LIMITED"}` **e** dispara
  `reportIfRiskSignal` (evento `session.risk`, mesma função de `risk.go`, reusada).
- **403** → `ErrGroupNotAdmin` → `403 {code: "NOT_ADMIN"}` — **não** é reportado como risco.
  "Não sou admin deste grupo" é um erro de permissão normal (ex.: usuário tentando remover
  alguém sem ser admin), não um sinal de que a conta está sendo banida/throttled. Misturar os
  dois dispararia falso-positivo de risco em toda tentativa de ação sem permissão.
- Qualquer outro erro passa adiante sem reclassificação (`400`/`502` conforme o handler).

## Client interface

`internal/whatsapp/client_iface.go` (`WhatsAppClient`) lista os métodos de grupo usados pelas
rotas de leitura (T1.1). As rotas de escrita (T1.2) chamam o `*whatsmeow.Client` diretamente
via `getConnectedClient` — mesmo padrão dos demais métodos de `WhatsAppService` (`SendText`,
`SendPoll`, ...), que também não passam pela interface `WhatsAppClient` (ela hoje só documenta
o subconjunto necessário para os testes offline dos métodos legados de send/download; grupos
seguem a mesma convenção de "teste o que dá pra testar sem client real": branches de
validação/erro no pacote `whatsapp`, happy-path completo via `Backend` fake em
`internal/groupsapi`). Métodos nativos usados: `GetJoinedGroups`, `GetGroupInfo`, `CreateGroup`,
`UpdateGroupParticipants`,
`SetGroupName`, `SetGroupTopic`, `SetGroupAnnounce`, `SetGroupLocked`,
`SetGroupMemberAddMode`, `SetGroupPhoto`, `GetGroupInviteLink`, `LeaveGroup`,
`SetGroupJoinApprovalMode`, `GetGroupRequestParticipants`, `UpdateGroupRequestParticipants`,
`GetSubGroups`, `LinkGroup`, `UnlinkGroup`) — mesmo padrão incremental usado nos PRs #214/#220
(send/download). É o que torna T1.1-T1.3 testáveis offline com um client fake.
