# Architecture Context - E-Commerce & ERP Sync Engine

## Stack
- **Framework:** Next.js (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Database:** Prisma ORM + PostgreSQL (Metadata cache, event logs)
- **Task Queue & Cache:** Redis + Celery (Python)
- **Service Layer:** Python + FastAPI (Ingestion, background workers, and ERP API handling)

## System Boundaries
- `app/(dashboard)` — Next.js administrative console for monitoring background sync statuses, error tracking, and manual overrides.
- `api/v1/webhooks` — Fast Python API endpoints designed for rapid ingestion of external e-commerce payload triggers.
- `workers/` — Python-based Celery application executing data transformations and Odoo operations.

## Invariants
1. Ingestion endpoints must never execute blocking Odoo API calls directly; payloads must be immediately offloaded to the Redis queue.
2. Inventory adjustments must apply distributed locking mechanisms (via Redis or PostgreSQL advisory locks) to prevent race conditions.
3. Every synced webhook must maintain a state lifecycle log (`Received -> Processing -> Synced` or `Failed`) inside PostgreSQL for audit tracing.