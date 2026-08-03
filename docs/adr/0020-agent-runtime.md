# ADR 0020 — Agent Runtime único com dois pontos de entrada (nó `agent` + Agente standalone)

**Status:** Accepted  
**Data:** 2026-06-28

## Contexto
O Watink terá dois modos de IA conversacional sobre a Base de Conhecimento: (1) fluxos determinísticos do FlowBuilder com um passo "inteligente"; (2) uma feature futura de **Agents** — agentes de atendimento autônomos que "pensam" sobre o conhecimento com guardrails, fora de um flow. A tentação é construir o agente autônomo como um motor separado do FlowBuilder, o que duplicaria o loop LLM, os guardrails e a integração com RAG.

## Decisão
Construir **um único Agent Runtime** (loop LLM: pensa → recupera via RAG como tool → responde, com guardrails compartilhados), exposto de **duas formas**:

- **Nó `agent` no FlowBuilder (curto prazo):** o flow faz o scaffolding (trigger/menu/roteio) e o nó `agent` entrega a conversa ao runtime para atendimento livre sobre uma KnowledgeBase, suspendendo/retomando em `waiting_message` como qualquer nó interativo. O estado/turn-taking fica no `business` (FlowRun); o runtime é stateless por turno.
- **Agente standalone (futuro):** o **mesmo** runtime, mas o agente **é** a conversa inteira (sem flow ao redor), disparado direto. Reusa 100% do runtime.

O runtime vive no `watink-knowledge` (ver ADR 0018). Mantém-se o **nó `knowledge` separado** para RAG de 1 turno controlado (lookup determinístico), distinto do nó `agent` (multi-turno autônomo).

## Alternativas consideradas
- **Dois motores separados (agente autônomo ≠ FlowBuilder):** duplica o loop LLM, guardrails e integração RAG; diverge com o tempo. Rejeitado.
- **Colapsar `knowledge` e `agent` num nó só:** menos conceitos, mas mistura o lookup determinístico (previsível) com o agente autônomo (livre) — perde-se o controle fino que o autor do flow às vezes quer.
- **Agent loop em Go (no `business`):** mantém estado nativo, mas reimplementa o agente onde o ecossistema é fraco; o runtime stateless-por-turno já mantém o estado no `business` sem isso.

## Consequências
- **Sem reescrita:** o Agente standalone (futuro) nasce do mesmo runtime; o nó `agent` entrega valor já dentro de flows.
- **Reaproveita a Fase 1 do FlowBuilder:** o nó `agent` é mais um executor que suspende/retoma em `FlowRun`.
- **Guardrails e RAG centralizados:** uma fonte de verdade para "responder só do contexto / citar / handoff em baixa confiança".
- **Dois nós a manter (`knowledge` vs `agent`):** distinção documentada (1 turno controlado vs multi-turno autônomo) para não confundir o autor do flow.

## Atualização — 2026-08-02 (ADR 0028)

O **ADR 0028** internaliza o RAG (e o Agent Runtime) no core Go. A frase "o runtime vive no `watink-knowledge`" acima é histórica: o runtime agora vive em `internal/knowledge/agent.go` (`GoAgentResponder`), implementando a mesma interface `flow.AgentResponder` — mesmo protocolo `[[ACTION:continue|resolved|handoff]]`, mesmos guardrails, sem mudança em `agent_executor.go`. A alternativa "Agent loop em Go" descartada acima deixa de se aplicar: o motivo da rejeição (ecossistema Go fraco para parsing/RAG) não se sustentou como custo maior que manter dois processos — ver ADR 0028 para o raciocínio completo. A distinção entre nó `knowledge` (1 turno) e nó `agent` (multi-turno) permanece inalterada.
