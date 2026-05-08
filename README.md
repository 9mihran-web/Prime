```
██████╗ ██████╗ ██╗███╗   ███╗███████╗
██╔══██╗██╔══██╗██║████╗ ████║██╔════╝
██████╔╝██████╔╝██║██╔████╔██║█████╗
██╔═══╝ ██╔══██╗██║██║╚██╔╝██║██╔══╝
██║     ██║  ██║██║██║ ╚═╝ ██║███████╗
╚═╝     ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝
```

# PRIME — Next-Generation AI Assistant Platform

[![CI](https://github.com/your-org/prime/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/prime/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org)

PRIME is a production-ready, full-stack AI assistant platform that combines a FastAPI backend with a Next.js 15 frontend to deliver real-time conversational AI with persistent memory, semantic search, and streaming responses. It is designed to be extended into a complete AI-powered product suite.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / Client                      │
│              Next.js 15  ·  React 19  ·  Zustand            │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTP / SSE / WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                      FastAPI Backend                         │
│   REST API  ·  WebSocket Hub  ·  SSE Chat Stream            │
│                                                              │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Auth / JWT │  │ Conversation│  │    AI Orchestrator   │  │
│  │ (Redis BL) │  │   Service   │  │  OpenAI · RAG Memory │  │
│  └────────────┘  └─────────────┘  └──────────────────────┘  │
└───────────┬───────────────┬────────────────────┬────────────┘
            │               │                    │
    ┌───────▼──────┐ ┌──────▼──────┐   ┌─────────▼──────────┐
    │  PostgreSQL  │ │    Redis    │   │  Celery Workers    │
    │  + pgvector  │ │  Sessions   │   │  Background Tasks  │
    │  (long-term  │ │  Cache      │   │  Embeddings / Mail │
    │   memory)    │ │  Rate limit │   │                    │
    └──────────────┘ └─────────────┘   └────────────────────┘
```

---

## Tech Stack

| Layer        | Technology                                      | Purpose                              |
|--------------|-------------------------------------------------|--------------------------------------|
| Frontend     | Next.js 15, React 19, TypeScript                | App shell, routing, SSR/SSG          |
| Styling      | Tailwind CSS 3, CVA, tailwind-merge             | Utility-first design system          |
| State        | Zustand 5                                       | Client-side global state             |
| Animation    | Framer Motion 11                                | UI micro-interactions                |
| API client   | Axios, native EventSource (SSE)                 | HTTP + streaming calls               |
| Backend      | FastAPI, Python 3.12, Uvicorn                   | Async REST + WebSocket server        |
| ORM          | SQLAlchemy 2 (async), Alembic                   | Database access + migrations         |
| Database     | PostgreSQL 16 + pgvector                        | Relational data + vector memory      |
| Cache / Queue| Redis 7                                         | Sessions, token blacklist, tasks     |
| Task queue   | Celery 5                                        | Async background jobs                |
| Auth         | JWT (HS256), refresh tokens, Redis blacklist    | Stateless, secure authentication     |
| AI           | OpenAI (gpt-4o, text-embedding-3-small)         | Chat completions, embeddings, TTS    |
| CI           | GitHub Actions                                  | Lint, typecheck, test on every push  |
| Containers   | Docker, Docker Compose                          | Reproducible local + prod deployment |

---

## Prerequisites

| Tool             | Minimum Version | Notes                                      |
|------------------|-----------------|--------------------------------------------|
| Node.js          | 20.x LTS        | Use [nvm](https://github.com/nvm-sh/nvm)   |
| Python           | 3.12            | Use [pyenv](https://github.com/pyenv/pyenv)|
| Docker Desktop   | 4.x             | Includes Docker Compose v2                 |
| OpenAI API key   | —               | [platform.openai.com](https://platform.openai.com) |
| Git              | 2.x             | —                                          |

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/prime.git
cd prime

# 2. Create your local environment file
cp .env.example .env
# Open .env and fill in OPENAI_API_KEY (and optionally SECRET_KEY)

# 3. Start all services
docker compose up --build

# 4. In a separate terminal, run database migrations
docker compose exec backend alembic upgrade head

# 5. (Optional) Seed the database with sample data
docker compose exec backend python -m app.scripts.seed
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs
- API docs (ReDoc): http://localhost:8000/redoc

---

### Option B — Manual Setup

#### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, OPENAI_API_KEY, SECRET_KEY

# Run database migrations
alembic upgrade head

# Start the development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL

# Start the development server
npm run dev
```

---

## Environment Variables

### Root / Docker Compose `.env`

| Variable                    | Default                        | Required | Description                                |
|-----------------------------|--------------------------------|----------|--------------------------------------------|
| `OPENAI_API_KEY`            | —                              | Yes      | OpenAI secret key                          |
| `SECRET_KEY`                | (insecure placeholder)         | Yes      | JWT signing key — use 32+ random chars     |
| `NEXT_PUBLIC_API_URL`       | `http://localhost:8000`        | No       | URL the browser uses to call the backend   |
| `NEXT_PUBLIC_WS_URL`        | `ws://localhost:8000`          | No       | WebSocket base URL                         |
| `OPENAI_MODEL`              | `gpt-4o`                       | No       | Chat completion model                      |
| `OPENAI_EMBEDDING_MODEL`    | `text-embedding-3-small`       | No       | Embedding model for vector memory          |

### Backend `backend/.env`

| Variable                    | Default                                                       | Description                                 |
|-----------------------------|---------------------------------------------------------------|---------------------------------------------|
| `DATABASE_URL`              | `postgresql+asyncpg://prime:prime@localhost:5432/prime_db`   | Async PostgreSQL connection string          |
| `REDIS_URL`                 | `redis://localhost:6379/0`                                    | Redis connection (sessions + rate limiting) |
| `CELERY_BROKER_URL`         | `redis://localhost:6379/1`                                    | Celery message broker                       |
| `CELERY_RESULT_BACKEND`     | `redis://localhost:6379/2`                                    | Celery result storage                       |
| `SECRET_KEY`                | (placeholder)                                                 | JWT signing secret                          |
| `ALGORITHM`                 | `HS256`                                                       | JWT algorithm                               |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30`                                                        | Access token lifetime (minutes)             |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7`                                                           | Refresh token lifetime (days)               |
| `OPENAI_API_KEY`            | —                                                             | OpenAI secret key                           |
| `OPENAI_MODEL`              | `gpt-4o`                                                      | Chat completion model                       |
| `OPENAI_EMBEDDING_MODEL`    | `text-embedding-3-small`                                      | Embedding model                             |
| `CORS_ORIGINS`              | `["http://localhost:3000"]`                                   | Allowed CORS origins (JSON array)           |
| `RATE_LIMIT_PER_MINUTE`     | `60`                                                          | Requests per minute per user                |
| `DEBUG`                     | `false`                                                       | Enable debug logging + error details        |
| `ENVIRONMENT`               | `production`                                                  | `development` / `test` / `production`       |

---

## API Endpoints

### Authentication

| Method | Path                  | Description                        |
|--------|-----------------------|------------------------------------|
| POST   | `/api/v1/auth/register` | Create a new user account        |
| POST   | `/api/v1/auth/login`    | Obtain access + refresh tokens   |
| POST   | `/api/v1/auth/refresh`  | Exchange refresh token for new access token |
| POST   | `/api/v1/auth/logout`   | Blacklist refresh token          |
| GET    | `/api/v1/auth/me`       | Return current user profile      |

### Conversations

| Method | Path                                  | Description                          |
|--------|---------------------------------------|--------------------------------------|
| GET    | `/api/v1/conversations`               | List user's conversations            |
| POST   | `/api/v1/conversations`               | Create new conversation              |
| GET    | `/api/v1/conversations/{id}`          | Get conversation with messages       |
| DELETE | `/api/v1/conversations/{id}`          | Delete conversation                  |
| POST   | `/api/v1/conversations/{id}/messages` | Send message (triggers AI response)  |

### Chat Streaming

| Method | Path                                  | Description                          |
|--------|---------------------------------------|--------------------------------------|
| GET    | `/api/v1/chat/stream/{conversation_id}` | SSE stream of AI response tokens   |
| WS     | `/ws/chat/{conversation_id}`          | WebSocket for real-time chat         |

### Health

| Method | Path        | Description                           |
|--------|-------------|---------------------------------------|
| GET    | `/health`   | Liveness probe — returns `{"status":"ok"}` |
| GET    | `/ready`    | Readiness probe — checks DB + Redis   |

---

## Project Structure

```
prime/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI pipeline
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── routes/     # FastAPI route handlers
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic settings
│   │   │   ├── database.py     # Async SQLAlchemy engine + session
│   │   │   └── security.py     # JWT utilities
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/
│   │   │   └── ai/             # OpenAI client, RAG, embeddings
│   │   ├── workers/            # Celery tasks
│   │   └── main.py             # FastAPI app factory
│   ├── alembic/                # Database migrations
│   ├── tests/                  # pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js App Router pages + layouts
│   │   ├── components/         # Reusable React components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # API client, utilities
│   │   └── store/              # Zustand stores
│   ├── public/                 # Static assets
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── docker-compose.yml          # Local development stack
├── Makefile                    # Developer convenience targets
├── .gitignore
├── .env.example                # Template for environment variables
├── README.md
└── ARCHITECTURE.md
```

---

## Contributing

1. Fork the repository and create a feature branch from `develop`:
   ```bash
   git checkout -b feature/your-feature-name develop
   ```
2. Make your changes and ensure the test suite passes:
   ```bash
   make lint
   make test
   ```
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add voice input support
   fix: correct token refresh expiry calculation
   docs: update API endpoint table
   ```
4. Open a pull request against `develop`. The CI pipeline must be green before a review is assigned.
5. After approval and merge to `develop`, a release PR to `main` is created by the maintainer team.

### Code Style

- **Backend**: `ruff` for linting and formatting, `mypy` for type checking.
- **Frontend**: ESLint (Next.js config) + TypeScript strict mode.
- Pre-commit hooks are recommended (`pre-commit install` after cloning).

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

*Built with care by the PRIME team.*
