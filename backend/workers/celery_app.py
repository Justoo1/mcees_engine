from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "mcees_workers",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "workers.tasks.orders",
        "workers.tasks.customers",
        "workers.tasks.inventory",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "workers.tasks.orders.*": {"queue": "orders"},
        "workers.tasks.customers.*": {"queue": "customers"},
        "workers.tasks.inventory.*": {"queue": "inventory"},
    },
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
