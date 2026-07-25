"""Endpoint de retrieval RAG (HTTP interno, chamado pelo business) + a função
`retrieve_chunks` reutilizada pelo Agent Runtime."""

from fastapi import APIRouter, Depends, HTTPException
from pgvector import HalfVector
from pgvector.psycopg import register_vector_async
from pydantic import BaseModel

from .auth import require_internal_token
from .db import get_pool
from .embedding import EmbeddingError, embed_texts


async def retrieve_chunks(
    tenant_id: str, kb_id: int, query: str, top_k: int = 6, min_score: float = 0.2
) -> list[dict]:
    """Recupera os top-K chunks da base por similaridade vetorial, tenant+kb scoped.

    Levanta EmbeddingError se o embedding da query falhar.
    """
    vectors, _ = await embed_texts(tenant_id, [query])
    qvec = HalfVector(vectors[0])

    pool = get_pool()
    async with pool.connection() as conn:
        await register_vector_async(conn)
        async with conn.cursor() as cur:
            await cur.execute(
                '''
                SELECT content, "sourceId", 1 - (embedding <=> %s) AS score
                FROM "KBChunk"
                WHERE "tenantId" = %s AND "knowledgeBaseId" = %s
                ORDER BY embedding <=> %s
                LIMIT %s
                ''',
                (qvec, tenant_id, kb_id, qvec, top_k),
            )
            rows = await cur.fetchall()

    chunks: list[dict] = []
    for content, source_id, score in rows:
        score = float(score)
        if score < min_score:
            continue
        chunks.append(
            {
                "text": content,
                "sourceId": source_id,
                "score": score,
                "citation": f"source:{source_id}",
            }
        )
    return chunks


router = APIRouter()


class RetrieveRequest(BaseModel):
    tenantId: str
    knowledgeBaseId: int
    query: str
    topK: int = 6
    # Piso de relevância (reforço server-side do guardrail). O business envia o
    # valor real (default 0.2 ou setting aiKnowledgeMinScore); este default cobre
    # chamadores que omitam o campo, evitando o antigo 0.0 que desativava o filtro.
    minScore: float = 0.2


@router.post("/retrieve", dependencies=[Depends(require_internal_token)])
async def retrieve(req: RetrieveRequest) -> dict:
    try:
        chunks = await retrieve_chunks(
            req.tenantId, req.knowledgeBaseId, req.query, req.topK, req.minScore
        )
    except EmbeddingError as e:
        raise HTTPException(status_code=400, detail=f"embedding indisponível: {e}")
    return {"chunks": chunks}
