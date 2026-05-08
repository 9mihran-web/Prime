from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class _ConnectionManager:
    """Manages active WebSocket connections keyed by user ID."""

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(user_id, []).append(ws)
        logger.info("WS connect: user=%s total=%d", user_id, len(self._connections[user_id]))

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(user_id, [])
        try:
            conns.remove(ws)
        except ValueError:
            pass
        if not conns:
            self._connections.pop(user_id, None)
        logger.info("WS disconnect: user=%s", user_id)

    async def send_json(self, user_id: str, data: dict) -> None:
        """Send a JSON message to all connections for *user_id*."""
        dead: list[WebSocket] = []
        for ws in self._connections.get(user_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast(self, data: dict) -> None:
        """Broadcast to every connected client."""
        for user_id in list(self._connections):
            await self.send_json(user_id, data)


ws_manager = _ConnectionManager()


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown logic."""
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)

    # Verify Redis connectivity
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.ping()
        await redis_client.aclose()
        logger.info("Redis connection OK: %s", settings.REDIS_URL)
    except Exception as exc:
        logger.warning("Redis not reachable at startup: %s", exc)

    # Optionally run Alembic migrations in debug mode
    if settings.DEBUG:
        try:
            from app.core.database import create_all_tables
            await create_all_tables()
            logger.info("Database tables ensured (DEBUG mode).")
        except Exception as exc:
            logger.warning("Could not create tables: %s", exc)

    yield

    # Shutdown
    from app.services.ai.openai_service import openai_service
    await openai_service.close()
    logger.info("%s shutdown complete.", settings.APP_NAME)


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "PRIME — next-generation AI assistant platform API. "
        "Provides endpoints for authentication, conversation management, "
        "AI chat (with streaming), agent execution, vector memory, and voice I/O."
    ),
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Simple request-timing + logging middleware
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.debug(
        "%s %s -> %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    response.headers["X-Process-Time"] = f"{duration_ms:.1f}ms"
    return response


# ---------------------------------------------------------------------------
# Rate limiting stub
# ---------------------------------------------------------------------------

# A production deployment should use slowapi or a reverse-proxy (nginx/Caddy)
# for rate limiting.  This middleware stub records per-IP request counts in
# Redis and returns 429 when the per-minute limit is exceeded.

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting for health checks
    if request.url.path in ("/health", "/"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    window_key = f"rl:{client_ip}:{int(time.time() // 60)}"

    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        count = await redis_client.incr(window_key)
        if count == 1:
            await redis_client.expire(window_key, 60)
        await redis_client.aclose()

        if count > settings.RATE_LIMIT_PER_MINUTE:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded. Please slow down."},
                headers={"Retry-After": "60"},
            )
    except Exception:
        # If Redis is unavailable, allow the request through
        pass

    return await call_next(request)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(api_router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# Core endpoints
# ---------------------------------------------------------------------------

@app.get("/health", tags=["system"], summary="Health check")
async def health_check() -> dict:
    """Returns service health status.

    Checks Redis connectivity and reports back.
    """
    redis_ok = False
    try:
        rc = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await rc.ping()
        await rc.aclose()
        redis_ok = True
    except Exception:
        pass

    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "redis": "ok" if redis_ok else "unavailable",
    }


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {"message": f"Welcome to {settings.APP_NAME} v{settings.APP_VERSION}"}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str) -> None:
    """Real-time bidirectional channel for a specific user.

    The client must pass a valid JWT as the ``token`` query parameter::

        ws://host/ws/{user_id}?token=<access_jwt>

    Messages sent from the client are echoed back with a server timestamp.
    The server will also push events (e.g. agent task completions) through
    this channel.
    """
    # Authenticate WebSocket connection
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        from app.core.security import verify_token
        token_data = verify_token(token, expected_type="access")
        if token_data.user_id != user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(user_id, websocket)

    # Send a welcome message
    await websocket.send_json({
        "type": "connected",
        "user_id": user_id,
        "message": f"Connected to {settings.APP_NAME} real-time channel.",
    })

    try:
        while True:
            data = await websocket.receive_json()
            # Echo back with server timestamp
            await websocket.send_json({
                "type": "echo",
                "user_id": user_id,
                "data": data,
                "server_time": time.time(),
            })
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception as exc:
        logger.exception("WebSocket error for user %s: %s", user_id, exc)
        ws_manager.disconnect(user_id, websocket)
