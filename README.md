# MULTI-CHANNEL E-COMMERCE & ERP SYNC ENGINE (mcees engine)

> A production-grade async integration middleware that bridges Shopify and WooCommerce webhooks to an Odoo 17 ERP — built to handle high-frequency event spikes without overwhelming the ERP backend.

---

## Overview

E-commerce platforms fire webhooks in bursts: a flash sale can generate hundreds of order events per minute. Sending each one directly to an ERP via synchronous XML-RPC would saturate the connection pool, produce cascading timeouts, and leave orders unsynced with no visibility into what failed or why.

**mcees_engine** solves this with a decoupled async pipeline:

1. A **FastAPI** ingestion layer validates HMAC signatures, writes an audit record, and immediately returns `202 Accepted`
2. Events are pushed onto a **Redis-backed Celery** queue, smoothing out traffic spikes
3. Dedicated workers process each event type — orders, customers, inventory — against **Odoo 17 via XML-RPC**, with exponential backoff retries and distributed locking for concurrent writes
4. A **Next.js** admin dashboard gives real-time visibility into every event: status, raw payload, full sync log, and a one-click retry button

```
Shopify / WooCommerce
        │  HTTPS webhook
        ▼
┌─────────────────┐     INSERT row      ┌──────────────┐
│   FastAPI API   │ ──────────────────► │  PostgreSQL  │
│  HMAC verify    │                     │  WebhookEvent│
│  202 Accepted   │                     │  SyncLog     │
└────────┬────────┘                     └──────────────┘
         │ enqueue task                        ▲
         ▼                                     │ write status
┌─────────────────┐                     ┌──────┴───────┐
│     Redis       │ ──── consume ──────►│    Celery    │
│  (task broker)  │                     │   Workers    │
└─────────────────┘                     └──────┬───────┘
                                               │ XML-RPC
                                               ▼
                                        ┌─────────────┐
                                        │   Odoo 17   │
                                        │  sale.order │
                                        │  res.partner│
                                        │  stock.quant│
                                        └─────────────┘
                                               ▲
                                    ┌──────────┴──────────┐
                                    │  Next.js Dashboard  │
                                    │  Live sync timeline │
                                    │  KPI stat cards     │
                                    │  Event detail drawer│
                                    └─────────────────────┘
```

---

## Key Engineering Decisions

### HMAC Signature Verification
Every inbound webhook is verified before any processing begins. Shopify uses `X-Shopify-Hmac-Sha256` (HMAC-SHA256, base64-encoded); WooCommerce uses `X-Wc-Webhook-Signature`. Both use `hmac.compare_digest` to prevent timing attacks. Requests that fail verification are rejected with `401` before touching the database.

### Idempotent Event Ingestion
The `WebhookEvent` table has a `UNIQUE(source, external_id)` constraint. The insert uses `ON CONFLICT DO UPDATE … RETURNING id` so duplicate deliveries (Shopify re-sends on non-2xx) are handled gracefully — no duplicate orders in Odoo, no FK violations in the sync log.

### Exponential Backoff with Full Jitter
Workers inherit from `BaseTask`, which implements retry logic as `2^attempt + random(0, 1)` seconds. This spreads retry storms across time, preventing a wave of failed tasks from hammering Odoo simultaneously after it recovers from downtime. Max 5 retries; permanent failures flip the event status to `FAILED` and write an ERROR log entry.

### Distributed Lock on Inventory Writes
Concurrent webhooks for the same SKU could produce a race condition on `stock.quant`. The inventory worker acquires a Redis lock keyed on `inventory_lock:{sku}` with a 30-second TTL before touching Odoo. If the lock can't be acquired within 5 seconds, the task self-retries with backoff rather than blocking the worker thread.

### Additive Stock Adjustments
Incoming product webhooks carry a quantity delta, not an absolute target. The worker reads the current `stock.quant.quantity`, adds the incoming value, and writes the new total — so two concurrent receipts of 30 units each correctly land at +60, not at 30.

### Strict SKU-Only Matching
Products are resolved in Odoo by `default_code` (internal reference / SKU) only. There is no fuzzy name matching. Order lines with no matching SKU are skipped and logged as warnings rather than blocking the whole order. This makes data integrity issues visible without causing silent failures.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | Python 3.11, FastAPI, uvicorn |
| Task queue | Celery 5, Redis 7 |
| Database | PostgreSQL 16 (asyncpg in API, psycopg2 in workers) |
| ORM (dashboard) | Prisma ORM (TypeScript) |
| ERP integration | Odoo 17 XML-RPC (`xmlrpc.client`) |
| Dashboard | Next.js 14 (App Router), TypeScript, Tailwind CSS, SWR |
| Containerisation | Docker, Docker Compose |
| Packaging | uv, Hatchling (PEP 517) |
| Linting / types | Ruff, Pyright (backend) · TypeScript strict mode (frontend) |
| Testing | pytest, pytest-asyncio, pytest-mock |

---

## Project Structure

```
mcees_engine/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── webhooks/
│   │   │   │   ├── shopify.py          # Shopify order / product / customer endpoints
│   │   │   │   └── woocommerce.py      # WooCommerce mirror endpoints
│   │   │   └── internal.py             # Retry endpoint called by dashboard
│   │   ├── core/
│   │   │   ├── config.py               # pydantic-settings env config
│   │   │   ├── db.py                   # asyncpg connection pool
│   │   │   ├── hmac_verify.py          # HMAC dependency for FastAPI
│   │   │   └── queue.py                # idempotent event insert + Celery enqueue
│   │   ├── schemas/
│   │   │   ├── shopify.py              # Pydantic models for Shopify payloads
│   │   │   └── woocommerce.py          # Pydantic models for WooCommerce payloads
│   │   └── services/
│   │       ├── odoo_client.py          # XML-RPC client with timeout handling
│   │       └── mappers.py              # Payload → Odoo field dict transformations
│   ├── workers/
│   │   ├── celery_app.py               # Celery app + broker config
│   │   ├── base.py                     # BaseTask: retry/backoff/failure hooks
│   │   └── tasks/
│   │       ├── orders.py               # sale.order upsert + auto-confirm
│   │       ├── customers.py            # res.partner upsert by email
│   │       └── inventory.py            # stock.quant additive update + Redis lock
│   └── tests/
│       ├── test_hmac.py
│       ├── test_schemas.py
│       ├── test_mappers.py
│       ├── test_webhooks.py
│       └── test_workers.py
├── dashboard/
│   ├── app/
│   │   ├── (dashboard)/page.tsx        # Main dashboard page
│   │   └── api/sync-events/            # Next.js API routes
│   │       ├── route.ts                # GET list (paginated, filterable)
│   │       ├── [id]/route.ts           # GET event detail + logs
│   │       ├── [id]/retry/route.ts     # POST retry trigger
│   │       └── stats/route.ts          # GET KPI aggregates
│   ├── components/
│   │   ├── SyncTimeline.tsx            # Live auto-refresh event grid
│   │   ├── StatsBar.tsx                # KPI stat cards (24h)
│   │   ├── EventDrawer.tsx             # Slide-out detail + retry button
│   │   └── StatusChip.tsx              # Colour-coded status badge
│   └── prisma/
│       └── schema.prisma               # WebhookEvent + SyncLog models
├── docker-compose.yml                  # All 5 services wired together
├── Makefile                            # Dev workflow commands
└── .env.example
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- `make`
- `curl` and `openssl` (for webhook testing)

### 1. Clone and configure

```bash
git clone https://github.com/your-username/mcees_engine.git
cd mcees_engine
make env          # copies .env.example → .env
```

Open `.env` and fill in your Odoo connection details and webhook secrets:

```env
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your_database
ODOO_USER=admin@example.com
ODOO_PASSWORD=your_password

SHOPIFY_WEBHOOK_SECRET=your_shopify_secret
WOOCOMMERCE_WEBHOOK_SECRET=your_woocommerce_secret
```

### 2. Start all services

```bash
make up
```

This builds and starts five containers: `postgres`, `redis`, `api`, `worker`, and `dashboard`. The dashboard runs Prisma migrations automatically on startup.

### 3. Verify

```bash
make health        # → {"status": "ok"}
```

Open [http://localhost:3000](http://localhost:3000) for the admin dashboard.

---

## Testing Webhooks Locally

The Makefile includes targets that generate a valid HMAC signature and fire a realistic payload at the local API. Every run uses a Unix timestamp as the external ID so each call creates a fresh event.

```bash
# Shopify order (override SKU and email)
make webhook-shopify-order SKU=TSHIRT-BLK-M EMAIL=test@example.com

# Shopify inventory receipt (+30 units added to current On Hand)
make webhook-shopify-product SKU=TSHIRT-BLK-M QTY=30

# Shopify customer upsert
make webhook-shopify-customer

# WooCommerce order
make webhook-woo-order SKU=TSHIRT-BLK-M

# WooCommerce customer
make webhook-woo-customer
```

Watch the worker process events in real time:

```bash
make logs-worker
```

---

## Dashboard Features

| Feature | Detail |
|---|---|
| **Live sync timeline** | Auto-refreshes every 5 seconds via SWR; filterable by source and status |
| **KPI cards** | Total events, synced, failed, and average processing time — all scoped to the last 24 hours |
| **Event detail drawer** | Raw JSON payload, full timestamped sync log with INFO / WARN / ERROR levels |
| **Retry button** | Re-enqueues any `FAILED` event with one click; shows disabled "Retrying…" state while processing |
| **Pagination** | 20 events per page with prev / next controls |

---

## Development Commands

```bash
make setup              # Bootstrap venv, node_modules, and .env
make up                 # Build and start all services (detached)
make down               # Stop all containers
make restart-worker     # Restart Celery worker (picks up code changes)
make logs               # Tail logs from all services
make test               # Run pytest suite
make test-cov           # Run tests with coverage report
make lint               # Ruff lint check
make format             # Ruff auto-format
make typecheck          # Pyright type check
make db-studio          # Open Prisma Studio on port 5555
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ODOO_URL` | Odoo base URL (e.g. `https://mycompany.odoo.com`) |
| `ODOO_DB` | Odoo database name |
| `ODOO_USER` | Odoo login email |
| `ODOO_PASSWORD` | Odoo API key or password |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify webhook signing secret |
| `WOOCOMMERCE_WEBHOOK_SECRET` | WooCommerce webhook signing secret |
| `MAX_PAYLOAD_BYTES` | Max accepted body size (default: 1 MB) |

---

## How Order Sync Works

1. Webhook arrives → HMAC verified → `WebhookEvent` row inserted with `status=RECEIVED` → `202` returned to platform
2. `sync_order` task picks up from Redis queue → status set to `PROCESSING`
3. Partner resolved by email (`res.partner` — create if not found)
4. Each line item looked up by SKU (`product.product.default_code`); unmatched SKUs are skipped and logged
5. Order upserted: if a `sale.order` with matching `client_order_ref` exists and is still in Draft, it is updated; otherwise a new order is created
6. New orders are immediately confirmed (`action_confirm`) so Odoo reserves stock and generates a delivery
7. Status set to `SYNCED`; full log written

On any exception the task retries up to 5 times with exponential backoff. After max retries, `on_failure` sets `status=FAILED` and writes an ERROR log — surfaced in the dashboard for manual retry.

---

## License

MIT
