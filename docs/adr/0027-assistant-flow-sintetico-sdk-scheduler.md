# ADR 0027 — Assistant via Flow sintético + extensão opcional do SDK de plugins

## Contexto

O plugin "Assistentes de IA" (`Assistant`) precisa de um ponto de entrada de mensagens
inbound equivalente ao que o FlowBuilder já resolve (`trigger.go`: keyword matching,
debounce, sessão via `FlowRun`, precedência "sessão manda", opt-out STOP). Duas alternativas
foram consideradas: (a) implementar um segundo pipeline de matching de mensagens dentro do
plugin, paralelo ao do FlowBuilder; (b) gerar, por trás dos panos, um `Flow` interno de 1 nó
por Assistant (`Flow.Internal=true`), reaproveitando 100% do runtime existente.

Similarmente, o plugin precisa reagir a eventos de domínio (mudança de estágio de Pipeline)
e rodar um cron (Deals parados há X dias) — capacidades que `sdk.WatinkCore` não expõe hoje.

## Decisão

1. **Flow sintético**: cada Assistant ativo gera/atualiza um `Flow` interno
   (`Internal bool`, campo novo em `models.Flow`) cujo nó de entrada projeta o trigger do
   Assistant e cujo nó seguinte (`assistant`, novo executor em `flow/assistant_executor.go`)
   despacha para a lógica do plugin via uma interface pequena injetada — evitando duplicar
   trigger-matching/debounce/sessão. `FlowController.List` filtra `Internal=false` por
   padrão para não vazar esses Flows na UI normal.
2. **SDK opcional**: `sdk.WatinkCore` ganha uma interface adicional `WatinkCoreScheduler`
   (`RegisterCron`, `Subscribe`) implementada pelo `PluginManager` e consumida via
   type-assertion — aditiva, não quebra `HelpdeskPlugin`/`WebchatPlugin` existentes.

## Por que

Reimplementar matching de mensagens no plugin duplicaria uma parte não-trivial do
FlowBuilder (ADR 0011/0012) e criaria dois lugares para corrigir o mesmo tipo de bug. O Flow
sintético é mais barato de manter e automaticamente ganha qualquer evolução futura do
runtime (ex.: novos operadores de trigger). O custo é o acoplamento indireto Assistant↔Flow
e o risco de vazamento na listagem — mitigado pelo filtro `Internal=false`.

A extensão do SDK via interface opcional (em vez de crescer `WatinkCore` diretamente) evita
quebrar os dois plugins existentes e estabelece o padrão para futuros plugins que precisem
de cron/evento de domínio.
