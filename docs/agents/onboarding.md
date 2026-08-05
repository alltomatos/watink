# Onboarding (Setup Wizard) — Contexto para Agentes

> **Status:** o Checklist pós-login (card no Dashboard, item 2 abaixo) foi
> **removido** do frontend por decisão de produto — `OnboardingChecklistCard`
> e `useOnboardingChecklist` foram deletados de
> `frontend/src/pages/Dashboard/`. O restante deste documento descreve o
> desenho original para o caso de reintrodução futura; não afirme que o
> checklist existe no produto atual.

## Responsabilidade
Reduzir o "time to value" do primeiro acesso: Wizard de Setup Inicial
(`POST /initial-setup`) cria o Tenant + Cargo/Setor/Queue/User Administrador
em uma submissão rápida (single-step). O Checklist pós-login que guiava o
Administrador a criar seu primeiro Setor real e primeiro usuário adicional
não faz mais parte do produto (ver Status acima).

## Arquitetura / fluxo
- **Wizard** (`frontend/src/pages/InitialSetup/`): formulário único e curto —
  Nome Fantasia*, Nome*, Sobrenome, Email*, Senha*, CPF/CNPJ (opcional).
  `POST /initial-setup` → `SetupService.InitializeTenant` cria, numa
  transação: Plan Community, Tenant (`Name` = Nome Fantasia), Subscription,
  4 Cargos-padrão (com descrições), User Administrador (blindado), Queue
  "Atendimento Inicial" (com GreetingMessage padrão), Setor "Geral"
  (vinculado à Queue, admin como gestor), Tag "Novo Cliente", Settings.
- **Checklist pós-login**: card dispensável no topo do Dashboard, visível só
  para `alcance IN (tenant, plataforma)`. 2 itens, cada um linkando para o
  fluxo real já existente (Central de Acessos): "Criar setor" (faz auto-open
  do formulário de criação de Setor —
  `/acessos/setores?autoOpen=create&suggestedName=...`, com sugestões de nome
  via chips Atendimento/Vendas/Suporte/Financeiro) e "Criar usuário". O item
  "Criar setor" **NÃO cria Queue junto**: `SetorController.Create` só faz
  `db.Create(&setor)`; a Queue é vinculada depois, na edição do Setor
  (`SetorQueuesSection` → `PUT /setores/:id/queues`). Estado é DERIVADO (sem
  persistência): item completo quando a contagem de Setores/Usuários do tenant
  excede o criado automaticamente no setup (>1).

## Modelo de dados
Nenhum modelo novo. `Tenant.Name` agora reflete o Nome Fantasia informado
(antes: `"{firstName}'s Workspace"`). Sem campo de estado de onboarding
persistido — o checklist é 100% derivado de contagens.

## Contratos
- `POST /initial-setup`: novo campo obrigatório `companyName` (Nome
  Fantasia) no `SetupRequest`. Vira `Tenant.Name`.
- Checklist não introduz endpoints novos — consome `GET /setores`,
  `GET /users` (contagem) e os fluxos de criação já existentes na Central
  de Acessos.

## Edge cases
- Contagem `>1` é uma heurística: se o admin deletar o Setor "Geral" e criar
  só 1 novo, o item pode continuar marcado como pendente (raro, custo baixo
  de errar).
- Nome Fantasia não precisa ser único globalmente — cada Tenant é isolado
  (multi-tenant).
- Checklist nunca aparece para Cargos sem alcance tenant/plataforma
  (Atendente/Gestor comum não têm permissão de criar Setor/Usuário mesmo).

## Limites (o que NÃO resolve)
Não é um tour guiado interativo (sem overlay/spotlight na UI) — é um card
estático com links. Não valida "qualidade" do Setor/Usuário criado além das
validações já existentes dos formulários reais.

## Ops
Nenhuma migração de schema. Seed atualizado (descrições dos Cargos-padrão +
GreetingMessage da Queue inicial) roda no próximo reset/boot do ambiente.

## Critério de sucesso (invariantes verificáveis)
Completar o wizard com Nome Fantasia "Acme" cria `Tenant.Name == "Acme"`
(teste) · os 4 Cargos-padrão têm `Description != ""` (teste) · Queue
"Atendimento Inicial" tem `GreetingMessage != ""` (teste) · checklist não
aparece para usuário com alcance=proprio (teste) · checklist desaparece
após criar 1 Setor extra + 1 User extra (teste/verificação manual).
