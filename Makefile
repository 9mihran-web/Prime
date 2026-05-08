# =============================================================================
# PRIME — Developer Makefile
# =============================================================================
# Usage: make <target>
# Run `make help` to see all available targets.

# Sensible shell defaults
SHELL := /bin/bash
.ONESHELL:

# Colour helpers
BOLD  := $(shell tput bold 2>/dev/null || echo "")
RESET := $(shell tput sgr0 2>/dev/null || echo "")
GREEN := $(shell tput setaf 2 2>/dev/null || echo "")
CYAN  := $(shell tput setaf 6 2>/dev/null || echo "")

# Docker Compose command (v2 plugin syntax; falls back to standalone)
DC := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

# Backend container name (as defined in docker-compose.yml)
BACKEND_SERVICE  := backend
DB_SERVICE       := postgres
FRONTEND_SERVICE := frontend

# Default target
.DEFAULT_GOAL := help

# =============================================================================
# Help
# =============================================================================

.PHONY: help
help: ## Show this help message
	@echo ""
	@echo "$(BOLD)$(CYAN)PRIME — Available Makefile targets$(RESET)"
	@echo "$(BOLD)────────────────────────────────────────────────────$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# Docker Compose — lifecycle
# =============================================================================

.PHONY: dev
dev: ## Start all services in development mode (docker-compose up --build)
	$(DC) up --build

.PHONY: dev-detach
dev-detach: ## Start all services in the background (-d)
	$(DC) up --build -d

.PHONY: build
build: ## Build (or rebuild) all Docker images without starting services
	$(DC) build

.PHONY: build-no-cache
build-no-cache: ## Force-rebuild all images with --no-cache
	$(DC) build --no-cache

.PHONY: down
down: ## Stop and remove containers, networks (preserves volumes)
	$(DC) down

.PHONY: stop
stop: ## Stop running containers without removing them
	$(DC) stop

.PHONY: restart
restart: down dev ## Shortcut: down then up

.PHONY: ps
ps: ## List running containers and their status
	$(DC) ps

# =============================================================================
# Logs
# =============================================================================

.PHONY: logs
logs: ## Stream logs from all services (Ctrl-C to stop)
	$(DC) logs -f

.PHONY: logs-backend
logs-backend: ## Stream logs from the backend service only
	$(DC) logs -f $(BACKEND_SERVICE)

.PHONY: logs-frontend
logs-frontend: ## Stream logs from the frontend service only
	$(DC) logs -f $(FRONTEND_SERVICE)

.PHONY: logs-db
logs-db: ## Stream logs from the postgres service only
	$(DC) logs -f $(DB_SERVICE)

# =============================================================================
# Database — migrations & seeding
# =============================================================================

.PHONY: migrate
migrate: ## Run Alembic migrations to the latest revision (upgrade head)
	$(DC) exec $(BACKEND_SERVICE) alembic upgrade head

.PHONY: migrate-down
migrate-down: ## Rollback the last Alembic migration
	$(DC) exec $(BACKEND_SERVICE) alembic downgrade -1

.PHONY: migrate-history
migrate-history: ## Show Alembic migration history
	$(DC) exec $(BACKEND_SERVICE) alembic history --verbose

.PHONY: migrate-status
migrate-status: ## Show current Alembic revision
	$(DC) exec $(BACKEND_SERVICE) alembic current

.PHONY: seed
seed: ## Seed the database with initial/sample data
	$(DC) exec $(BACKEND_SERVICE) python -m app.scripts.seed

.PHONY: makemigration
makemigration: ## Generate a new Alembic migration (MSG="describe the change")
ifndef MSG
	$(error MSG is not set. Usage: make makemigration MSG="add users table")
endif
	$(DC) exec $(BACKEND_SERVICE) alembic revision --autogenerate -m "$(MSG)"

# =============================================================================
# Linting & formatting
# =============================================================================

.PHONY: lint
lint: lint-backend lint-frontend ## Lint both backend and frontend

.PHONY: lint-backend
lint-backend: ## Run ruff (lint + format check) and mypy on the backend
	@echo "$(BOLD)$(CYAN)→ Backend lint$(RESET)"
	$(DC) exec $(BACKEND_SERVICE) ruff check app/
	$(DC) exec $(BACKEND_SERVICE) ruff format --check app/
	$(DC) exec $(BACKEND_SERVICE) mypy app/ --ignore-missing-imports --strict-optional

.PHONY: lint-frontend
lint-frontend: ## Run ESLint and TypeScript type-check on the frontend
	@echo "$(BOLD)$(CYAN)→ Frontend lint$(RESET)"
	$(DC) exec $(FRONTEND_SERVICE) npm run lint
	$(DC) exec $(FRONTEND_SERVICE) npm run type-check

.PHONY: format
format: format-backend format-frontend ## Auto-format both backend and frontend

.PHONY: format-backend
format-backend: ## Auto-format backend Python code with ruff
	$(DC) exec $(BACKEND_SERVICE) ruff format app/
	$(DC) exec $(BACKEND_SERVICE) ruff check --fix app/

.PHONY: format-frontend
format-frontend: ## Auto-format frontend code with Prettier (if configured)
	$(DC) exec $(FRONTEND_SERVICE) npm run format 2>/dev/null || echo "No format script found"

# =============================================================================
# Testing
# =============================================================================

.PHONY: test
test: test-backend test-frontend ## Run all tests (backend + frontend)

.PHONY: test-backend
test-backend: ## Run pytest with coverage for the backend
	@echo "$(BOLD)$(CYAN)→ Backend tests$(RESET)"
	$(DC) exec \
		-e ENVIRONMENT=test \
		$(BACKEND_SERVICE) \
		pytest --cov=app --cov-report=term-missing --cov-fail-under=60 -v tests/

.PHONY: test-frontend
test-frontend: ## Run frontend tests (Jest / Vitest)
	@echo "$(BOLD)$(CYAN)→ Frontend tests$(RESET)"
	$(DC) exec $(FRONTEND_SERVICE) npm test -- --passWithNoTests --forceExit

.PHONY: test-backend-watch
test-backend-watch: ## Run pytest in watch mode (requires pytest-watch)
	$(DC) exec $(BACKEND_SERVICE) ptw -- -v tests/

# =============================================================================
# Shell access
# =============================================================================

.PHONY: shell-backend
shell-backend: ## Open a bash shell inside the running backend container
	$(DC) exec $(BACKEND_SERVICE) bash

.PHONY: shell-frontend
shell-frontend: ## Open a sh shell inside the running frontend container
	$(DC) exec $(FRONTEND_SERVICE) sh

.PHONY: shell-db
shell-db: ## Open a psql session inside the postgres container
	$(DC) exec $(DB_SERVICE) psql -U prime_user -d prime_db

.PHONY: shell-redis
shell-redis: ## Open a redis-cli session inside the redis container
	$(DC) exec redis redis-cli

# =============================================================================
# Housekeeping
# =============================================================================

.PHONY: clean
clean: ## Stop containers, remove volumes, and force-rebuild images
	@echo "$(BOLD)WARNING: This will delete all local data volumes!$(RESET)"
	@read -p "Continue? [y/N] " ans && [ "$${ans:-N}" = "y" ]
	$(DC) down -v --remove-orphans
	$(DC) build --no-cache

.PHONY: clean-images
clean-images: ## Remove dangling Docker images
	docker image prune -f

.PHONY: prune
prune: ## Remove all stopped containers, unused networks, and dangling images
	docker system prune -f

.PHONY: reset-db
reset-db: ## Drop and recreate the database, then run migrations
	@echo "$(BOLD)WARNING: This will DELETE all database data!$(RESET)"
	@read -p "Continue? [y/N] " ans && [ "$${ans:-N}" = "y" ]
	$(DC) exec $(DB_SERVICE) psql -U prime_user -c "DROP DATABASE IF EXISTS prime_db;"
	$(DC) exec $(DB_SERVICE) psql -U prime_user -c "CREATE DATABASE prime_db;"
	$(DC) exec $(BACKEND_SERVICE) alembic upgrade head

# =============================================================================
# Utilities
# =============================================================================

.PHONY: env
env: ## Copy .env.example to .env if .env doesn't already exist
	@if [ -f .env ]; then \
		echo ".env already exists — skipping"; \
	else \
		cp .env.example .env; \
		echo "Created .env from .env.example — fill in OPENAI_API_KEY and SECRET_KEY"; \
	fi

.PHONY: check-env
check-env: ## Verify required environment variables are set
	@echo "Checking required environment variables..."
	@test -n "$$OPENAI_API_KEY" || (echo "ERROR: OPENAI_API_KEY is not set" && exit 1)
	@test -n "$$SECRET_KEY"     || (echo "WARNING: SECRET_KEY not set — using insecure default")
	@echo "Environment check passed."

.PHONY: install-hooks
install-hooks: ## Install git pre-commit hooks (requires pre-commit)
	pre-commit install

.PHONY: docs
docs: ## Open API documentation in the default browser
	@open http://localhost:8000/docs 2>/dev/null || xdg-open http://localhost:8000/docs 2>/dev/null || \
		echo "Open http://localhost:8000/docs in your browser"
