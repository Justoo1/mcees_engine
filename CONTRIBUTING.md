# Contributing

A short guide for anyone (including future-me) picking this project back up.

## Layout

```
mcees_engine/
├── backend/         FastAPI + Celery (Python 3.12, uv)
├── dashboard/       Next.js 16 + React 19 + Prisma (TypeScript)
├── docs/            Screenshots, diagrams, ADRs
└── docker-compose.yml
```

## Local dev (one-time)

```bash
make setup        # creates venv, installs deps, copies .env
# edit .env to set ODOO_*, AUTH_SECRET, webhook secrets
make up           # builds + starts all 5 services
make db-migrate   # apply Prisma schema
make db-seed      # create the admin user
```

Then open `http://localhost:3000` and log in as the seed admin.

## Day-to-day

```bash
make logs                 # tail everything
make logs-worker          # just the Celery worker
make restart-worker       # picks up backend code changes
make webhook-shopify-order # fire a test webhook
make db-studio            # browse the DB at :5555
```

## Tests

```bash
make test                 # backend pytest (29 cases)
make test-dashboard       # dashboard vitest (12 cases)
make test-all             # both
```

CI runs both on every push (see `.github/workflows/ci.yml`).

## Code style

- Backend: `ruff` (lint + format), `pyright` (types)
- Frontend: TypeScript strict mode
- Run `make lint` and `make format` before committing

## Commit conventions

Prefer atomic commits with messages in the form:

```
<type>: <short summary>

<longer body explaining the why>
```

Where `<type>` is one of: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.

## Pull request checklist

- [ ] Tests added or updated
- [ ] `make test-all` passes locally
- [ ] No secrets committed (`.env` stays gitignored)
- [ ] Updated `README.md` if user-facing behavior changed
- [ ] Migration added if `schema.prisma` changed

## Adding a new webhook handler

1. Add a Pydantic schema in `backend/app/schemas/`
2. Add a route in `backend/app/api/v1/webhooks/` (use `verify_shopify_request` or `verify_woocommerce_request` as the dep)
3. Add a Celery task in `backend/workers/tasks/`
4. Wire the task name in `app/api/v1/internal.py::_TASK_MAP`
5. Write tests in `backend/tests/test_webhooks.py` and `test_workers.py`

## Adding a new dashboard view

1. Create a component in `dashboard/components/`
2. Add a route entry to the `Route` union in `DashboardApp.tsx`
3. Add a nav item and a render branch
4. If the view needs role gating, check `can.*` from `lib/auth/permissions.ts`
5. If it hits an API, gate the route with `requireRole()` server-side too
