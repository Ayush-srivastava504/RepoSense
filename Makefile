.PHONY: help dev build test migrate deploy

help:
	@echo "Commands:"
	@echo "  make dev        - Start all services (backend + frontend) in dev mode"
	@echo "  make build      - Build all Docker images"
	@echo "  make test       - Run backend and frontend tests"
	@echo "  make migrate    - Run database migrations"
	@echo "  make deploy     - Deploy to AWS (requires AWS CLI & Terraform)"

dev:
	docker-compose -f infrastructure/docker/docker-compose.yml up -d
	cd apps/web && npm install && npm run dev &
	cd services/api && source venv/bin/activate && uvicorn src.app:app --reload --port 8000

build:
	docker-compose -f infrastructure/docker/docker-compose.yml build

test:
	cd services/api && pytest tests/ -v
	cd apps/web && npm test

migrate:
	psql $$DATABASE_URL -f database/migrations/001_users.sql
	psql $$DATABASE_URL -f database/migrations/002_resumes.sql
	psql $$DATABASE_URL -f database/migrations/003_jobs.sql
	psql $$DATABASE_URL -f database/migrations/004_subscriptions.sql

deploy:
	cd infrastructure/terraform && terraform apply -auto-approve
	./scripts/deploy.sh