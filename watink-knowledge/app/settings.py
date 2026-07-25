"""Leitura das settings de IA do tenant (omniroute) da tabela Settings.

Tenant-scoped por `WHERE "tenantId"` manual (RLS é inerte para este serviço).
"""

from .config import config
from .db import get_pool
from .urls import rewrite_host

_AI_KEYS = [
    "aiCustomBaseURL",
    "aiEmbeddingBaseURL",
    "aiApiKey",
    "aiEmbeddingApiKey",
    "aiEmbeddingModel",
    "aiModel",
    "aiProvider",
]


async def get_ai_settings(tenant_id: str) -> dict:
    pool = get_pool()
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            'SELECT key, value FROM "Settings" WHERE "tenantId" = %s AND key = ANY(%s)',
            (tenant_id, _AI_KEYS),
        )
        rows = await cur.fetchall()
    s = {k: v for k, v in rows}

    # Em dev o omniroute roda no host (localhost:20128); de dentro do container
    # isso precisa virar host.docker.internal.
    base_url = rewrite_host(s.get("aiCustomBaseURL", "") or "", config.OMNIROUTE_HOST_REWRITE)

    # Endpoint DEDICADO de embedding (opcional). Permite apontar o embedding para
    # um provedor diferente do chat — ex.: um Ollama self-hosted (CPU) em
    # http://ollama:11434/v1 — enquanto o chat continua no omniroute. Vazio =
    # usa o mesmo base_url do chat (comportamento padrão).
    embedding_base_url = rewrite_host(
        s.get("aiEmbeddingBaseURL", "") or "", config.OMNIROUTE_HOST_REWRITE
    )

    api_key = s.get("aiApiKey", "") or ""
    return {
        "base_url": base_url,
        "embedding_base_url": embedding_base_url or base_url,
        "api_key": api_key,
        # Chave dedicada do embedding (opcional). Vazia → reusa a chave do chat.
        "embedding_api_key": (s.get("aiEmbeddingApiKey", "") or "") or api_key,
        "model": s.get("aiEmbeddingModel", "") or "",
        "chat_model": s.get("aiModel", "") or "",
        "provider": s.get("aiProvider", "") or "",
    }
