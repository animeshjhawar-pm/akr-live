# --- Frontend build stage ---
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Runtime stage ---
FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2 wheel (psycopg2-binary ships its own libpq, but having
# libpq-dev available makes any future swap to source psycopg2 trivial).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY --from=frontend /app/frontend/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Railway provides $PORT at runtime; default to 8000 for local docker runs.
CMD ["sh", "-c", "uvicorn api.index:app --host 0.0.0.0 --port ${PORT:-8000}"]
