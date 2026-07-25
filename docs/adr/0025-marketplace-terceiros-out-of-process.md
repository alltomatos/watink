# Marketplace de terceiros: publishers, artefatos assinados e runtime out-of-process

**Status:** Aceito (jul/2026) — execução faseada, Fase 0 bloqueante. Plano executável em
[`docs/agents/marketplace-terceiros.md`](../agents/marketplace-terceiros.md). ADR irmão no Hub: `hub/docs/adr/0004`.

Com o ADR 0024 implementado ponta-a-ponta (auditado em 2026-07-04), o marketplace hoje é
**fechado**: só plugins first-party (`helpdesk`, `webchat`), embarcados na imagem do core e
licenciados via token Ed25519 do Hub. O roadmap do ecossistema sempre previu abrir a
**publishers de terceiros** (Hub README §5; o contrato de licença do Hub ADR 0002 "já nasce
preparado para isso"). Este ADR formaliza **como** abrir sem quebrar a postura de segurança.

O problema muda de natureza quando entra código de terceiro: deixa de ser "proteger a licença
do dono contra o cliente" e passa a ser **"proteger a instalação do cliente contra código que
nós não escrevemos"**. As decisões:

**1. Execução em quatro fases, com gates de segurança entre elas.**

- **Fase 0 — pré-requisitos (bloqueante):** nenhum código de terceiro entra antes de:
  `revocationList` real (kill-switch imediato — hoje o Hub sempre devolve `[]`), guard de
  produção no stub de dev do `plugin-manager` (hoje fail-open sem `HUB_URL`), fio completo do
  `checkoutUrl` (hoje vazio no `business`) e teste de paridade `licensetoken` cross-repo
  (hoje garantida só por convenção). Eram "lapidação" no contexto first-party; viram
  **pré-requisito** no contexto de terceiros.
- **Fase 1 — publisher + curadoria embarcada:** o Hub ganha a entidade Publisher (conta,
  namespace de slug, estados de review); o código do terceiro entra **por PR revisado e
  embarcado** na imagem oficial, como os plugins first-party. Zero mudança de runtime —
  valida o negócio antes de pagar o custo da infraestrutura de isolamento.
- **Fase 2 — runtime out-of-process:** plugin de terceiro vira **serviço próprio** (imagem
  OCI), orquestrado pelo `plugin-manager` local, falando com o core só pela **API de
  extensão** com token escopado. É aqui que o review deixa de ser a única barreira.
- **Fase 3 — WASM para extensões leves (condicionada a demanda):** nós customizados do
  FlowBuilder como módulos `.wasm` sandboxados (wazero, capabilities explícitas). Não é
  pré-requisito das anteriores.

**2. A invariant "plugins são embarcados, nunca distribuídos dinamicamente" (ADR 0003/0024)
permanece válida para código in-process — a Fase 2 abre UMA exceção estreita e definida.**
Plugin de terceiro na Fase 2 é um **processo separado** (container), nunca código carregado
dentro do `business`/`frontend`. A distribuição do artefato só é aceita sob todas estas
condições, verificadas pelo `plugin-manager` **antes** de subir qualquer coisa:

- Imagem OCI com **digest pinado** no catálogo do Hub (`PluginVersion.artifactDigest`);
- **Assinatura do digest** pelo Hub (mesma disciplina Ed25519/`signing_keys` do ADR 0002 do
  Hub — reusa a infra existente; cosign fica como evolução opcional);
- Versão **aprovada em review** no Hub (estado `published`, nunca `draft`/`submitted`);
- **Kill-switch ativo**: `revocationList` derruba o plugin imediatamente, sem esperar `exp`.

**3. Plugin de terceiro nunca acessa o banco.** Multitenancy (RLS + `tenantId`) é
inegociável: o plugin recebe um **token de extensão escopado** (instância + tenant + plugin +
scopes) e consome uma **API de extensão** do `business` que já filtra por tenant. Sem string
de conexão, sem rede até o Postgres, sem AMQP cru.

**4. Manifesto de permissões (scopes) com consentimento e enforcement.** O manifesto da
versão declara os scopes que o plugin precisa (`messages:read`, `contacts:write`, eventos que
escuta…). O tenant **vê e consente na ativação**; o gateway da API de extensão **enforça** — 
scope ausente = 403, sem exceção. Upgrade de versão que amplia scopes exige **re-consentimento**.

**5. LGPD orienta a topologia.** Conversa de WhatsApp é dado pessoal. Por padrão o plugin de
terceiro **roda na instância do cliente** (modelo B1) — os dados não fluem para infraestrutura
do publisher. Egress de dados para fora da instância só com scope explícito de rede/webhook
consentido na ativação. O modelo "app na infra do dev" (estilo Slack/Shopify) fica fora deste
ADR; se um dia entrar, exige novo ADR.

**6. UI de terceiro é isolada — nunca script na SPA.** Frontend de plugin de terceiro entra
por **iframe sandboxado** (origem própria, `postMessage` com contrato tipado) ou por **UI
declarativa via manifesto** (widgets renderizados pelo core). Script de terceiro injetado na
SPA principal é XSS na plataforma inteira — proibido.

**7. O `plugin-manager` (proprietário) evolui de verificador para orquestrador local.** Já é
a trava de confiança da instância (verifica licença offline); na Fase 2 passa a também:
verificar assinatura/digest do artefato, fazer pull da imagem, gerir lifecycle
(start/stop/upgrade) e aplicar o kill-switch da `revocationList`. Mantém-se **proprietário e
compiled-only** (repo privado `alltomatos/watink-plugin-manager`) — a fronteira do ADR 0024
não muda.

**Consequences:**
- Plano executável end-to-end (tarefas por repo, aceites, DAG) em
  [`docs/agents/marketplace-terceiros.md`](../agents/marketplace-terceiros.md) — fonte de
  verdade da execução; este ADR é a fonte de verdade da decisão.
- ADR irmão no Hub (`hub/docs/adr/0004`) cobre o lado servidor: Publisher, review, artefato
  assinado, `revocationList` real, scopes no manifesto.
- O ADR 0003 **permanece válido** para o in-process: nunca carregar código dinâmico dentro do
  `business`/`frontend`. A exceção da Fase 2 é exclusivamente out-of-process assinado.
- Fase 1 não altera nenhum contrato de runtime — só catálogo (campos novos são aditivos,
  backward-compatible com o `plugin-manager` atual).
- A API de extensão (Fase 2) nasce versionada e é contrato público — muda por ADR, não por PR.
