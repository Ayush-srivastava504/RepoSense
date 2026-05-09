#!/bin/sh
set -e

# Load environment variables from .env if present
if [ -f .env ]; then
  # Export each line that is not a comment and not empty
  export $(grep -v '^#' .env | xargs)
fi

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set."
  exit 1
fi

# Run all migration .sql files in /app/migrations
if [ -d migrations ]; then
  for sql_file in migrations/*.sql; do
    if [ -f "$sql_file" ]; then
      echo "Running migration $sql_file"
      psql "$DATABASE_URL" -f "$sql_file"
    fi
  done
else
  echo "No migrations directory found. Skipping migrations."
fi

# Start the FastAPI app
exec uvicorn src.app:app --host 0.0.0.0 --port 8000
