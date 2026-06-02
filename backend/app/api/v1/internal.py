import asyncio
import json
import time
from datetime import datetime, timezone

import redis
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.db import get_pool
from app.core.queue import enqueue_event
from app.services.odoo_client import OdooClient, OdooConnectionError

router = APIRouter()

_TASK_MAP = {
    ("order",): "workers.tasks.orders.sync_order",
    ("customer",): "workers.tasks.customers.sync_customer",
    ("product",): "workers.tasks.inventory.sync_inventory",
}

QUEUE_NAMES = ("orders", "customers", "inventory")


def _task_for_event_type(event_type: str) -> str:
    return _TASK_MAP.get((event_type,), "workers.tasks.orders.sync_order")


@router.post("/retry/{event_id}", status_code=202)
async def retry_event(event_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT id, event_type, raw_payload, status FROM "WebhookEvent" WHERE id = $1',
            event_id,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Event not found")

    if row["status"] not in ("FAILED", "RECEIVED"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry event with status {row['status']}",
        )

    task_name = _task_for_event_type(row["event_type"])
    raw = row["raw_payload"]
    payload = json.loads(raw) if isinstance(raw, str) else dict(raw)
    enqueue_event(task_name, payload, event_id)

    return JSONResponse(status_code=202, content={"queued": True, "event_id": event_id})


def _redis_client() -> redis.Redis:
    return redis.Redis.from_url(get_settings().redis_url, socket_timeout=1.0)


def _inspect_workers():
    """Return (active_by_worker, reserved_by_worker, stats_by_worker, active_queues_by_worker).

    All values default to {} on any error so the endpoint never raises on a missing broker."""
    try:
        from workers.celery_app import celery_app

        insp = celery_app.control.inspect(timeout=0.6)
        active = insp.active() or {}
        reserved = insp.reserved() or {}
        stats = insp.stats() or {}
        active_q = insp.active_queues() or {}
        return active, reserved, stats, active_q
    except Exception:
        return {}, {}, {}, {}


@router.get("/queues")
async def queues():
    active, reserved, stats, active_q = await asyncio.to_thread(_inspect_workers)

    def _count(by_worker: dict, queue: str) -> int:
        total = 0
        for worker, tasks in by_worker.items():
            for t in tasks or []:
                if t.get("delivery_info", {}).get("routing_key") == queue:
                    total += 1
                elif queue in worker:
                    total += 1
        return total

    queue_list = []
    r = _redis_client()
    for qname in QUEUE_NAMES:
        try:
            depth = await asyncio.to_thread(r.llen, qname)
        except Exception:
            depth = 0
        queue_list.append(
            {
                "name": qname,
                "depth": int(depth),
                "active": _count(active, qname),
                "reserved": _count(reserved, qname),
            }
        )

    workers_list = []
    for wname in sorted(stats.keys() | active.keys() | active_q.keys()):
        worker_stats = stats.get(wname, {})
        total_done = worker_stats.get("total", {}) if isinstance(worker_stats, dict) else {}
        processed = sum(total_done.values()) if isinstance(total_done, dict) else 0
        worker_queues = [q.get("name") for q in (active_q.get(wname) or []) if q.get("name")]
        workers_list.append(
            {
                "name": wname,
                "queues": worker_queues,
                "active": len(active.get(wname) or []),
                "processed": int(processed),
                "status": "online",
            }
        )

    return {
        "queues": queue_list,
        "workers": workers_list,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def _check_postgres() -> dict:
    start = time.perf_counter()
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await asyncio.wait_for(conn.fetchval("SELECT 1"), timeout=1.5)
        latency = round((time.perf_counter() - start) * 1000, 1)
        return {"ok": True, "latency_ms": latency, "detail": "pool ok"}
    except Exception as exc:
        return {"ok": False, "latency_ms": None, "detail": f"{type(exc).__name__}: {exc}"}


async def _check_redis() -> dict:
    start = time.perf_counter()
    try:
        await asyncio.to_thread(_redis_client().ping)
        latency = round((time.perf_counter() - start) * 1000, 1)
        return {"ok": True, "latency_ms": latency, "detail": "PING"}
    except Exception as exc:
        return {"ok": False, "latency_ms": None, "detail": f"{type(exc).__name__}: {exc}"}


def _celery_ping_sync():
    try:
        from workers.celery_app import celery_app

        return celery_app.control.inspect(timeout=0.6).ping() or []
    except Exception:
        return []


async def _check_celery() -> dict:
    start = time.perf_counter()
    pings = await asyncio.to_thread(_celery_ping_sync)
    latency = round((time.perf_counter() - start) * 1000, 1)
    count = len(pings) if isinstance(pings, (list, dict)) else 0
    if isinstance(pings, dict):
        count = len(pings)
    if count == 0:
        return {"ok": False, "latency_ms": latency, "detail": "no workers responded"}
    return {"ok": True, "latency_ms": latency, "detail": f"{count} worker{'s' if count != 1 else ''}"}


def _odoo_auth_sync(url: str, db: str, user: str, password: str) -> None:
    OdooClient(url, db, user, password).authenticate()


async def _check_odoo() -> dict:
    s = get_settings()
    if not (s.odoo_url and s.odoo_db and s.odoo_user and s.odoo_password):
        return {"ok": True, "latency_ms": None, "detail": "not configured"}
    start = time.perf_counter()
    try:
        await asyncio.wait_for(
            asyncio.to_thread(_odoo_auth_sync, s.odoo_url, s.odoo_db, s.odoo_user, s.odoo_password),
            timeout=3.0,
        )
        latency = round((time.perf_counter() - start) * 1000, 1)
        return {"ok": True, "latency_ms": latency, "detail": "authenticated"}
    except OdooConnectionError as exc:
        return {"ok": False, "latency_ms": None, "detail": str(exc)}
    except asyncio.TimeoutError:
        return {"ok": False, "latency_ms": None, "detail": "auth timed out after 3s"}
    except Exception as exc:
        return {"ok": False, "latency_ms": None, "detail": f"{type(exc).__name__}: {exc}"}


@router.get("/health")
async def deep_health():
    postgres, redis_chk, celery_chk, odoo_chk = await asyncio.gather(
        _check_postgres(), _check_redis(), _check_celery(), _check_odoo()
    )

    if not postgres["ok"] or not redis_chk["ok"]:
        status = "unhealthy"
    elif not celery_chk["ok"] or not odoo_chk["ok"]:
        status = "degraded"
    else:
        status = "healthy"

    return {
        "status": status,
        "checks": {
            "postgres": postgres,
            "redis": redis_chk,
            "celery": celery_chk,
            "odoo": odoo_chk,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
