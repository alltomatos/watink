# ADR 0015 — pgvector como Vector Store do Nó `knowledge` (RAG)

**Status:** Accepted  
**Data:** 2026-06-27

## Atualização — 2026-06-28 (supersede parcial)

A mentoria de design da Base de Conhecimento revisou três pontos desta ADR. O núcleo (pgvector como vector store, guardrails, threshold/handoff, isolamento por `WHERE tenantId` manual, gate `aiKnowledgeEnabled`, `ERR_EMBEDDING_DIM_MISMATCH`) **permanece**. Mudam:

- **Onde o RAG roda:** não mais no worker Go do FlowBuilder, e sim no microsserviço **`watink-knowledge`** (Python/FastAPI) — ver **ADR 0018**. pgvector segue como store no mesmo Postgres.
- **Embedding via omniroute (gateway), não OpenAI direto:** o modelo é a setting `aiEmbeddingModel` roteada pelo gateway do tenant (Configurações → Agente de IA). MVP: `openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free`.
- **`halfvec(2048)` em vez de `vector(1536)`:** o modelo do MVP produz **2048 dims**, acima do limite de 2000 do tipo `vector` para HNSW. A coluna passa a `halfvec(2048)` + índice `hnsw (embedding halfvec_cosine_ops)` (pgvector ≥ 0.7; instalado 0.8.2). `halfvec` (float16) ocupa metade do storage com perda de recall desprezível.
- **Dimensão global única, não per-tenant:** o "per-tenant `aiEmbeddingModel` com dimensões livres" é **retirado** — `pgvector` não indexa dimensões mistas no mesmo índice. Há **um modelo/dimensão global**; `model`+`dim` são gravados em cada KBChunk para tornar uma futura troca um re-embed por base, não um redesenho.

> As menções abaixo a `vector(1536)`/`text-embedding-3-small`/`vector_cosine_ops`/per-tenant embedding ficam como **registro histórico** — valem as decisões desta seção de Atualização.

## Atualização — 2026-08-02 (ADR 0028)

O **ADR 0028** internaliza o RAG no core Go, superando o ADR 0018 (onde o RAG passou a rodar). O schema pgvector desta ADR **permanece em vigor**, com dois ajustes:

- `KBChunk` ganha **FK real com `ON DELETE CASCADE`** para `KnowledgeBases`/`KnowledgeBaseSources` — a ausência de FK permitia chunks órfãos sobreviverem à deleção da fonte/base e continuarem sendo citados.
- `KBChunk` ganha coluna `metadata JSONB` (heading/ordinal do chunk), para citações mais precisas que "fonte N".
- O retrieval passa a usar `SET LOCAL hnsw.iterative_scan` e over-fetch com filtro de `minScore` **antes** do corte final — correção de um bug de recall onde o filtro de tenant descartava candidatos após a varredura do índice HNSW.

## Contexto
A Fase 2 do FlowBuilder introduz o nó `knowledge`: dado um turno do contato, o runtime recupera trechos relevantes de uma base de conhecimento do tenant e responde via LLM ancorado nesses trechos (RAG — retrieval-augmented generation). Isso exige um *vector store* tenant-scoped onde os documentos do tenant são fatiados em chunks, embeddados e indexados para busca por similaridade semântica.

O Watink já roda PostgreSQL como banco primário, com multitenancy por RLS (ADR 0001) e o padrão de LLM-via-settings-do-tenant consolidado no `PipelineController.AISuggest`. Introduzir um serviço de vetores dedicado (Pinecone, Weaviate, Qdrant) significaria operar mais um datastore, replicar o isolamento por tenant fora do RLS e sincronizar dois bancos. Ao mesmo tempo, uma base de conhecimento sem ancoragem rígida leva a alucinação — o LLM "preenche lacunas" com conhecimento paramétrico e responde com confiança coisas que não estão na base do tenant, o que é inaceitável em atendimento automatizado.

Três decisões precisam ser fixadas antes de qualquer código de retrieval: (1) onde os vetores vivem e como são indexados; (2) que dimensão/modelo de embedding o sistema aceita, e como evitar misturar dimensões incompatíveis na mesma coluna; (3) que guardrails impedem o LLM de responder fora do contexto recuperado.

## Decisão
Usar **pgvector** (extensão do PostgreSQL já em uso) como vector store do nó `knowledge`, sem datastore adicional. Os chunks e seus embeddings vivem em tabela tenant-scoped sob o mesmo RLS do resto do produto.

- **Dimensão fixa 1536 / `text-embedding-3-small`:** a coluna `embedding vector(1536)` é fixada no schema, espelhando a saída do modelo de embedding padrão `text-embedding-3-small`. A dimensão é parte do contrato da tabela, não um parâmetro de runtime — uma coluna `vector(N)` só pode conter vetores de dimensão `N`.
- **Índice HNSW com distância cosseno:** índice `hnsw (embedding vector_cosine_ops)` para *approximate nearest neighbor*. HNSW dá recall alto com latência baixa sem precisar de `lists`/`probes` calibrados por volume (como o IVFFlat), e cosseno é a métrica natural para embeddings da OpenAI (normalizados). Retrieval é sempre filtrado por `WHERE tenantId = ?` **antes** do ORDER BY por similaridade — RLS não substitui o filtro manual no worker (ver Invariantes do FlowBuilder; RLS é inerte porque a app nunca faz `SET app.current_tenant`).
- **Threshold de confiança:** o retrieval aplica um corte de similaridade mínima (distância cosseno máxima). Se nenhum chunk passa do threshold, o nó **não** chama o LLM para "tentar mesmo assim" — entra no caminho de baixa confiança (handoff humano). O threshold é configurável por tenant com default conservador.
- **Guardrails obrigatórios no prompt do nó:**
  - **Responder só do contexto:** o system prompt instrui o LLM a responder *exclusivamente* a partir dos chunks recuperados e a declarar explicitamente quando a base não cobre a pergunta — proibido completar com conhecimento paramétrico.
  - **Citação obrigatória:** toda afirmação na resposta referencia o(s) chunk(s) de origem (id/título do documento). Resposta sem fonte recuperada é tratada como baixa confiança.
  - **Handoff humano em baixa confiança:** abaixo do threshold, ou quando o LLM declara não-cobertura, o FlowRun transiciona para atendimento humano em vez de emitir resposta gerada.
- **`aiEmbeddingModel` por-tenant com validação de dimensão:** o modelo de embedding é uma setting por tenant (`aiEmbeddingModel`), permitindo override do default. Na ingestão/embedding, a dimensão do vetor produzido é validada contra a dimensão da coluna; divergência é rejeitada com o erro **`ERR_EMBEDDING_DIM_MISMATCH`** (ex.: tenant aponta um modelo de 3072 dimensões para uma coluna `vector(1536)`). A validação acontece **antes** do INSERT — nunca se persiste vetor de dimensão incompatível, e a base de um tenant nunca mistura dimensões.
- **Gate `aiKnowledgeEnabled`:** o nó `knowledge` e o retrieval só operam quando a setting `aiKnowledgeEnabled = "true"` do tenant está ativa, **espelhando exatamente** o padrão de `aiPipelineEnabled` (mesma forma de leitura, mesma semântica de gate por tenant). Com o gate desligado, o nó é no-op/erro de validação no flow, e nenhuma chamada de embedding/LLM é feita.

LLM e embedding são sempre invocados via settings do tenant (mesmo caminho do `PipelineController.AISuggest`) — nunca com credencial global hardcoded.

## Alternativas consideradas
- **Vector store dedicado (Pinecone / Weaviate / Qdrant):** melhor escala horizontal e features de filtragem/híbrido prontas, mas adiciona um datastore para operar, exige reimplementar o isolamento por tenant fora do RLS e sincronizar dois bancos. Over-engineering para o volume atual, e fere o princípio de manter o Postgres como fonte única.
- **Dimensão/modelo configurável livremente por coluna dinâmica:** flexível, mas `pgvector` exige dimensão fixa na coluna; suportar N dimensões implicaria múltiplas colunas/tabelas ou `vector` sem dimensão (sem índice HNSW utilizável). Fixar 1536 + validar com `ERR_EMBEDDING_DIM_MISMATCH` é mais simples e seguro. Trocar a dimensão padrão no futuro é uma migração explícita, não um toggle de runtime.
- **Índice IVFFlat em vez de HNSW:** menor uso de memória e build mais rápido, mas exige calibrar `lists` por volume e `probes` por query para um recall comparável, e degrada com dados pequenos/crescimento incremental — atrito operacional desnecessário no estágio atual.
- **`text-embedding-3-large` (3072) como default:** recall marginalmente melhor, mas 2× o custo de storage/índice e de chamada de embedding, sem ganho que justifique no escopo de atendimento. Continua disponível por tenant via `aiEmbeddingModel` — desde que a coluna correspondente exista.
- **RAG sem threshold/guardrails (deixar o LLM "se virar"):** mais cobertura aparente, mas é exatamente o caminho da alucinação confiante — inaceitável em resposta automática ao cliente. O custo de um handoff a mais é menor que o de uma resposta errada apresentada como verdade.

## Consequências
- **Zero datastore novo:** vetores herdam backup, RLS (ADR 0001), migrations e observabilidade já existentes do Postgres; a operação não cresce em superfície.
- **Isolamento por tenant é responsabilidade do worker:** como em todo o FlowBuilder, o retrieval **deve** carregar `WHERE tenantId = ?` explicitamente — RLS não cobre o worker. Esquecer o filtro vaza conhecimento entre tenants; é item obrigatório de review e de teste.
- **Dimensão é um contrato de schema:** mudar o modelo de embedding default no futuro é uma migração de coluna + reembedding de toda a base, não um flag. O erro `ERR_EMBEDDING_DIM_MISMATCH` torna a violação ruidosa e barata de diagnosticar em vez de corromper silenciosamente o índice.
- **Resposta ancorada e auditável:** citação obrigatória dá rastreabilidade (qual documento gerou qual resposta) e o threshold + handoff garantem que a ausência de conhecimento vira escalonamento humano, não invenção.
- **`aiKnowledgeEnabled` segue `aiPipelineEnabled`:** consistência de padrão reduz carga cognitiva — quem conhece o gate de IA do Pipeline já entende o de Knowledge; ambos são leitura de setting por tenant com a mesma semântica.
- **Custo previsível:** embeddings 1536 com `text-embedding-3-small` mantêm storage/índice/custo de API moderados; HNSW troca um pouco de memória por latência de busca baixa, adequado para o caminho síncrono de um turno de conversa.
- **Limite conhecido:** HNSW é ANN (aproximado) — recall não é 100% por construção. Aceitável para retrieval semântico; combinado com o threshold, falsos-negativos caem no handoff em vez de gerar resposta ruim. Busca híbrida (lexical + vetorial) fica como evolução futura, fora do escopo da Fase 2.
