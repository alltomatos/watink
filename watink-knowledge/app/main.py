import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import ingest
from .agent import router as agent_router
from .db import close_pool, get_pool, open_pool
from .migrations import run_migrations
from .retrieve import router as retrieve_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("main")

_consumer_conn = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    await open_pool()
    await run_migrations()
    global _consumer_conn
    _consumer_conn = await ingest.start_consumer()
    log.info("watink-knowledge pronto")
    yield
    if _consumer_conn is not None:
        await _consumer_conn.close()
    await close_pool()


app = FastAPI(title="watink-knowledge", lifespan=lifespan)
app.include_router(retrieve_router)
app.include_router(agent_router)


@app.get("/health")
async def health():
    pool = get_pool()
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute("SELECT 1")
        await cur.fetchone()
    return {"status": "ok", "service": "watink-knowledge"}
