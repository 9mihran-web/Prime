# ---------------------------------------------------------------------------
# PRIME Backend — Production Dockerfile
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS base

# Prevent .pyc files and enable unbuffered stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install OS-level dependencies required by some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies layer (cached separately from source code)
# ---------------------------------------------------------------------------
FROM base AS deps

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# ---------------------------------------------------------------------------
# Final image
# ---------------------------------------------------------------------------
FROM deps AS final

# Copy application source
COPY . .

# Create a non-root user for running the app
RUN addgroup --system prime && adduser --system --ingroup prime prime
RUN chown -R prime:prime /app
USER prime

# Expose the application port
EXPOSE 8000

# Health check — polls the /health endpoint every 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Entrypoint: run with uvicorn (use --workers for multi-process in production)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
