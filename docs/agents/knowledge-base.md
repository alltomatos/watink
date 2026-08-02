# Módulo: Base de Conhecimento (RAG)

## Responsabilidade

Ingestão e recuperação de conhecimento (RAG), **nativo no core Go** (`internal/knowledge/`,
ver ADR 0028 — supera o ADR 0018, que rodava isso num microsserviço Python separado).
Fontes (texto, arquivo, URL) são vetorizadas em `KBChunk` (pgvector) e consumidas pelos nós
`knowledge`/`agent` do FlowBuilder e pelo plugin Assistants (modo `persona`).

---

## Arquitetura

```
   frontend ──REST/SSE──> business (Go)
                          ├─ CRUD bases/fontes + UI + upload S3
                          ├─ publica AMQP knowledge.jobs → consome ele mesmo (IngestWorker)
                          ├─ retrieval/agent in-process (internal/knowledge)
                          └─ reconciler cron (fontes presas)
                                   │
                     PostgreSQL Watink (mesmo banco) ←──┘
                     KBChunk: halfvec HNSW cosine, FK cascade, WHERE tenantId manual
```

Um único processo, um único binário. Não há mais fronteira HTTP interna, não há mais
`INTERNAL_TOKEN`/`KNOWLEDGE_SERVICE_URL`, e o worker de ingestão não compete pelo mesmo
event loop do servidor HTTP (era a causa raiz das respostas fantasma no design anterior:
o worker Python bloqueava `/retrieve` durante qualquer ingestão pesada).

`internal/knowledge/`:

| Arquivo | Responsabilidade |
|---|---|
| `schema.go` | DDL idempotente de `KBChunk` (FK cascade, índices, HNSW) |
| `embed_client.go` | Cliente `/embeddings` — batch, retry 429+5xx, falha parcial preservada |
| `retriever.go` | `PgVectorRetriever` — implementa `flow.Retriever` |
| `agent.go` | `GoAgentResponder` — implementa `flow.AgentResponder` |
| `fetch_url.go` / `fetch_url_crawl.go` | HTTP fetch com SSRF guard+retry, extração via readability, crawl same-domain |
| `parse_pdf.go` / `parse_office.go` | Parsers pure Go (PDF/DOCX/XLSX/CSV/TXT/MD) |
| `chunk.go` | Chunking estrutural (heading/parágrafo + overlap) |
| `ingest_worker.go` | Consumer AMQP `knowledge.ingest`, orquestra fetch→parse→chunk→embed→store |
| `reconciler.go` | Cron (leader-lock Redis) marcando `error` fontes presas além de um TTL |
| `wiring.go` | `BuildRetrieverAndResponder(mode, db)` — o switch `KNOWLEDGE_MODE` |

### Modo de transição (`KNOWLEDGE_MODE`)

`KNOWLEDGE_MODE=native|http` (default `http` até a validação em produção terminar).
`native` usa as implementações acima; `http` mantém as chamadas ao antigo microsserviço
Python (em descomissionamento). A decisão é tomada **uma vez em `main.go`** e propagada
para os dois `flow.Skeleton` existentes — `EventListener` (mensagens reais do WhatsApp) e
`routes.go` (endpoints on-demand/playground) — via `Skeleton.SetRetriever`/`SetResponder`,
para as duas entradas nunca divergirem sobre qual implementação responde. Rollback é
trivial: troca de env, sem redeploy de código.

---

## Tipos de fonte

| `type` | Fetcher | Status |
|--------|---------|--------|
| `text` | payload direto, persistido em `KnowledgeBaseSources.rawContent` | ✅ |
| `file` | download do S3 → parse (pdf/docx/txt/csv/xlsx/md) | ✅ |
| `url`  | `FetchURL` (HTTP + readability), 1 página | ✅ |
| crawl de site | `CrawlSite` (sitemap ou BFS same-domain, limite de páginas/profundidade) | implementado, ainda não exposto na UI como opção de fonte |
| JS-heavy (headless) | — | fora da v1; texto vazio/curto falha com mensagem clara em vez de indexar lixo |
| `git` | — | não planejado |

### Fonte `url`

- `FetchURL` faz `GET` com retry+backoff exponencial (3 tentativas — diferente do design
  anterior, que não tinha retry nenhum) e extrai o conteúdo principal via `go-readability`
  (remove nav/rodapé/boilerplate).
- **SSRF guard obrigatório**: só `http`/`https`; resolve o DNS e recusa IP
  privado/loopback/link-local/metadados de cloud (`169.254.169.254`) **antes** de conectar.
  Essa validação não existia no design anterior — qualquer URL era aceita e raspada.
- Texto extraído menor que um limiar mínimo → erro `ERR_EMPTY_CONTENT` explícito ("site
  parece exigir JavaScript ou bloqueou o acesso"), nunca um sucesso vazio.

### Inspeção do conhecimento (read-only, human-in-the-loop)

- `GET /knowledge-bases/:id/sources/:sourceId/chunks` — lista os chunks de uma fonte (texto,
  ordinal, modelo/dimensão do embedding, hash). Lê `KBChunk` direto do Postgres, tenant-scoped
  manual; `KBChunk` continua fora do `AutoMigrate` (DDL raw em `schema.go`, mesmo padrão de
  `addCustomIndexes()`/PostGIS).
- `POST /knowledge-bases/:id/query` `{query, topK, minScore}` — playground de recuperação,
  chama `flow.Retriever.Retrieve` in-process (sem HTTP) e devolve os top-k chunks + score.
- Ambos via `KnowledgeInspectController`; o frontend nunca fala direto com `internal/knowledge`
  — sempre pelo `business` como gateway único.

---

## Modelo de dados

```go
type KnowledgeBase struct {
    ID, Name, Description string
    TenantID  uuid.UUID
    Sources   []KnowledgeBaseSource
}

type KnowledgeBaseSource struct {
    ID, KnowledgeBaseID, TenantID
    Type            string  // text|file|url
    URL, FileName   string  // ou objectKey (S3) / rawContent inline
    ObjectKey       string
    RawContent      string  // persistido para fontes "text" — habilita reingest real
    ContentHash     string  // hash do texto extraído; reingest pula reembedding se inalterado
    Status          string  // pending|processing|ready|error
    LastError       string
    ChunkCount      int     // contagem REAL de inserts pós ON CONFLICT, não len(chunks) pré-insert
    LastIngestedAt  *time.Time
    Updatable       bool    // campo existe; refresh agendado ainda não tem consumidor
    RefreshSchedule *string // idem
    NextRefreshAt   *time.Time
}

// KBChunk (mesmo Postgres; DDL em internal/knowledge/schema.go)
KBChunk {
    id, tenantId
    knowledgeBaseId REFERENCES KnowledgeBases(id) ON DELETE CASCADE
    sourceId        REFERENCES KnowledgeBaseSources(id) ON DELETE CASCADE
    content    text
    contentHash text          // dedup por chunk (UNIQUE tenantId+kbId+sourceId+contentHash)
    embedding  halfvec(2048)  // HNSW halfvec_cosine_ops
    model      text           // nome do modelo de embedding vigente no tenant
    dim        int
    ordinal    int
    metadata   jsonb          // {heading} — citação melhor que "fonte N"
}
```

`KBChunk` tem FK real com `ON DELETE CASCADE` — deletar uma fonte ou base remove os
vetores automaticamente (no design anterior, sem FK, chunks órfãos continuavam sendo
recuperados e citados indefinidamente).

---

## Lifecycle de ingestão

```
pending → processing → ready
              ↓           ↑
            error ──(botão "Tentar novamente" manual)

Fonte presa em pending/processing além de um TTL → reconciler marca error automaticamente.
```

Não há estado `fetching`/`stale` nem retry automático com backoff no lifecycle — eram
prometidos pela versão anterior desta doc e nunca chegaram a existir no código. O reconciler
(cron com leader-lock Redis) resolve o caso "fonte presa para sempre" sem precisar desses
estados extras.

---

## Contratos AMQP (inalterados na forma — mudou quem consome)

### Ingestão (`business` publica E consome — `internal/knowledge/ingest_worker.go`)
```
exchange: knowledge.jobs   routing: knowledge.<tenant>.ingest
{ tenantId, knowledgeBaseId, sourceId, type, payload: { text? | objectKey?+fileName? | url? } }
```
Fila `knowledge.ingest` agora tem **DLQ** do lado consumidor (o design anterior só tinha DLQ
no lado Go/publisher; o consumer Python nunca declarou uma). Publish deixou de ser
fire-and-forget: falha ao publicar marca a fonte `error` imediatamente, com `lastError`.

### Status (`knowledge.events`, publicado pelo próprio `IngestWorker` em modo `native`)
```
routing: knowledge.<tenant>.status
{ tenantId, sourceId, status, lastError, chunkCount }
→ KnowledgeStatusListener atualiza a Source + emite SSE (Broadcaster) p/ a UI.
```
Em modo `http`, o `KnowledgeStatusListener` continua consumindo os eventos publicados pelo
serviço Python legado — a UI não percebe diferença entre os dois modos.

### Retrieval / Agent (in-process em modo `native`; HTTP em modo `http`)

Os dois caminhos continuam expostos pelas mesmas interfaces Go (`flow.Retriever`,
`flow.AgentResponder`) — só a implementação por trás muda com `KNOWLEDGE_MODE`. Nenhum
consumidor (`knowledge_executor.go`, `agent_executor.go`, `assistant_persona.go`) precisa
saber qual modo está ativo.

O Agent Runtime (`GoAgentResponder`) preserva o protocolo do design anterior: o LLM emite a
`action` via tag de controle `[[ACTION:continue|resolved|handoff]]` (parseada e removida da
reply). Stateless por chamada — o estado (history, turn-taking, suspend/resume) vive no
`business` (`FlowRun`). Sem contexto recuperado → `handoff` (nunca alucina).

---

## Embedding

- Via gateway OpenAI-compatível do tenant (`aiEmbeddingBaseURL`/`aiEmbeddingApiKey`, com
  fallback para `aiCustomBaseURL`/`aiApiKey`), modelo na setting **`aiEmbeddingModel`**
  (Configurações → Agente de IA).
- **Dimensão não é mais fixa globalmente.** O design anterior travava `EMBED_DIM=2048`
  como constante — um tenant configurando um modelo de 1536 dimensões tinha 100% das
  ingestões falhando. Agora a dimensão é validada contra o que o gateway efetivamente
  retorna, por tenant.
- `model`+`dim` gravados em cada chunk; o retrieval filtra pelo `model` vigente do tenant,
  evitando misturar embeddings de gerações diferentes no mesmo resultado (troca de modelo
  sem re-ingerir não devolve mais ruído silencioso — os chunks antigos simplesmente não
  aparecem até a base ser reingerida).
- Retry em **429 e 5xx/timeout/erro de conexão** (o design anterior só retentava 429).
  Falha parcial de lote preserva os lotes já embedados anteriormente.

---

## S3 Storage Driver

- Abstração S3-compatível: MinIO (dev) → R2/AWS S3 (prod) sem trocar código.
- Config global de sistema (Configurações → Armazenamento S3, superadmin).
- Isolamento por subpasta `{tenantId}/{kbId}/{sourceId}/arquivo`.
- `business` faz upload **e agora também download** (`domain.ObjectStore.Download`,
  usado pelo `IngestWorker` para ler o arquivo antes de parsear).
- Upload tem cap de tamanho (`MaxBytesReader`, 50MB) — prometido pela doc anterior e nunca
  implementado; agora implementado.

---

## Multitenancy & Segurança

- `business` é o único ponto de entrada; não há mais fronteira HTTP interna a proteger com
  segredo compartilhado.
- **RLS é inerte** nas tabelas de knowledge (`KnowledgeBases`, `KnowledgeBaseSources`,
  `KBChunk`) — o worker sempre faz `WHERE "tenantId"` manual (mesmo padrão de `FlowRun`).
- Rotas `/knowledge-bases*` exigem `RequirePermission("knowledgeBases", "read"|"manage")` —
  antes não tinham gate nenhum, contrariando o invariante do ADR 0022.
- SSRF guard no fetch de URL (ver seção "Fonte `url`" acima).

---

## Consumidores

| | Comportamento | Status |
|---|---|---|
| **Knowledge node** | RAG de 1 turno (recupera → responde com guardrail/citação → avança) | ✅ implementado |
| **Agent node** | Agente multi-turno autônomo (Agent Runtime) | ✅ implementado |
| **Assistant persona** | Mesmo Agent Runtime, plugin "Assistentes de IA" | ✅ implementado |

---

## Edge cases

| Caso | Tratamento |
|---|---|
| Fetch/parse falha | fonte → `error` + `lastError` específico; falha isolada por job, não derruba o worker |
| Fonte presa em pending/processing | reconciler cron marca `error` após TTL |
| Publish do job falha | fonte marcada `error` imediatamente (publish deixou de ser fire-and-forget) |
| Rate-limit embedding (429) ou 5xx/timeout | retry com backoff exponencial+jitter |
| Reembedding de conteúdo inalterado | hash de conteúdo por fonte pula o passo — idempotência barata |
| PDF sem camada de texto (escaneado) | erro explícito (`ERR_EMPTY_PDF_TEXT`) — sem OCR na v1 |
| Site JS-heavy | erro explícito (`ERR_EMPTY_CONTENT`) — sem headless na v1 |
| Delete de fonte/KB | FK `ON DELETE CASCADE` remove os `KBChunk` — sem órfãos |
| Troca de modelo de embedding | `model` gravado por chunk; retrieval filtra pelo vigente, base antiga simplesmente não aparece até reingerir |
| Retrieval em KB vazia / `< minScore` | vazio → guardrail "não sei"/handoff |
| Vazamento entre tenants | `WHERE tenantId` manual + `SET LOCAL hnsw.iterative_scan` (tenant como pre-filter efetivo) |
| URL apontando para host interno | SSRF guard recusa antes de conectar |

---

## O que NÃO fazer

- Não confiar em RLS nas tabelas de knowledge — sempre `WHERE tenantId` manual.
- Não usar chave hardcoded para embedding — usar as settings do tenant.
- Não misturar dimensões no mesmo índice; `halfvec` é obrigatório para `dim > 2000`.
- Não descartar o arquivo/texto no upload — S3 para arquivo, `rawContent` para texto.
- Não responder fora do contexto nem omitir citação; baixa confiança → handoff.
- Não reintroduzir a fronteira HTTP interna nem duplicar o cliente LLM do tenant — um único
  `pkg/aiclient`, chamado direto por `internal/knowledge`.
- Não adicionar shell-out para `pdftotext`/poppler — a imagem `business` é distroless (sem
  shell). Parsing de PDF é pure Go, com a limitação de OCR aceita e documentada.
- Não indexar conteúdo vazio/curto como sucesso — falhar de forma visível é melhor que uma
  fonte "pronta" sem conteúdo útil.

---

## Referência

ADR 0028 (RAG nativo em Go, supera ADR 0018) · ADR 0015 (schema pgvector, atualizado) ·
ADR 0020 (Agent Runtime, atualizado) · ADR 0019 (S3 Storage Driver).
