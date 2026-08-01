# Assistants (Assistentes de IA) — Agent Reference

## Responsabilidade

Plugin `pro` que permite criar automações conversacionais por IA ("Assistants"), cada uma
ligada a uma conexão WhatsApp e operando em um de 4 modos. Reaproveita a infraestrutura já
existente do core (FlowBuilder, KnowledgeBase, Agent Runtime) em vez de duplicar lógica de
IA — ver ADR 0020 e o ADR novo deste módulo.

## Modelo de dados

- `Assistant` (`Assistants`): identidade + conexão (`WhatsAppID *int`,
  `AllowMultipleOnConnection`) + `Mode` (`pipeline|flow|persona|router`) + `Config JSON`
  (campos específicos do modo) + gatilho (`TriggerType/TriggerOperator/TriggerValue`) +
  avançado (`SessionExpiryMinutes`, `TypingDelayMs`, `DebounceSeconds`, `EndKeyword`,
  `ExpiryMessage`, `ClosingMessage`, `StopOnHumanReply`, `IgnoreGroups`).
- `AssistantRouterOption` (`AssistantRouterOptions`): opções do modo `router` — relacional,
  não JSON (precedente `PipelineStage`).
- `AiGateway` (`AiGateways`): provedores de IA do plugin (Configurações → Agentes de IA),
  cifrados at-rest, distintos do `omniroute` do core.

## Contratos por modo

- **`pipeline`**: `PipelineID`, lista de `events` (`deal_created|stage_changed|idle|closed`),
  `idleThresholdDays`, `respondsAfterProactive`. Dispara mensagem proativa via
  `core.SendTicketMessage`; se `respondsAfterProactive=true`, passa a responder com
  persona+RAG (mesmos campos do modo `persona`) até handoff.
- **`flow`**: `FlowID` — delega 100% ao `FlowRun` existente, zero lógica de IA própria.
- **`persona`**: `Persona`, `KnowledgeBaseID`, `MaxTurns`, `AiGatewayID`,
  `RagFallbackBehavior` (`handoff|generic_answer|fixed_message` + `RagFallbackMessage`).
  Usa `flow.AgentResponder` — nunca reimplementar a chamada de LLM/RAG aqui.
- **`router`**: sem persona/RAG própria — apresenta menu (`AssistantRouterOptions`) e
  redireciona o próximo inbound do contato para o `TargetAssistantID` escolhido, que deve
  estar na MESMA conexão (`WhatsAppID` do router).

## Contratos com outros módulos

- **FlowBuilder**: o Assistant gera um Flow sintético interno (`Flow.Internal=true`) para
  reaproveitar trigger-matching/debounce/sessão do runtime existente — não duplicar esse
  matching no plugin. `FlowController.List` deve filtrar `Internal=false` por padrão.
- **KnowledgeBase**: modo `persona` referencia `KnowledgeBaseID` existente; ingestão/retrieval
  seguem 100% o fluxo já documentado em `docs/agents/knowledge-base.md`.
- **Pipeline**: consome eventos de domínio (novo publisher no core, não no plugin) — ver
  seção Eventos de Pipeline abaixo. Não adicionar lógica de Assistant dentro do
  `PipelineController` além de emitir o evento.
- **SDK (`sdk.WatinkCore`)**: precisa de `RegisterCron`/`Subscribe` (interface opcional
  `WatinkCoreScheduler`, type-assertion) — gap identificado, resolver antes da Fase 7.

## Eventos de Pipeline (novo)

Hoje `Pipeline`/`Deal` não têm nenhum hook de execução automática. Este módulo introduz um
`DomainEventBus` in-process mínimo, publicado pelo `DealController` após criar/mudar estágio
de Deal, e um cron (leader-lock Redis) que varre Deals parados há X dias. Ambos vivem no
core (reutilizáveis por outros consumidores futuros), mas o único consumidor inicial é este
plugin.

## Edge cases

- Duas criações simultâneas de Assistant na mesma conexão sem `AllowMultipleOnConnection` →
  lock transacional (`SELECT ... FOR UPDATE`) evita corrida.
- Dois Assistants "todas as mensagens" ativos na mesma conexão com
  `AllowMultipleOnConnection=true` sem keyword → erro de validação explícito (ordem de
  resolução não é determinística o suficiente para permitir silenciosamente).
- `AiGateway` com chave inválida ou provider fora do ar → cai no mesmo comportamento de erro
  de transporte do `agent_executor.go` (handoff), nunca vaza erro de provider ao contato.
- Falta a chave de cifra do `cryptobox` → fail-closed (mesmo padrão do módulo Proxy/Clientes).
- Licença expira com conversa em andamento → conversa segue até o fim; só bloqueia
  criar/ativar novo Assistant.
- RAG sem resposta no modo `persona` → comportamento por `RagFallbackBehavior`, padrão
  recomendado `handoff`.

## Critério de sucesso

- Um Assistant criado em cada um dos 4 modos responde/dispara corretamente em teste manual
  (ver plano de verificação).
- Nenhum Flow sintético aparece na listagem normal de `/flows`.
- Segunda criação de Assistant na mesma conexão sem `AllowMultipleOnConnection` é bloqueada
  com mensagem clara.
- Configurações → Agentes de IA só aparece com o plugin ativo; CRUD de `AiGateway` nunca
  retorna `ApiKey` em texto plano.
- `go build`/`go test`/`npm run lint`/`npm run typecheck` verdes; OpenAPI regenerado.
