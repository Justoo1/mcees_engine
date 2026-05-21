import logging
import random

import psycopg2
from celery import Task

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def retry_backoff(attempt: int) -> float:
    """Exponential backoff with full jitter: 2^attempt + random(0, 1) seconds."""
    return (2**attempt) + random.uniform(0, 1)


def _get_sync_conn():
    settings = get_settings()
    return psycopg2.connect(settings.postgres_url)


def _update_event_status(webhook_event_id: str, status: str) -> None:
    conn = _get_sync_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE "WebhookEvent" SET status = %s::"WebhookStatus", updated_at = NOW() WHERE id = %s',
                (status, webhook_event_id),
            )
        conn.commit()
    finally:
        conn.close()


def _insert_sync_log(webhook_event_id: str, message: str, level: str = "INFO") -> None:
    conn = _get_sync_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "SyncLog" (id, webhook_event_id, message, level, created_at) '
                'VALUES (gen_random_uuid(), %s, %s, %s::"LogLevel", NOW())',
                (webhook_event_id, message, level),
            )
        conn.commit()
    finally:
        conn.close()


class BaseTask(Task):
    abstract = True
    max_retries = 5

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        attempt = self.request.retries
        webhook_event_id = kwargs.get("webhook_event_id")
        delay = retry_backoff(attempt)
        logger.warning(f"Task {self.name} retry {attempt}/{self.max_retries} in {delay:.1f}s: {exc}")
        if webhook_event_id:
            _insert_sync_log(
                webhook_event_id,
                f"Retry {attempt}/{self.max_retries}: {exc}. Next attempt in {delay:.1f}s",
                "WARN",
            )

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        webhook_event_id = kwargs.get("webhook_event_id")
        logger.error(f"Task {self.name} permanently failed: {exc}")
        if webhook_event_id:
            _update_event_status(webhook_event_id, "FAILED")
            _insert_sync_log(webhook_event_id, f"Permanent failure: {exc}", "ERROR")
