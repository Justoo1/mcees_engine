# ============================================================
#  mcees_engine — Project Commands
# ============================================================

BACKEND_DIR   := backend
DASHBOARD_DIR := dashboard
PYTHON        := $(BACKEND_DIR)/.venv/bin/python
UV            := uv
DC            := docker compose

.DEFAULT_GOAL := help

# ── Formatting ───────────────────────────────────────────────
BOLD  := \033[1m
RESET := \033[0m
CYAN  := \033[36m

.PHONY: help
help:
	@echo ""
	@echo "$(BOLD)mcees_engine — Available Commands$(RESET)"
	@echo ""
	@echo "$(CYAN)Setup$(RESET)"
	@echo "  make setup              Bootstrap everything (venv, deps, .env)"
	@echo "  make install-backend    Install Python deps into backend/.venv"
	@echo "  make install-dashboard  Install Node deps in dashboard/"
	@echo "  make env                Copy .env.example → .env (skip if exists)"
	@echo ""
	@echo "$(CYAN)Docker$(RESET)"
	@echo "  make up                 Build & start all services (detached)"
	@echo "  make up-logs            Build & start all services (foreground)"
	@echo "  make down               Stop & remove containers"
	@echo "  make restart            Restart all services"
	@echo "  make restart-api        Restart only the API service"
	@echo "  make restart-worker     Restart only the Celery worker"
	@echo "  make build              Rebuild all Docker images"
	@echo "  make logs               Tail logs from all services"
	@echo "  make logs-api           Tail API logs"
	@echo "  make logs-worker        Tail worker logs"
	@echo "  make logs-dashboard     Tail dashboard logs"
	@echo "  make ps                 Show running service status"
	@echo ""
	@echo "$(CYAN)Database$(RESET)"
	@echo "  make db-migrate         Run Prisma migrations (needs Postgres)"
	@echo "  make db-migrate-create  Create a new migration (NAME=<name>)"
	@echo "  make db-generate        Regenerate Prisma client"
	@echo "  make db-studio          Open Prisma Studio (port 5555)"
	@echo "  make db-reset           Drop & recreate DB, re-run migrations"
	@echo "  make db-shell           Open psql shell inside Postgres container"
	@echo ""
	@echo "$(CYAN)Backend$(RESET)"
	@echo "  make test               Run all Python tests"
	@echo "  make test-watch         Run tests in watch mode"
	@echo "  make test-cov           Run tests with coverage report"
	@echo "  make lint               Lint Python code with ruff"
	@echo "  make format             Auto-format Python code with ruff"
	@echo "  make typecheck          Type-check Python with pyright"
	@echo "  make dev-api            Run FastAPI dev server locally (no Docker)"
	@echo "  make dev-worker         Run Celery worker locally (no Docker)"
	@echo ""
	@echo "$(CYAN)Dashboard$(RESET)"
	@echo "  make dev-dashboard      Run Next.js dev server locally (no Docker)"
	@echo "  make build-dashboard    Production build of Next.js app"
	@echo "  make lint-dashboard     Lint dashboard TypeScript"
	@echo ""
	@echo "$(CYAN)Testing Webhooks$(RESET)"
	@echo "  make webhook-shopify-order    Send a test Shopify order webhook"
	@echo "  make webhook-shopify-customer Send a test Shopify customer webhook"
	@echo "  make webhook-shopify-product  Send a test Shopify product/inventory webhook"
	@echo "  make webhook-woo-order        Send a test WooCommerce order webhook"
	@echo "  make webhook-woo-customer     Send a test WooCommerce customer webhook"
	@echo ""
	@echo "$(CYAN)Utilities$(RESET)"
	@echo "  make clean              Remove compiled files, caches, build artifacts"
	@echo "  make clean-docker       Remove all project containers + volumes"
	@echo "  make health             Check API health endpoint"
	@echo ""


# ── Setup ────────────────────────────────────────────────────

.PHONY: setup
setup: env install-backend install-dashboard db-generate
	@echo "$(BOLD)Setup complete.$(RESET) Run 'make up' to start all services."

.PHONY: env
env:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo ".env created from .env.example — update secrets before running."; \
	else \
		echo ".env already exists, skipping."; \
	fi

.PHONY: install-backend
install-backend:
	@echo "Installing Python dependencies..."
	cd $(BACKEND_DIR) && $(UV) venv .venv --python 3.11 2>/dev/null || true
	cd $(BACKEND_DIR) && $(UV) pip install --python .venv/bin/python -e ".[dev]"

.PHONY: install-dashboard
install-dashboard:
	@echo "Installing Node dependencies..."
	cd $(DASHBOARD_DIR) && npm install


# ── Docker ───────────────────────────────────────────────────

.PHONY: up
up:
	$(DC) up --build -d

.PHONY: up-logs
up-logs:
	$(DC) up --build

.PHONY: down
down:
	$(DC) down

.PHONY: restart
restart:
	$(DC) restart

.PHONY: restart-api
restart-api:
	$(DC) restart api

.PHONY: restart-worker
restart-worker:
	$(DC) restart worker

.PHONY: build
build:
	$(DC) build

.PHONY: logs
logs:
	$(DC) logs -f

.PHONY: logs-api
logs-api:
	$(DC) logs -f api

.PHONY: logs-worker
logs-worker:
	$(DC) logs -f worker

.PHONY: logs-dashboard
logs-dashboard:
	$(DC) logs -f dashboard

.PHONY: ps
ps:
	$(DC) ps


# ── Database ─────────────────────────────────────────────────

.PHONY: db-migrate
db-migrate:
	cd $(DASHBOARD_DIR) && npx prisma migrate deploy

.PHONY: db-migrate-create
db-migrate-create:
ifndef NAME
	$(error NAME is required. Usage: make db-migrate-create NAME=add_index)
endif
	cd $(DASHBOARD_DIR) && npx prisma migrate dev --name $(NAME)

.PHONY: db-generate
db-generate:
	cd $(DASHBOARD_DIR) && npx prisma generate

.PHONY: db-studio
db-studio:
	cd $(DASHBOARD_DIR) && npx prisma studio

.PHONY: db-reset
db-reset:
	@echo "WARNING: This will DROP and recreate the database."
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	cd $(DASHBOARD_DIR) && npx prisma migrate reset --force

.PHONY: db-shell
db-shell:
	$(DC) exec postgres psql -U $${POSTGRES_USER:-mcees} -d $${POSTGRES_DB:-mcees_db}


# ── Backend (local, no Docker) ───────────────────────────────

.PHONY: test
test:
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ -v

.PHONY: test-watch
test-watch:
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ -v --tb=short -p no:cacheprovider -f

.PHONY: test-cov
test-cov:
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ --cov=app --cov=workers --cov-report=term-missing

.PHONY: lint
lint:
	cd $(BACKEND_DIR) && $(PYTHON) -m ruff check app/ workers/ tests/

.PHONY: format
format:
	cd $(BACKEND_DIR) && $(PYTHON) -m ruff format app/ workers/ tests/
	cd $(BACKEND_DIR) && $(PYTHON) -m ruff check --fix app/ workers/ tests/

.PHONY: typecheck
typecheck:
	cd $(BACKEND_DIR) && $(PYTHON) -m pyright app/ workers/

.PHONY: dev-api
dev-api:
	cd $(BACKEND_DIR) && $(PYTHON) -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

.PHONY: dev-worker
dev-worker:
	cd $(BACKEND_DIR) && $(PYTHON) -m celery -A workers.celery_app worker --loglevel=info \
		--queues=orders,customers,inventory


# ── Dashboard (local, no Docker) ─────────────────────────────

.PHONY: dev-dashboard
dev-dashboard:
	cd $(DASHBOARD_DIR) && npm run dev

.PHONY: build-dashboard
build-dashboard:
	cd $(DASHBOARD_DIR) && npm run build

.PHONY: lint-dashboard
lint-dashboard:
	cd $(DASHBOARD_DIR) && npm run lint


# ── Test Webhooks ────────────────────────────────────────────
# Each target auto-generates a unique ID from the Unix timestamp so every
# run creates a fresh event. Override SKU, QTY, EMAIL via env vars if needed.
# Requires: curl, openssl
#   make webhook-shopify-order SKU=TSHIRT-BLK-M
#   make webhook-shopify-product SKU=TSHIRT-BLK-M QTY=30

API_URL  ?= http://localhost:8000
SKU      ?= TSHIRT-BLK-M
QTY      ?= 50
EMAIL    ?= customer@example.com

.PHONY: webhook-shopify-order
webhook-shopify-order:
	@export $$(grep -v '^#' .env | xargs) && \
	ID=$$(date +%s) && \
	PAYLOAD="{\"id\":$$ID,\"order_number\":$$ID,\"email\":\"$(EMAIL)\",\"total_price\":\"99.99\",\"currency\":\"USD\",\"financial_status\":\"paid\",\"line_items\":[{\"id\":1,\"title\":\"Test Product\",\"sku\":\"$(SKU)\",\"quantity\":2,\"price\":\"49.99\"}],\"created_at\":\"$$(date -u +%FT%TZ)\",\"updated_at\":\"$$(date -u +%FT%TZ)\"}" && \
	SIG=$$(echo -n "$$PAYLOAD" | openssl dgst -sha256 -hmac "$$SHOPIFY_WEBHOOK_SECRET" -binary | base64) && \
	echo "→ POST /api/v1/webhooks/shopify/orders  (order_id=$$ID, sku=$(SKU))" && \
	curl -s -X POST $(API_URL)/api/v1/webhooks/shopify/orders \
		-H "Content-Type: application/json" \
		-H "X-Shopify-Hmac-Sha256: $$SIG" \
		-d "$$PAYLOAD" | python3 -m json.tool

.PHONY: webhook-shopify-customer
webhook-shopify-customer:
	@export $$(grep -v '^#' .env | xargs) && \
	ID=$$(date +%s) && \
	PAYLOAD="{\"id\":$$ID,\"email\":\"customer$$ID@example.com\",\"first_name\":\"Test\",\"last_name\":\"Customer\",\"phone\":\"+1234567890\",\"default_address\":{\"address1\":\"123 Main St\",\"city\":\"Accra\",\"country\":\"GH\",\"zip\":\"00233\"},\"created_at\":\"$$(date -u +%FT%TZ)\",\"updated_at\":\"$$(date -u +%FT%TZ)\"}" && \
	SIG=$$(echo -n "$$PAYLOAD" | openssl dgst -sha256 -hmac "$$SHOPIFY_WEBHOOK_SECRET" -binary | base64) && \
	echo "→ POST /api/v1/webhooks/shopify/customers  (customer_id=$$ID)" && \
	curl -s -X POST $(API_URL)/api/v1/webhooks/shopify/customers \
		-H "Content-Type: application/json" \
		-H "X-Shopify-Hmac-Sha256: $$SIG" \
		-d "$$PAYLOAD" | python3 -m json.tool

.PHONY: webhook-shopify-product
webhook-shopify-product:
	@export $$(grep -v '^#' .env | xargs) && \
	ID=$$(date +%s) && \
	PAYLOAD="{\"id\":$$ID,\"title\":\"Test Product ($(SKU))\",\"status\":\"active\",\"variants\":[{\"sku\":\"$(SKU)\",\"inventory_quantity\":$(QTY)}]}" && \
	SIG=$$(echo -n "$$PAYLOAD" | openssl dgst -sha256 -hmac "$$SHOPIFY_WEBHOOK_SECRET" -binary | base64) && \
	echo "→ POST /api/v1/webhooks/shopify/products  (sku=$(SKU), qty=$(QTY))" && \
	curl -s -X POST $(API_URL)/api/v1/webhooks/shopify/products \
		-H "Content-Type: application/json" \
		-H "X-Shopify-Hmac-Sha256: $$SIG" \
		-d "$$PAYLOAD" | python3 -m json.tool

.PHONY: webhook-woo-customer
webhook-woo-customer:
	@export $$(grep -v '^#' .env | xargs) && \
	ID=$$(date +%s) && \
	PAYLOAD="{\"id\":$$ID,\"email\":\"customer$$ID@example.com\",\"first_name\":\"Test\",\"last_name\":\"Customer\",\"billing\":{\"first_name\":\"Test\",\"last_name\":\"Customer\",\"email\":\"customer$$ID@example.com\",\"phone\":\"+1234567890\",\"address_1\":\"123 Main St\",\"city\":\"Accra\",\"country\":\"GH\",\"postcode\":\"00233\"},\"date_created\":\"$$(date -u +%FT%TZ)\",\"date_modified\":\"$$(date -u +%FT%TZ)\"}" && \
	SIG=$$(echo -n "$$PAYLOAD" | openssl dgst -sha256 -hmac "$$WOOCOMMERCE_WEBHOOK_SECRET" -binary | base64) && \
	echo "→ POST /api/v1/webhooks/woocommerce/customers  (customer_id=$$ID)" && \
	curl -s -X POST $(API_URL)/api/v1/webhooks/woocommerce/customers \
		-H "Content-Type: application/json" \
		-H "X-Wc-Webhook-Signature: $$SIG" \
		-d "$$PAYLOAD" | python3 -m json.tool

.PHONY: webhook-woo-order
webhook-woo-order:
	@export $$(grep -v '^#' .env | xargs) && \
	ID=$$(date +%s) && \
	PAYLOAD="{\"id\":$$ID,\"number\":\"$$ID\",\"status\":\"processing\",\"currency\":\"USD\",\"total\":\"99.99\",\"billing\":{\"first_name\":\"Test\",\"last_name\":\"Customer\",\"email\":\"$(EMAIL)\"},\"line_items\":[{\"id\":1,\"product_id\":1,\"name\":\"Test Product\",\"sku\":\"$(SKU)\",\"quantity\":2,\"price\":\"49.99\"}],\"date_created\":\"$$(date -u +%FT%TZ)\",\"date_modified\":\"$$(date -u +%FT%TZ)\"}" && \
	SIG=$$(echo -n "$$PAYLOAD" | openssl dgst -sha256 -hmac "$$WOOCOMMERCE_WEBHOOK_SECRET" -binary | base64) && \
	echo "→ POST /api/v1/webhooks/woocommerce/orders  (order_id=$$ID, sku=$(SKU))" && \
	curl -s -X POST $(API_URL)/api/v1/webhooks/woocommerce/orders \
		-H "Content-Type: application/json" \
		-H "X-Wc-Webhook-Signature: $$SIG" \
		-d "$$PAYLOAD" | python3 -m json.tool


# ── Utilities ────────────────────────────────────────────────

.PHONY: health
health:
	@curl -s $(API_URL)/health | python3 -m json.tool

.PHONY: clean
clean:
	find $(BACKEND_DIR) -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -name "*.pyc" -delete 2>/dev/null || true
	rm -rf $(DASHBOARD_DIR)/.next
	@echo "Cleaned build artifacts."

.PHONY: clean-docker
clean-docker:
	@echo "WARNING: This removes all project containers and volumes."
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	$(DC) down --volumes --remove-orphans


# ── Dashboard tests & auth seed ──────────────────────────────

.PHONY: test-dashboard
test-dashboard:
	cd $(DASHBOARD_DIR) && npm test

.PHONY: test-all
test-all: test test-dashboard

.PHONY: db-seed
db-seed:
	cd $(DASHBOARD_DIR) && npm run db:seed
