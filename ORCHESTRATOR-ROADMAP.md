# Roadmap do Projeto

## Epics (Visão Estratégica)

- [x] **Epic 1**: Transição do Sistema de Design (MUI v4 → Tailwind + shadcn/ui) | ✅ Concluída
- [x] **Epic 3**: Migração Total Frontend (163 JS/JSX → TSX, remoção MUI, design tokens, lint) | ✅ Concluída jun/2026
- [x] **Epic 2**: Refatoração DI & organização de pacotes (Backend Go) | ✅ Concluída
- [x] **Epic 4**: Qualidade residual — 56 `no-explicit-any` eliminados em 21 arquivos (GAP-ANY) | ✅ Concluída jun/2026 PR #166
- [x] **Epic 5**: Decomposição de God-Files Frontend (GAP-Q/GAP-S) — 20+ god-files eliminados | ✅ Concluída jun/2026
- [x] **Epic 6**: Cobertura de Testes Frontend (GAP-R/GAP-T) — 65/65 testes verdes | ✅ Concluída jun/2026
- [ ] **Epic 7**: Plugin "Assistentes de IA" (Assistant) — 4 modos (pipeline/flow/persona/router), AiGateway, Flow sintético + extensão SDK | 🔧 Planejada — ver `docs/agents/assistants.md`, ADR 0027, plano em `C:\Users\ronaldo\.claude\plans\grill-feature-with-docs-vamos-planejar-memoized-key.md` PR #100

## Milestones

| ID | Descrição | Status |
|---|---|---|
| M1 | Auditoria do Design System | ✅ |
| M2 | Alinhamento de terminologia (CONTEXT.md) | ✅ |
| M3 | Substituição de componentes legados (BaseCard, MetricCard, StatusChip, PageLayout) | ✅ |
| M4 | Migração estrutural (MainLayout, Dashboard, Tickets, Contacts, FlowBuilder) | ✅ |
| M5 | Token Format Migration (JS → CSS Custom Properties + HSL cru) | ✅ |
| M6 | Migração 46 componentes compartilhados MUI → shadcn+TSX | ✅ |
| M7 | Sync Documentação Design System | ✅ |
| M8 | Migração 66+ páginas/modais MUI → shadcn+TSX | ✅ |
| M13 | Ticket Queue Visibility — filtros isGroup + withUnreadMessages + type badges | ✅ PR #98 jun/2026 |
| M14 | GAP-MEDIA-1: mídias WhatsApp salvas em disco, MediaUrl preenchido (backend Go) | ✅ PR #163 jun/2026 |
| M15 | GAP-MEDIA-2: player de áudio customizado com progresso visual e seek | ✅ PR #180 jun/2026 |
| M16 | GAP-ANY: 56 no-explicit-any eliminados em 21 arquivos frontend | ✅ PR #166 jun/2026 |
| M17 | GAP-EIO: Vite watcher resiliente a crash WSL2/EIO | ✅ PR #165 jun/2026 |
| M9 | Storybook + A11y + Visual Regression CI | ⏳ Pendente |
| M18 | GAP-VAL-3: ValidateStringField em ticket_mutation.go (2 endpoints com ShouldBindJSON sem validação de string) | ✅ Concluída |
| M10 | Remoção final MUI v4 (npm uninstall + zero imports) | ✅ jun/2026 |
| M11 | ESLint governance — 298 → 70 erros (-77%) | ✅ jun/2026 |
| M12 | Docs cleanup — CLAUDE.md, docs/dev/, docs/ legado | ✅ jun/2026 |

## Próximo Epic — Backend Go DI & Packages

**Branch**: `refactor/backend-di-packages`

Objetivos:
- Garantir DI pura em todos os controllers e services (`business/`)
- Separar camadas: `domain/`, `application/`, `infrastructure/`
- Definir interfaces explícitas entre `business/` e `engine-go/`
- Cobrir endpoints críticos com testes de integração (`httptest`)

## Histórico de Decisões

| Data | Decisão |
|---|---|
| 2026-06-17 | API Docs: Swagger UI → Scalar + swaggo/swag (50+ rotas anotadas, JSON gerado automaticamente) |
| jun/2026 | Nova nomenclatura de branches baseada em Conventional Commits (feat/, fix/, refactor/, chore/, docs/, hotfix/) |
| jun/2026 | docs/dev/ recriado — removido conteúdo Docker Swarm legacy e referências a agentes obsoletos |
| jun/2026 | Epic 3 concluída: MUI v4 removido, 163 arquivos migrados para TSX, design token system 3 camadas |
| jun/2026 | CLAUDE.md reduzido com ponteiros para docs/ especializados |
| 2026-06-16 | Epic 4F: npm uninstall @material-ui/* — zero imports MUI em src/ |
| 2026-06-16 | Epic 4E: ESLint expandido, typescript@5.9.3, 298 → 70 erros |
| 2026-06-14 | Epic 4D: todas as páginas e modais migrados para shadcn/ui + TSX |
| 2026-06-13 | Epic 4B: 46 componentes compartilhados migrados |
| 2026-06-13 | Epic 4A: tokens migrados para CSS Custom Properties em HSL cru |
