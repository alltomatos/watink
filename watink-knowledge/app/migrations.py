"""Migrations idempotentes do watink-knowledge.

O serviço é dono do schema de RAG: a extensão `vector` e a tabela `KBChunk`
(`halfvec` + HNSW). Roda no startup (lifespan). RLS é inerte aqui — o isolamento
por tenant é por `WHERE "tenantId"` manual nas queries do serviço.
"""

from .config import config
from .db import get_pool


def _ddl() -> list[str]:
    dim = config.EMBED_DIM
    return [
        "CREATE EXTENSION IF NOT EXISTS vector",
        f'''
        CREATE TABLE IF NOT EXISTS "KBChunk" (
            id                BIGSERIAL PRIMARY KEY,
            "tenantId"        UUID NOT NULL,
            "knowledgeBaseId" INTEGER NOT NULL,
            "sourceId"        INTEGER NOT NULL,
            content           TEXT NOT NULL,
            "contentHash"     TEXT NOT NULL,
            embedding         halfvec({dim}) NOT NULL,
            model             TEXT NOT NULL,
            dim               INTEGER NOT NULL,
            ordinal           INTEGER NOT NULL DEFAULT 0,
            "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        ''',
        'CREATE INDEX IF NOT EXISTS kbchunk_tenant_kb_idx ON "KBChunk" ("tenantId", "knowledgeBaseId")',
        'CREATE INDEX IF NOT EXISTS kbchunk_source_idx ON "KBChunk" ("sourceId")',
        ('CREATE UNIQUE INDEX IF NOT EXISTS kbchunk_dedup_idx '
         'ON "KBChunk" ("tenantId", "knowledgeBaseId", "sourceId", "contentHash")'),
        ('CREATE INDEX IF NOT EXISTS kbchunk_embedding_hnsw '
         'ON "KBChunk" USING hnsw (embedding halfvec_cosine_ops)'),
    ]


async def run_migrations() -> None:
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            for stmt in _ddl():
                await cur.execute(stmt)
        await conn.commit()
