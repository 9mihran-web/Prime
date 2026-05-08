# PRIME — Architecture Decision Record

> **Document status:** Living document — update when significant architectural decisions are made.
> **Last reviewed:** 2026-05-08

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Diagram](#component-diagram)
3. [Backend Design](#backend-design)
4. [Frontend Design](#frontend-design)
5. [AI Layer](#ai-layer)
6. [Authentication & Security](#authentication--security)
7. [Real-Time Communication](#real-time-communication)
8. [Data Layer](#data-layer)
9. [Background Task Processing](#background-task-processing)
10. [Scalability & Deployment](#scalability--deployment)
11. [Future Roadmap](#future-roadmap)

---

## System Overview

PRIME is a full-stack, production-grade AI assistant platform. The architecture is built around three
guiding principles:

- **Async-first** — every I/O-bound operation (DB, Redis, OpenAI) is awaited, keeping the event loop
  free and achieving high concurrency without horizontal scaling pressure at moderate traffic.
- **Stateless backend** — all session and authentication state lives in Redis and the database, not
  in process memory. Any backend replica can serve any request.
- **Streaming by default** — chat responses are streamed token-by-token over Server-Sent Events so
  users perceive immediate feedback, even for long AI responses.

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                                  │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      Next.js 15 App Router                           │  │
│   │                                                                      │  │
│   │   ┌─────────────┐   ┌──────────────┐   ┌────────────────────────┐   │  │
│   │   │  Auth Pages  │   │  Chat Shell  │   │  Settings / Profile    │   │  │
│   │   └─────────────┘   └──────┬───────┘   └────────────────────────┘   │  │
│   │                            │                                          │  │
│   │   ┌─────────────────────── │ ────────────────────────────────────┐   │  │
│   │   │   Zustand Store        │  ·  Axios HTTP Client  ·  SSE hook  │   │  │
│   │   └─────────────────────── │ ────────────────────────────────────┘   │  │
│   └────────────────────────────│─────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┬─┘
                                 │                                           │
                  HTTP + SSE     │                              WebSocket    │
                  REST calls     │                              (live feed)  │
                                 │                                           │
┌────────────────────────────────▼───────────────────────────────────────────▼─┐
│                          FastAPI (Uvicorn / ASGI)                             │
│                                                                               │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│   │   REST API v1    │  │  SSE /chat/stream│  │  WebSocket /ws/chat/{id}   │ │
│   │                  │  │                  │  │                            │ │
│   │  /auth   /conv   │  │  Token-by-token  │  │  Presence / live typing    │ │
│   │  /users  /health │  │  AI response     │  │  Instant delivery          │ │
│   └────────┬─────────┘  └────────┬─────────┘  └────────────────────────────┘ │
│            │                     │                                            │
│   ┌────────▼─────────────────────▼──────────────────────────────────────────┐ │
│   │                        Service Layer                                     │ │
│   │                                                                          │ │
│   │  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │ │
│   │  │  AuthService  │  │ ConversationSvc  │  │     AI Orchestrator      │  │ │
│   │  │  JWT / tokens │  │  CRUD + history  │  │  OpenAI · RAG · Memory   │  │ │
│   │  └───────────────┘  └──────────────────┘  └──────────────────────────┘  │ │
│   └──────────────────────────────────────────────────────────────────────── ┘ │
└───────────────────┬───────────────────────┬────────────────────┬──────────────┘
                    │                       │                    │
         ┌──────────▼──────────┐  ┌─────────▼─────────┐  ┌──────▼─────────────┐
         │  PostgreSQL 16      │  │     Redis 7        │  │  Celery Workers    │
         │  + pgvector ext.    │  │                    │  │                    │
         │                     │  │  DB 0 — sessions   │  │  · embed messages  │
         │  · users            │  │  DB 0 — rate limit │  │  · send emails     │
         │  · conversations    │  │  DB 0 — token BL   │  │  · process uploads │
         │  · messages         │  │  DB 1 — Celery MQ  │  │                    │
         │  · embeddings       │  │  DB 2 — Celery res │  │  Beat scheduler    │
         │  (1536-dim vectors) │  │                    │  │  for periodic jobs │
         └─────────────────────┘  └────────────────────┘  └────────────────────┘
```

---

## Backend Design

### Framework — FastAPI

FastAPI was chosen over Django REST Framework and Flask for three reasons:

1. **Native async support** — all route handlers, database sessions, and service calls are `async def`,
   allowing Uvicorn to serve thousands of concurrent connections without threads.
2. **Automatic OpenAPI generation** — Pydantic v2 schemas double as request/response validation *and*
   the source of truth for the Swagger UI at `/docs`.
3. **Type safety** — strict Python typing throughout means runtime errors are caught earlier by mypy.

### Application Structure

```
backend/app/
├── api/v1/routes/         # Thin route handlers — delegate to services immediately
├── core/
│   ├── config.py          # Pydantic Settings (reads from env vars / .env file)
│   ├── database.py        # Async SQLAlchemy engine, session factory, Base
│   ├── deps.py            # FastAPI dependency-injection helpers (get_db, get_current_user)
│   └── security.py        # Password hashing, JWT encode/decode, token refresh logic
├── models/                # SQLAlchemy ORM models (mapped to DB tables)
├── schemas/               # Pydantic v2 request and response schemas
├── services/
│   ├── auth.py            # Business logic for register / login / refresh / logout
│   ├── conversation.py    # Conversation + message CRUD
│   └── ai/
│       ├── client.py      # Thin OpenAI async wrapper with retry + timeout
│       ├── orchestrator.py# Build prompt, call OpenAI, stream tokens, persist message
│       ├── memory.py      # RAG retrieval: embed query, cosine-search pgvector
│       └── embeddings.py  # Batch-embed text via text-embedding-3-small
├── workers/
│   ├── celery_app.py      # Celery application factory
│   └── tasks/             # Individual background task modules
├── scripts/
│   └── seed.py            # Database seed script
└── main.py                # App factory: include routers, middleware, lifespan hooks
```

### Async SQLAlchemy + PostgreSQL

- `async_sessionmaker` with `AsyncSession` is used throughout.
- Each request gets its own session injected by `get_db()` dependency; sessions are closed on request
  teardown via `try/finally`.
- All queries use the 2.0-style `select()` / `execute()` API.
- `pgvector` extension is enabled on the `prime_db` database; `embedding` columns are `Vector(1536)`.

### Redis Usage

| Redis DB | Purpose                                      |
|----------|----------------------------------------------|
| 0        | Session cache, rate limiting counters, JWT refresh-token blacklist |
| 1        | Celery message broker (task queue)           |
| 2        | Celery result backend (task results)         |

All Redis keys use structured prefixes: `session:{user_id}`, `blacklist:{jti}`, `ratelimit:{user_id}`.

---

## Frontend Design

### Framework — Next.js 15 App Router

The App Router is used instead of the Pages Router to take advantage of:

- **React Server Components (RSC)** — pages that don't need client interactivity are rendered on the
  server, reducing bundle size.
- **Route-level colocated layouts** — shared UI (sidebar, nav) is defined once in `layout.tsx` files.
- **Streaming with Suspense** — skeleton loaders are shown while async data fetches complete server-side.

### State Management — Zustand 5

Zustand stores are used for:

- `useAuthStore` — current user, access token, login/logout actions.
- `useChatStore` — active conversation, message list, streaming buffer.
- `useUIStore` — sidebar open/close, theme preference, modal stack.

Stores do not persist to `localStorage` by default; the access token is kept in memory only
(the refresh token is stored in an `httpOnly` cookie set by the server to prevent XSS access).

### Streaming Chat — SSE Hook

`useSSEChat(conversationId)` opens a native `EventSource` connection to
`GET /api/v1/chat/stream/{conversation_id}`. Incoming tokens are appended to the streaming buffer
in the Zustand store. On `[DONE]`, the buffer is flushed into the message list and the SSE connection
is closed.

```
Browser EventSource  →  GET /api/v1/chat/stream/{id}
                         │
                     FastAPI SSE handler
                         │
                     AI Orchestrator (async generator)
                         │
                     OpenAI stream → yield token chunks
                         │
                     Persist complete message to DB (on [DONE])
```

---

## AI Layer

### Multi-Model Strategy

| Task                    | Model                       | Notes                                      |
|-------------------------|-----------------------------|--------------------------------------------|
| Chat completion         | `gpt-4o`                    | Configurable via `OPENAI_MODEL` env var    |
| Text embeddings         | `text-embedding-3-small`    | 1536 dimensions, stored in pgvector        |
| Vision (roadmap)        | `gpt-4o` with image input   | Multimodal messages                        |
| Speech-to-text (roadmap)| `whisper-1`                 | Audio upload endpoint                      |
| Text-to-speech (roadmap)| `tts-1`                     | Voice response streaming                   |

### RAG Memory Architecture

```
User sends message
        │
        ▼
Embed user message  ────────────────────────────────────────────────────────────┐
(text-embedding-3-small)                                                         │
        │                                                                         │
        ▼                                                                         │
pgvector cosine search                                                            │
  SELECT content, 1 - (embedding <=> $query_vec) AS score                        │
  FROM messages                                                                   │
  WHERE user_id = $uid                                                            │
  ORDER BY score DESC                                                             │
  LIMIT 8                                                                         │
        │                                                                         │
        ▼                                                                         │
Inject top-k relevant messages into system prompt context                         │
        │                                                                         │
        ▼                                                                         │
Call OpenAI with: system prompt + retrieved context + conversation history        │
        │                                                                         │
        ▼                                                                         │
Stream tokens → SSE → browser                                                    │
        │                                                                         │
        ▼                                                                         │
Persist assistant response to DB  ───────────────────────────────────────────────┘
Enqueue Celery task: embed new message (non-blocking)
```

Long-term memory is stored per-user. Embeddings are generated asynchronously by a Celery worker so
they do not add latency to the streaming response path.

---

## Authentication & Security

### Token Strategy

```
POST /api/v1/auth/login
  → Returns:  access_token  (JWT, HS256, 30-min TTL, in JSON body)
              refresh_token (JWT, HS256,  7-day TTL, in httpOnly cookie)

Every protected request:
  Authorization: Bearer <access_token>

POST /api/v1/auth/refresh
  → Reads refresh_token from httpOnly cookie
  → Validates token is not blacklisted in Redis (key: blacklist:{jti})
  → Issues new access_token + rotates refresh_token
  → Blacklists old refresh_token jti

POST /api/v1/auth/logout
  → Adds refresh_token jti to Redis blacklist (TTL = remaining token lifetime)
  → Clears httpOnly cookie
```

### Why httpOnly Cookie for Refresh Token?

Access tokens are short-lived (30 min) and kept in JavaScript memory (Zustand store). This limits
the XSS attack window to 30 minutes. Refresh tokens are long-lived (7 days) and stored in an
`httpOnly` cookie to prevent JavaScript from reading or exfiltrating them.

### Rate Limiting

A custom FastAPI middleware checks `ratelimit:{user_id}` in Redis using a sliding-window counter.
Default: 60 requests per minute per authenticated user. Unauthenticated requests are limited by IP.

---

## Real-Time Communication

### SSE (Server-Sent Events) — Chat Streaming

- **Protocol:** HTTP/1.1 chunked transfer encoding or HTTP/2 server push.
- **Endpoint:** `GET /api/v1/chat/stream/{conversation_id}`
- **Event types:** `token` (partial text chunk), `done` (signal stream end), `error`.
- **Reconnection:** `EventSource` reconnects automatically on network interruption; the backend
  resumes from the last incomplete message or sends a fresh completion.

SSE is preferred over WebSocket for chat streaming because:
- It works over standard HTTP (no upgrade required, simpler proxying).
- It is unidirectional (server → client), which matches the streaming use case exactly.
- The browser's native `EventSource` API handles reconnection for free.

### WebSocket — Live Features

- **Endpoint:** `ws://host/ws/chat/{conversation_id}`
- **Use cases:** typing indicators ("Alice is typing…"), read receipts, presence.
- **Connection management:** the FastAPI WebSocket manager keeps an in-process mapping of
  `{conversation_id: [WebSocket]}`. When multiple backend replicas are used, a Redis Pub/Sub
  channel (`ws:conv:{id}`) is used to fan out messages across instances.

---

## Data Layer

### Entity–Relationship Overview

```
users
  id (UUID PK)
  email (unique)
  hashed_password
  created_at
    │
    │ 1:N
    ▼
conversations
  id (UUID PK)
  user_id (FK → users)
  title
  created_at
  updated_at
    │
    │ 1:N
    ▼
messages
  id (UUID PK)
  conversation_id (FK → conversations)
  role          (enum: user | assistant | system)
  content       (TEXT)
  embedding     (Vector(1536), nullable)
  token_count   (INT)
  created_at

  INDEX: messages(conversation_id, created_at)
  INDEX: messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
```

### pgvector Index Selection

`IVFFlat` (inverted file with flat compression) is chosen over `HNSW` for the initial deployment
because:
- Lower memory footprint at moderate dataset sizes.
- Index rebuild is faster during early iteration.

Once the dataset exceeds ~1 million vectors, migrating to `HNSW` is recommended for better recall.

---

## Background Task Processing

### Celery Task Catalogue

| Task name                         | Trigger                          | Description                                   |
|-----------------------------------|----------------------------------|-----------------------------------------------|
| `embed_message`                   | After message persisted          | Generate and store vector embedding           |
| `send_welcome_email`              | After user registration          | Send onboarding email via SMTP                |
| `process_file_upload`             | After file attached to message   | Parse, chunk, embed document for RAG          |
| `prune_expired_tokens`            | Celery Beat — nightly 02:00 UTC  | Remove expired JWT JTIs from Redis blacklist  |
| `rebuild_embedding_index`         | Celery Beat — weekly Sunday 03:00| Re-run `VACUUM ANALYZE` + IVFFlat reindex     |

### Celery Configuration

- Broker: `redis://redis:6379/1`
- Result backend: `redis://redis:6379/2`
- Concurrency: 2 workers per container (CPU-bound tasks are intentionally minimal).
- Serialisation: JSON (safe default).
- Task time limit: 300 s hard / 240 s soft.

---

## Scalability & Deployment

### Horizontal Scaling

Because the backend is stateless (no sticky sessions), it can be scaled horizontally behind a
load balancer without any code changes:

```
           ┌────────────────┐
           │  Load Balancer │  (nginx / AWS ALB / Cloudflare)
           └───────┬────────┘
         ┌─────────┴──────────┐
         │                    │
  ┌──────▼──────┐      ┌──────▼──────┐
  │  Backend-1  │      │  Backend-2  │      … N replicas
  │  (FastAPI)  │      │  (FastAPI)  │
  └──────┬──────┘      └──────┬──────┘
         │                    │
         └──────────┬─────────┘
                    │
          ┌─────────▼────────┐
          │  Shared State:   │
          │  PostgreSQL       │  (Primary + read replicas)
          │  Redis Cluster    │  (Session, rate limiting, pub/sub)
          └──────────────────┘
```

### CDN for Frontend

The Next.js build produces a standalone server bundle. In production:

1. Static assets (JS/CSS/images) are served from a CDN (Cloudflare, CloudFront, or Vercel Edge).
2. Dynamic pages and API routes hit the Next.js server.
3. The backend FastAPI server is not exposed directly; all traffic is routed through the CDN and
   an API Gateway that handles TLS termination and DDoS protection.

### Container Orchestration (Production)

The provided `docker-compose.yml` is optimised for local development. Production deployments
should use:

- **Kubernetes** (EKS, GKE, or self-hosted) with Helm charts for each service.
- **Docker Swarm** for simpler single-cluster deployments.
- Separate `Dockerfile` targets for `production` vs. `development` are already implemented.

---

## Future Roadmap

### Near-term (3–6 months)

| Feature                    | Description                                                              |
|----------------------------|--------------------------------------------------------------------------|
| Voice agents               | Integrate `whisper-1` (STT) + `tts-1` (TTS) for audio-first interactions |
| Multi-modal messages       | Accept image uploads; pass them to `gpt-4o` vision                      |
| Plugin system              | Allow third-party tools/functions via OpenAI function calling            |
| Fine-tuned persona         | Per-user or per-organisation custom system prompts and model fine-tuning |

### Medium-term (6–12 months)

| Feature                    | Description                                                              |
|----------------------------|--------------------------------------------------------------------------|
| Prime Ecosystem            | Public API + SDK so external apps can embed PRIME as an AI layer         |
| Agent workflows            | Multi-step autonomous agents (web search, code execution, file ops)      |
| Collaborative spaces       | Shared conversation threads for teams with role-based access             |
| Analytics dashboard        | Usage metrics, token spend, conversation quality scores                  |

### Long-term (12+ months)

| Feature                    | Description                                                              |
|----------------------------|--------------------------------------------------------------------------|
| On-premise / private cloud | Support for locally-hosted models (Ollama, vLLM) as OpenAI replacements  |
| Federated identity         | SAML / OIDC enterprise SSO integration                                   |
| Multi-lingual memory       | Cross-language semantic search in the RAG layer                          |
| Observability              | OpenTelemetry traces, Prometheus metrics, Grafana dashboards             |

---

*This document is maintained alongside the codebase. When making significant architectural
changes, update the relevant section and record the decision rationale here.*
