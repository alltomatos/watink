"""Worker de ingestão (consome jobs AMQP, processa, publica status).

Fase 1: fonte `text`. Fluxo: chunk -> embed -> store KBChunk -> status.
Idempotente por fonte (apaga chunks antigos antes de inserir); dedup por hash.
"""

import hashlib
import json
import logging

import aio_pika
from pgvector import HalfVector
from pgvector.psycopg import register_vector_async

from . import firecrawl, parsers, s3client
from .chunker import chunk_text
from .config import config
from .db import get_pool
from .embedding import EmbeddingError, embed_texts

log = logging.getLogger("ingest")

JOBS_EXCHANGE = "knowledge.jobs"
EVENTS_EXCHANGE = "knowledge.events"
INGEST_QUEUE = "knowledge.ingest"


async def _publish_status(events_ex, tenant_id, source_id, status, chunk_count=0, error=None):
    body = json.dumps(
        {"sourceId": source_id, "status": status, "chunkCount": chunk_count, "error": error}
    ).encode()
    await events_ex.publish(
        aio_pika.Message(body=body, content_type="application/json"),
        routing_key=f"knowledge.{tenant_id}.status",
    )


async def _store_chunks(tenant_id, kb_id, source_id, chunks, vectors, model):
    pool = get_pool()
    async with pool.connection() as conn:
        await register_vector_async(conn)
        async with conn.cursor() as cur:
            # Lock por sourceId (xact-scoped, liberado no commit): serializa o
            # DELETE+INSERT de refreshes concorrentes da MESMA fonte (re-ingest /
            # retry com prefetch_count=4). Sem ele, sob READ COMMITTED dois jobs
            # intercalam DELETE/INSERT e corrompem a base (chunks órfãos / perda /
            # contagem errada). Implementa o invariante "lock por sourceId".
            await cur.execute(
                "SELECT pg_advisory_xact_lock(hashtext(%s))",
                (f"{tenant_id}:{source_id}",),
            )
            # Idempotente: re-ingest apaga os chunks antigos da fonte.
            await cur.execute(
                'DELETE FROM "KBChunk" WHERE "tenantId" = %s AND "sourceId" = %s',
                (tenant_id, source_id),
            )
            # Insert em LOTE (executemany) em vez de N execute() serializados —
            # um documento grande gera dezenas/centenas de chunks; um execute por
            # chunk multiplicava os round-trips ao banco e prendia a conexão do
            # pool por mais tempo (re-ingest repetia o custo inteiro).
            rows = [
                (
                    tenant_id,
                    kb_id,
                    source_id,
                    content,
                    hashlib.sha256(content.encode("utf-8")).hexdigest(),
                    HalfVector(vec),
                    model,
                    len(vec),
                    i,
                )
                for i, (content, vec) in enumerate(zip(chunks, vectors))
            ]
            if rows:
                await cur.executemany(
                    '''
                    INSERT INTO "KBChunk"
                        ("tenantId","knowledgeBaseId","sourceId",content,"contentHash",embedding,model,dim,ordinal)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT ("tenantId","knowledgeBaseId","sourceId","contentHash") DO NOTHING
                    ''',
                    rows,
                )
        await conn.commit()


async def _handle(message: aio_pika.IncomingMessage, events_ex):
    async with message.process(requeue=False):
        try:
            job = json.loads(message.body)
        except Exception:
            log.exception("job inválido (json)")
            return

        tenant_id = job.get("tenantId")
        kb_id = job.get("knowledgeBaseId")
        source_id = job.get("sourceId")
        stype = job.get("type")
        payload = job.get("payload") or {}

        if not (tenant_id and kb_id and source_id):
            log.error("job sem tenantId/knowledgeBaseId/sourceId: %s", job)
            return

        # Defesa em profundidade na ESCRITA: a routing key (knowledge.<tenant>.ingest,
        # bind knowledge.*.ingest) é a autoridade do tenant. Rejeita se o tenantId do
        # corpo divergir — evita que um publicador (credencial AMQP vazada, segundo
        # publicador ou bug) grave/apague chunks no namespace de outro tenant
        # escolhendo o tenantId no corpo. RLS é INERTE aqui, então o corpo seria a
        # única autoridade sem esta checagem.
        rk_parts = message.routing_key.split(".") if message.routing_key else []
        rk_tenant = rk_parts[1] if len(rk_parts) >= 3 else None
        if rk_tenant and rk_tenant != tenant_id:
            log.error(
                "tenantId do corpo (%s) diverge da routing key (%s) — job rejeitado",
                tenant_id,
                rk_tenant,
            )
            return

        try:
            await _publish_status(events_ex, tenant_id, source_id, "processing")

            if stype == "text":
                raw = payload.get("text", "")
            elif stype == "file":
                object_key = payload.get("objectKey")
                file_name = payload.get("fileName", "")
                if not object_key:
                    raise RuntimeError("job de arquivo sem objectKey")
                data = s3client.download_bytes(object_key)
                raw = parsers.extract_text(file_name, data)
            elif stype == "url":
                target = payload.get("url", "")
                if not target:
                    raise RuntimeError("job de url sem url")
                raw = await firecrawl.scrape_markdown(target)
            else:
                raise RuntimeError(f"tipo de fonte '{stype}' ainda não suportado")

            chunks = chunk_text(raw)
            if not chunks:
                await _publish_status(
                    events_ex, tenant_id, source_id, "error", error="sem texto extraível"
                )
                return

            vectors, model = await embed_texts(tenant_id, chunks)
            await _store_chunks(tenant_id, kb_id, source_id, chunks, vectors, model)
            await _publish_status(events_ex, tenant_id, source_id, "ready", chunk_count=len(chunks))
            log.info("fonte %s ingerida: %d chunks (%s)", source_id, len(chunks), model)

        except firecrawl.FirecrawlError as e:
            log.warning("firecrawl falhou na fonte %s: %s", source_id, e)
            await _publish_status(events_ex, tenant_id, source_id, "error", error=str(e)[:300])
        except EmbeddingError as e:
            log.warning("embedding falhou na fonte %s: %s", source_id, e)
            await _publish_status(events_ex, tenant_id, source_id, "error", error=str(e)[:300])
        except Exception as e:
            log.exception("ingestão falhou na fonte %s", source_id)
            await _publish_status(events_ex, tenant_id, source_id, "error", error=str(e)[:300])


async def start_consumer() -> aio_pika.RobustConnection:
    conn = await aio_pika.connect_robust(config.AMQP_URL)
    channel = await conn.channel()
    await channel.set_qos(prefetch_count=4)

    jobs_ex = await channel.declare_exchange(JOBS_EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
    events_ex = await channel.declare_exchange(EVENTS_EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)

    queue = await channel.declare_queue(INGEST_QUEUE, durable=True)
    await queue.bind(jobs_ex, routing_key="knowledge.*.ingest")

    await queue.consume(lambda m: _handle(m, events_ex))
    log.info("consumer de ingestão ativo (queue=%s)", INGEST_QUEUE)
    return conn
