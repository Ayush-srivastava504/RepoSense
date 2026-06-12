#!/bin/sh
set -e

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set."
  exit 1
fi

# Run all migration .sql files in /app/migrations
if [ -d /app/database/migrations ]; then
  for sql_file in /app/database/migrations/*.sql; do
    if [ -f "$sql_file" ]; then
      echo "Running migration: $sql_file"
      psql "$DATABASE_URL" -f "$sql_file"
    fi
  done
else
  echo "No /app/migrations directory found. Skipping migrations."
fi

# Start the FastAPI app  (core.app:app matches docker-compose command)
exec uvicorn core.app:app \
  --app-dir /app/src \
  --host 0.0.0.0 \
  --port 8000