# ADR 0028 — RAG nativo em Go, internalizado no `business` (supera ADR 0018)

**Status:** Accepted
**Data:** 2026-08-02
**Supera:** ADR 0018 (Microsserviço `watink-knowledge`)
**Atualiza:** ADR 0015 (pgvector RAG), ADR 0020 (Agent Runtime)

## Contexto

O ADR 0018 extraiu a Base de Conhecimento para um microsserviço Python (`watink-knowledge`, FastAPI) citando dois motivos centrais: parsing de PDF/DOCX é fraco em Go, e o ecossistema Go de agente/RAG (`langchaingo`) era imaturo à época. Na prática, esse desenho gerou uma classe de falhas estrutural, não incidental:

- O worker de ingestão AMQP rodava **no mesmo processo e event loop** do servidor HTTP (`uvicorn` single-worker). Qualquer ingestão em andamento (parsing de PDF, chunking, chamadas de embedding) bloqueava `/retrieve` até o cliente Go estourar o timeout de 30s — a causa raiz de respostas fantasma e "RAG instável" relatadas em produção.
- Scraping via Firecrawl self-hosted (5 containers, ~8GB RAM) sem retry e com timeout curto — qualquer 5xx/timeout transitório derrubava a fonte para `error` na primeira tentativa.
- `PublishKnowledgeJob` fire-and-forget, sem publisher confirms, sem DLQ do lado do consumidor Python — jobs se perdiam silenciosamente quando o RabbitMQ ou o próprio serviço estavam fora do ar, deixando fontes presas em `pending`/`processing` para sempre.
- Filtro de tenant aplicado **depois** da varredura do índice HNSW e `minScore` aplicado **depois** do `LIMIT` — degradava o recall de forma silenciosa: a pergunta certa muitas vezes não encontrava o chunk certo.
- Deletar uma fonte ou base nunca apagava os `KBChunk` correspondentes (sem FK) — chunks órfãos continuavam sendo recuperados e citados indefinidamente.
- `EMBED_DIM` fixo em 2048 globalmente — um tenant configurando um modelo de 1536 dimensões (ex. `text-embedding-3-small`) tinha 100% das ingestões falhando.
- **O serviço nunca existiu em produção**: `docker-compose.prod.yml` nunca incluiu `watink-knowledge`, Firecrawl ou MinIO, e nenhum workflow de CI publicava a imagem — só existia `Dockerfile.dev` (`uvicorn --reload`).

Em paralelo, dois repositórios externos foram avaliados como possível base de reaproveitamento (`PixelRAG`, RAG pixel-nativo com VLM+GPU; `RAG-Anything`, framework multimodal sobre grafo de conhecimento com custo de indexação por LLM-call). Nenhum dos dois serve como base direta para um SaaS de atendimento WhatsApp em VPS modesta — o veredito e as ideias pontuais aproveitadas (hash de conteúdo para reindexação incremental, falha isolada por documento, estado por documento como cidadão de primeira classe) estão registrados na exploração que precedeu este ADR.

O motivo original do ADR 0018 (parsing de PDF fraco em Go) permanece parcialmente verdadeiro — não há OCR nativo maduro em Go — mas deixou de ser o fator decisivo: o **custo estrutural de manter dois processos, duas fronteiras de confiança e um event loop compartilhado** provou-se maior que o ganho de usar bibliotecas Python de parsing.

## Decisão

Internalizar o RAG inteiro no core Go (`business/internal/knowledge/`), eliminando o microsserviço Python `watink-knowledge` e o stack Firecrawl self-hosted.

- **Todo o consumo já passava por duas interfaces pequenas** (`flow.Retriever`, `flow.AgentResponder`) — a internalização trocou a implementação por trás delas (`HTTPRetriever`→`PgVectorRetriever`, `HTTPAgentClient`→`GoAgentResponder`) sem exigir mudança em `knowledge_executor.go`, `agent_executor.go`, `assistant_persona.go`, no playground ou no frontend.
- **Scraping**: HTTP GET nativo com retry+backoff exponencial e extração de conteúdo via `go-readability`, substituindo o Firecrawl self-hosted. SSRF guard obrigatório (resolve DNS, recusa IP privado/loopback/link-local/metadados de cloud) — proteção que não existia antes. Crawl same-domain via sitemap ou BFS, limite conservador. Headless/browserless fica **fora da v1**: texto vazio/curto falha com mensagem honesta, em vez de indexar lixo ou travar; a interface de fetch aceita um segundo `Fetcher` de fallback no futuro sem reescrever o pipeline.
- **Parsing**: pure Go — `ledongthuc/pdf` para PDF (sem OCR, limitação aceita e documentada), XML puro (stdlib) para DOCX (cobre tabelas, ganho sobre o parser Python que só lia parágrafos), `excelize` para XLSX, stdlib para CSV/TXT/MD. Decisão de infraestrutura que fecha a porta ao shell-out: a imagem `business` é `gcr.io/distroless/static-debian12` — sem shell, sem `apt`, sem `pdftotext`/poppler disponível.
- **Chunking**: estrutural (headings markdown + parágrafos, com overlap), substituindo a janela cega de tokens do serviço Python. Sem tokenizador exato — aproximação por caracteres (~4 chars/token), aceitável porque o teto real é do provedor de embedding, não uma regra de negócio rígida.
- **Ingestão**: worker Go consumindo a mesma fila AMQP (`knowledge.jobs`/`knowledge.ingest`), agora com DLQ (a fila nunca teve DLQ do lado consumidor Python), publisher confirms na publicação do job, falha isolada por documento, hash de conteúdo por fonte evitando reembedding desnecessário, e um reconciler cron (leader-lock Redis) marcando `error` fontes presas além de um TTL.
- **Retrieval**: corrige os dois bugs de recall — `minScore` filtrado **antes** do corte final (over-fetch + filtro, não filtro pós-`LIMIT`) e `SET LOCAL hnsw.iterative_scan` para o filtro de tenant não starvar o índice HNSW. Filtra por `model` vigente do tenant, evitando misturar embeddings de gerações diferentes.
- **Schema**: `KBChunk` ganha FK real (`ON DELETE CASCADE`) para `KnowledgeBases`/`KnowledgeBaseSources` — deletar fonte ou base remove os vetores automaticamente. Coluna `metadata` (JSONB) para heading/ordinal, citações melhores que "fonte N".
- **Agent Runtime**: `GoAgentResponder` porta `agent.py` linha por linha (mesmo protocolo `[[ACTION:continue|resolved|handoff]]`, mesmos guardrails), usando `pkg/aiclient` em vez de duplicar cliente LLM — elimina a divergência de defaults entre a implementação Go e a Python.
- **Transição controlada**: env `KNOWLEDGE_MODE=native|http` (default `http`, preservando o comportamento atual), construída uma única vez em `main.go` e propagada para os dois `flow.Skeleton` existentes (mensagens reais do WhatsApp via `EventListener`, e endpoints on-demand/playground via `routes.go`), para as duas entradas nunca divergirem sobre qual implementação responde. Rollback trivial: troca de env, sem redeploy de código.

## Alternativas consideradas

- **Manter o microsserviço Python e só corrigir os bugs pontuais** (event loop, DLQ, retry, recall): resolveria os sintomas, mas manteria a fronteira HTTP interna, a duplicação de "cliente LLM do tenant" e o fato de o serviço nunca ter existido em produção. Rejeitada por não atacar a causa estrutural.
- **Adotar PixelRAG como base**: paradigma incompatível (RAG pixel-nativo com VLM+GPU) e a peça que resolveria o problema real (scraping robusto) é um stub deliberado no projeto original. Descartado — ver exploração registrada na sessão que originou este ADR.
- **Adotar RAG-Anything/LightRAG**: custo de indexação imprevisível (1+ chamada de LLM por chunk), dependências pesadas (MinerU, LibreOffice, Apache AGE), sem modelo de multitenancy. Inviável numa VPS modesta com custo de indexação previsível.
- **Headless Chrome nativo desde a v1**: resolveria sites JS-heavy, mas adiciona peso de infra (Chromium) exatamente na classe de problema (recursos de VPS) que motivou o redesenho. Adiada para uma fase incremental, com a interface de fetch já desenhada para aceitá-la como fallback.

## Consequências

- **Elimina a fronteira HTTP interna** (`INTERNAL_TOKEN`, `KNOWLEDGE_SERVICE_URL`) e a superfície de confiança que ela exigia.
- **Elimina a duplicação de "cliente LLM do tenant"** — uma implementação (`pkg/aiclient`), não duas com defaults divergentes.
- **RAG passa a existir em produção "de graça"** por estar embarcado no binário `watink-business` — mas isso expôs uma lacuna real e independente: `docker-compose.prod.yml` não tinha MinIO/S3 configurado, então upload de arquivo ficava quebrado em produção mesmo antes deste redesenho. Corrigido junto (Epic de descomissionamento).
- **Ganho de simplicidade operacional**: um processo a menos para monitorar, deployar e escalar; sem Firecrawl (5 containers, ~8GB RAM).
- **Débito aceito conscientemente**: sem OCR (PDF escaneado falha com mensagem clara), sem headless na v1 (site JS-heavy falha com mensagem clara), sem tokenizador exato no chunking (aproximação por caracteres). Nenhum desses é silencioso — todos falham de forma visível, ao contrário do comportamento anterior (`ready` com 0 chunks úteis).
- **`aiApiKey`/`aiEmbeddingApiKey` continuam em texto plano** na tabela `Settings` — débito pré-existente do módulo AI Settings, não introduzido nem resolvido por este ADR; registrado aqui para não ser esquecido.
