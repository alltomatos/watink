# ADR 0030 — Campanhas de Grupo: Divergências do ADR 0016

**Status:** Accepted
**Data:** 2026-08-07

## Contexto

O ADR 0016 registra o risco estrutural de banimento e os guard-rails de produto/técnicos
para **Campaigns** — disparo em massa do FlowBuilder para **contatos individuais**, cada
destinatário materializado como um `FlowRun` não-interativo (`CampaignRecipient`).

A epic "Campanhas de Grupo" (issues #589-#602) adiciona uma 4ª aba ao plugin Grupos e
Comunidades: postar uma mensagem programada em **vários grupos de WhatsApp**, não em
contatos. É uma entidade própria (`GroupCampaign` e as tabelas irmãs
`GroupCampaignVariant`/`Target`/`Run`/`Send`/`Reply`, prefixadas de propósito — ver
CONTEXT.md) — **nunca confundir com `Campaign`/`CampaignRecipient`** do FlowBuilder, que
continua reservado para disparo-a-contato.

O risco estrutural do ADR 0016 (fingerprint `whatsmeow`, independente de comportamento)
**não muda** ao trocar o destinatário de um contato para um grupo — continua valendo
integralmente. O que muda é a **superfície de destinatário**: um grupo não é uma pessoa
que opta por receber, é um canal compartilhado do qual a conexão é (ou não) membro. Isso
quebra premissas inteiras do ADR 0016 (opt-in por destinatário, rotação de chip) e exige
registrar explicitamente o que transfere, o que não transfere, e por quê — em vez de
silenciosamente reinterpretar o 0016 ou editá-lo (ele permanece `Accepted` e correto para
o caso que descreve).

## Decisão

A tabela abaixo é o núcleo deste ADR — cada linha do ADR 0016 avaliada para o caso de
grupo, com a justificativa.

| Requisito do ADR 0016 | Transfere para campanha de grupo? | Justificativa |
|---|---|---|
| Aviso de risco não-dispensável na UI | **SIM, sem alteração** | O fingerprint estrutural do `whatsmeow` independe de quem é o destinatário — grupo ou contato, o mesmo cliente não-oficial é detectado do mesmo jeito. `CampaignRiskWarning.tsx` (issue #600) é sempre renderizado, nunca colapsável, e trava Salvar/Disparar até o aceite. |
| Roadmap para API oficial (BSP) como destino zero-risco | **SIM, mas o texto muda e fica mais forte** | Para contato, a Cloud API é um destino real (com custo por conversa e templates aprovados). **Para grupo, a Cloud API não cobre disparo em grupo — não existe hoje um caminho oficial/sancionado**, ponto final. O texto da UI (`CampaignRiskWarning.tsx`) reflete isso: não promete uma migração futura que não existe. |
| Opt-in por destinatário | **NÃO** | Não há como colher consentimento individual de cada membro de um grupo — o "destinatário" é o grupo, não uma pessoa. O análogo que existe é: a conexão precisa ser **membro** do grupo (não dá pra postar num grupo que não integra), e o picker (`CampaignGroupPicker.tsx`) alerta e **exclui automaticamente** grupos `announce=true` onde a conexão não é admin (esse envio seria rejeitado pelo próprio WhatsApp). |
| Supressão permanente no PARAR/STOP | **PARCIAL** | Uma palavra de opt-out (issue #598: `PARAR\|STOP\|SAIR\|DESCADASTRAR`) vinda de **um membro** do grupo marca a resposta (`isOptOut=true`), mas **nunca** suprime o grupo inteiro automaticamente — o "PARAR" de uma pessoa não pode desinscrever todo mundo que foi adicionado por um admin. Vira sinal + ação manual do operador ("remover este grupo das campanhas", relatório #601). |
| Rotação de chip ponderada por reputação | **NÃO, contraproducente aqui** | No caso de contato, espalhar entre chips reduz volume por conexão. No caso de grupo, um chip só posta em grupos de que é membro — **postar o mesmo conteúdo no mesmo grupo a partir de dois números é um sinal de spam MAIS forte, não menor**. `GroupCampaign.WhatsappID` é fixo por campanha (uma conexão), sem rotação. |
| Token-bucket + jitter + pausa de lote | **SIM** | Implementado como timestamps pré-calculados em `GroupCampaignSend.ScheduledAt` (`buildSendSchedule`, issue #593) — nunca `time.Sleep`. Pisos fixos no backend (`clampPacing`): intervalo mínimo 60s, jitter ≤ interval/4, lote máx. 20, pausa entre lotes mín. 180s. O cliente vê os mesmos pisos (`CampaignPacingForm.tsx`) e o eco `pacingAdjusted` quando o servidor ajusta. |
| Circuit-breaker por conexão | **SIM** | `evaluateCircuitBreaker` (issue #594): N falhas consecutivas na mesma conexão pausam automaticamente toda campanha `running` daquela conexão, com `pauseReason` registrado. |
| Status por cache de evento, nunca DB stale | **PARCIAL, e declarado como tal** | O SDK de plugins (`pkg/sdk`) não expõe o cache de `session.status` em memória a plugins — só `WatinkCoreScheduler` (cron/event bus). O drain (`pickDueSends`, issue #594/#597) lê `Whatsapps.status` persistido, que É escrito por evento (não é um valor arbitrário), mas não é uma leitura de cache em memória. O circuit-breaker é o que compensa essa lacuna: uma conexão que caiu sem que o status tenha sido atualizado ainda vai falhar os próximos envios e ser pausada automaticamente em poucas tentativas. |
| Dedup por `EnvID`, `Session(NewDB:true)`, `WHERE tenantId` manual, nunca `time.Sleep` | **SIM, os quatro sem exceção** | `flow.WhatsAppAdapter.Send` dedupa por `EnvID` via Redis antes de qualquer envio real (issue #595); toda escrita/agregação que reusa um `db` já escopado usa `Session(&gorm.Session{NewDB: true})` (aprendido na prática durante #597 — ver commits que corrigiram acúmulo de condições); todo query no plugin carrega `WHERE "tenantId"` manual (RLS inerte fora de request HTTP); nenhum caminho de campanha usa `time.Sleep` — cadência é sempre `scheduledAt` pré-calculado varrido pelo cron. |

### O aviso de risco na UI

O texto implementado em `frontend/src/pages/GroupCampaigns/components/CampaignRiskWarning.tsx`
(issue #600) é o que este ADR referenda: conexões podem ser banidas em semanas
independentemente da cadência configurada (sinal estrutural, não comportamental), e —
diferente de campanha para contato — **não existe hoje um canal oficial e sancionado
para disparo em massa em grupos**. O checkbox de aceite ("Entendo o risco de banimento e
assumo a responsabilidade") é persistido em `GroupCampaign.RiskAckAt`/`RiskAckUserID` e
**re-exigido ao editar um `draft`** (o aceite não sobrevive a uma mudança de configuração
não confirmada).

> Nota de processo: o texto exato acima entrou em produção sinalizado como pendente de
> aval do dono do produto (issue #600, PR correspondente) — este ADR registra o texto tal
> como implementado no momento do merge; se o texto mudar depois, atualizar aqui junto.

## Alternativas consideradas

- **Reinterpretar o ADR 0016 in-place para cobrir grupos:** editaria um ADR `Accepted`
  para um caso que ele não descreve, e esconderia justamente as divergências que
  importam (opt-in, rotação). Rejeitada — um ADR novo que referencia o 0016 é mais
  honesto sobre o que mudou e por quê.
- **Aplicar rotação de chip como no 0016:** analisada e rejeitada explicitamente (ver
  tabela) — é contraproducente para grupo, não apenas desnecessária.
- **Supressão automática de grupo inteiro no primeiro opt-out:** mais simples de
  implementar, mas um único membro não tem autoridade para desinscrever o grupo todo
  (que pode ter sido adicionado por um admin sem relação com quem pediu pra parar).
  Rejeitada em favor de sinalizar + ação manual do operador.

## Consequências

- **Duas entidades de campanha coexistem no sistema com riscos de mesma origem, mas
  guard-rails diferentes** — `Campaign`/`CampaignRecipient` (FlowBuilder, ADR 0016,
  destinatário=contato) e `GroupCampaign` (plugin Grupos, este ADR,
  destinatário=grupo). CONTEXT.md documenta as duas com nota cruzada explícita para
  nunca confundir os nomes.
- **A narrativa de "roadmap para BSP" diverge por caso de uso** — verdadeira para
  contato, falsa para grupo. Documentação e UI têm que manter essa distinção viva; um
  texto genérico de "campanhas" que ignore essa diferença estaria errado para um dos
  dois casos.
- **Sem rotação de chip para grupo é uma decisão permanente, não um débito** — não é
  algo a "implementar depois", é o comportamento correto dado que rotação pioraria o
  sinal de spam.

## Referências

- [ADR 0016](0016-campaign-antiban-structural-risk.md) — risco estrutural de ban, guard-rails de produto/técnicos para campanha a contato (base deste ADR)
- [CONTEXT.md](../../CONTEXT.md) — entradas `GroupCampaign`/`GroupCampaignRun`/`GroupCampaignSend`/`GroupCampaignReply`, cada uma com nota distinguindo do `Campaign` do FlowBuilder
- `docs/agents/plugin-grupos-comunidades.md` — arquitetura do plugin Grupos e Comunidades, seção Campanhas
- Issues #589-#602 (epic "Campanhas de Grupo")
