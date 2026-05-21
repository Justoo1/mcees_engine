import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.core.db import get_pool
from app.core.queue import enqueue_event

router = APIRouter()

_TASK_MAP = {
    ("order",): "workers.tasks.orders.sync_order",
    ("customer",): "workers.tasks.customers.sync_customer",
    ("product",): "workers.tasks.inventory.sync_inventory",
}


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
