# ADR 0026 — Marketplace do tenant respeita instância gerida por Watink SaaS (sem checkout próprio)

**Status:** Aceito (jul/2026) — desenho verificado, execução ainda não iniciada. ADR-pai: `hub/docs/adr/0005` (decisão central); ADR irmão: `watink-saas/docs/adr/0008`.

## Contexto

O ADR 0024 deu ao Marketplace do core um fluxo de autosserviço: o tenant clica "Ativar" num plugin `pro` sem licença e `PluginController.Activate` (`business/internal/controllers/plugin_manager.go:132`) dispara `pc.pmProxy.Checkout(slug)` automaticamente — o `plugin-manager` local relaia ao Hub (`POST /plugins/checkout`), que cria/reativa a `PluginLicense` daquela instância. Isso é o comportamento certo pra uma instância **isolada** (sem Watink SaaS): quem opera decide o que compra.

O `hub/docs/adr/0005` muda a regra pra instância **gerida** por um Watink SaaS: quem compra plugin passa a ser o empreendedor, via bundle de créditos — o tenant final só ativa/desativa o que já foi alocado, nunca inicia uma compra nova. O Hub fecha a ponta dele (`checkout.Handler` recusa checkout avulso pra instância vinculada a um `Customer`, 403). Falta o core parar de **tentar** — hoje, ao clicar "Ativar" num plugin sem licença, o `Activate` chama `Checkout` de qualquer forma, e o tenant veria um erro genérico do Hub em vez de uma mensagem que faça sentido pro contexto dele.

## Decisão

**Mudança cirúrgica em um handler existente, nada de tela ou endpoint novo.** `PluginController.Activate` ganha uma checagem antes de chamar `pc.pmProxy.Checkout(slug)`: se a instância é gerida por um Watink SaaS, **não tenta checkout** — devolve `402` com uma mensagem clara ("Este plugin precisa ser contratado pelo administrador da sua conta") em vez de acionar o Hub, que rejeitaria mesmo assim.

Sinal de "sou gerido": reusa o que **já existe** — a env `SAAS_INTERNAL_TOKEN` (a mesma que `middleware.InternalSaaSOnly()` já usa pra saber se este core atende ao control plane de algum Watink SaaS, Trilha A). Não introduz nenhum contrato novo core↔plugin-manager (o `plugin-manager` é repo fechado, distribuído só como imagem — a versão anterior deste desenho pedia expor o `instanceId` do Hub por lá; descartado, não é necessário pra esta decisão).

**O que NÃO muda:**
- O gate de autorização em si — ativar um plugin sem `PluginLicense` válida já falha hoje (fail-closed, ADR 0024), governado ou não. Esta decisão só evita a TENTATIVA de checkout, não adiciona uma checagem de autorização nova.
- Ativar/Desativar um plugin **já licenciado** na instância continua idêntico — o tenant (respeitando `alocados < cap`, ADR 0003 do Hub, e a permissão RBAC de sempre) liga/desliga o que o empreendedor já trouxe.
- `GET /plugins/catalog` continua devolvendo o catálogo cheio — a vitrine de navegação não muda; só o botão "Ativar" de um plugin sem licença se comporta diferente quando governado (mensagem em vez de tentativa de compra).

## Consequences

- Uma condicional nova em `PluginController.Activate`, um helper pequeno (`isSaaSManaged() bool`, reusa `os.Getenv("SAAS_INTERNAL_TOKEN") != ""`) — sem migration, sem rota nova, sem mudança no `plugin-manager`.
- Frontend (Marketplace): trata o novo formato de erro 402 (mensagem específica) sem lógica condicional nova — já exibe `message` do corpo do erro hoje.
- Nenhuma mudança em `PluginRegistry`, `pluginlicense.Client`, heartbeat ou qualquer parte do fluxo de licença — só a decisão de TENTAR checkout ou não.
- Atualiza `docs/agents/plugins.md` com a nova regra e referencia os ADRs irmãos.
