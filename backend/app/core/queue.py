import json
import uuid

from app.core.db import get_pool


async def insert_webhook_event(
    source: str,
    event_type: str,
    external_id: str,
    raw_payload: dict,
) -> str:
    pool = await get_pool()
    event_id = str(uuid.uuid4())
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO "WebhookEvent" (id, source, event_type, external_id, raw_payload, status, created_at, updated_at)
            VALUES ($1, $2::\"WebhookSource\", $3, $4, $5::jsonb, 'RECEIVED'::"WebhookStatus", NOW(), NOW())
            ON CONFLICT (source, external_id) DO UPDATE
                SET status = 'RECEIVED'::"WebhookStatus", updated_at = NOW()
            RETURNING id
            """,
            event_id,
            source,
            event_type,
            external_id,
            json.dumps(raw_payload),
        )
    return str(row["id"])


def enqueue_event(task_name: str, payload: dict, webhook_event_id: str) -> None:
    from workers.celery_app import celery_app

    celery_app.send_task(
        task_name,
        kwargs={"webhook_event_id": webhook_event_id, "payload": payload},
        queue=_queue_for_task(task_name),
    )


def _queue_for_task(task_name: str) -> str:
    if "order" in task_name:
        return "orders"
    if "customer" in task_name:
        return "customers"
    if "inventory" in task_name:
        return "inventory"
    return "orders"
