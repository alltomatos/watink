# Base de Conhecimento (Knowledge Base)

Repositório de informações vetorizado (RAG) usado pelos nós `knowledge`/`agent` do
FlowBuilder e pelo plugin Assistants para responder perguntas com contexto e citação.

## Funcionalidades

- **Fontes**: texto direto, upload de arquivo (`.txt`, `.md`, `.pdf`, `.docx`, `.csv`,
  `.xlsx`), ou URL de uma página web.
- **Status em tempo real**: cada fonte transita `pending → processing → ready|error` via
  SSE, com `chunkCount` e `lastError` visíveis na UI.
- **Playground de recuperação**: testa uma query contra a base e mostra os chunks
  recuperados com score de similaridade — a forma real de avaliar se a vetorização está
  boa (`RetrievalPlayground.tsx`).
- **Inspeção de chunks**: expandir uma fonte mostra como o texto foi dividido (chunk por
  chunk, com contagem de caracteres e modelo/dimensão do embedding).
- **Reprocessar**: fontes `url`/`file`/`text` podem ser reingeridas sem recriar a fonte.

## Arquitetura

- **Rotas**: `/knowledge-bases` (CRUD de bases), `/knowledge-bases/:id/sources` (fontes),
  `/knowledge-bases/:id/query` (playground), `/knowledge-bases/:id/sources/:sourceId/chunks`
  (inspeção). Todas exigem permissão `knowledgeBases:read`|`knowledgeBases:manage`.
- **Tabelas**: `KnowledgeBases`, `KnowledgeBaseSources` (GORM), `KBChunk` (DDL raw,
  `internal/knowledge/schema.go` — não é modelo GORM).
- **Engine RAG**: nativa no core Go (`internal/knowledge/`), embarcada no binário
  `watink-business` — sem microsserviço separado. Ver
  [`docs/agents/knowledge-base.md`](../../agents/knowledge-base.md) para o desenho
  completo do pipeline (fetch/parse/chunk/embed/store) e ADR 0028.
