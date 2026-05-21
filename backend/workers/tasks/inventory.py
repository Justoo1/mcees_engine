import logging

import redis as redis_lib

from app.core.config import get_settings
from workers.base import BaseTask, _insert_sync_log, _update_event_status, retry_backoff
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)

LOCK_TTL_SECONDS = 30
LOCK_ACQUIRE_TIMEOUT_SECONDS = 5


@celery_app.task(bind=True, base=BaseTask, name="workers.tasks.inventory.sync_inventory")
def sync_inventory(self, webhook_event_id: str, payload: dict) -> dict:
    sku = payload.get("sku") or (payload.get("variants", [{}])[0] or {}).get("sku")
    if not sku:
        _update_event_status(webhook_event_id, "FAILED")
        _insert_sync_log(webhook_event_id, "No SKU found in payload — cannot sync inventory", "ERROR")
        return {"status": "failed", "reason": "missing_sku"}

    settings = get_settings()
    r = redis_lib.from_url(settings.redis_url)
    lock_key = f"inventory_lock:{sku}"
    lock = r.lock(lock_key, timeout=LOCK_TTL_SECONDS, blocking_timeout=LOCK_ACQUIRE_TIMEOUT_SECONDS)

    acquired = lock.acquire(blocking=True)
    if not acquired:
        delay = retry_backoff(self.request.retries)
        _insert_sync_log(
            webhook_event_id,
            f"Could not acquire lock for SKU {sku}. Retrying in {delay:.1f}s",
            "WARN",
        )
        raise self.retry(exc=Exception(f"Lock contention on SKU {sku}"), countdown=delay)

    try:
        _update_event_status(webhook_event_id, "PROCESSING")
        _insert_sync_log(webhook_event_id, f"Inventory sync started for SKU {sku}")

        from app.services.mappers import map_product
        from app.services.odoo_client import OdooClient

        client = OdooClient(
            settings.odoo_url, settings.odoo_db, settings.odoo_user, settings.odoo_password
        )
        client.authenticate()

        product_vals = map_product(payload)
        product_id = client.find_product_id(sku)

        if product_id is None:
            # Create the product template + product
            create_vals = {
                "name": product_vals["name"],
                "default_code": product_vals["default_code"],
                "active": product_vals.get("active", True),
                "type": "product",  # storable — required for stock.quant tracking
            }
            product_id = client.execute("product.product", "create", [create_vals], {})
            _insert_sync_log(webhook_event_id, f"Created new product ID {product_id} for SKU {sku}")
        else:
            update_vals: dict = {"name": product_vals["name"]}
            if "active" in product_vals:
                update_vals["active"] = product_vals["active"]
            client.execute("product.product", "write", [[product_id], update_vals], {})
            _insert_sync_log(webhook_event_id, f"Updated product ID {product_id} for SKU {sku}")

        # Adjust stock quantity if provided
        qty = product_vals.get("qty_on_hand")
        if qty is not None:
            # Find the main internal stock location
            loc_ids = client.search_ids(
                "stock.location",
                [("usage", "=", "internal"), ("complete_name", "ilike", "WH/Stock")],
            )
            if loc_ids:
                quant_ids = client.search_ids(
                    "stock.quant",
                    [("product_id", "=", product_id), ("location_id", "=", loc_ids[0])],
                )
                if quant_ids:
                    current = client.execute(
                        "stock.quant", "read", [[quant_ids[0]], ["quantity"]], {}
                    )
                    current_qty = current[0]["quantity"] if current else 0
                    new_qty = current_qty + qty
                    client.execute("stock.quant", "write", [[quant_ids[0]], {"quantity": new_qty}], {})
                else:
                    new_qty = qty
                    client.execute("stock.quant", "create", [{
                        "product_id": product_id,
                        "location_id": loc_ids[0],
                        "quantity": new_qty,
                    }], {})
                _insert_sync_log(
                    webhook_event_id,
                    f"Stock adjusted +{qty} units (was {current_qty if quant_ids else 0}, now {new_qty}) for SKU {sku}",
                )

        _update_event_status(webhook_event_id, "SYNCED")
        _insert_sync_log(webhook_event_id, f"Inventory synced for SKU {sku}. Odoo product ID: {product_id}")
        return {"status": "synced", "odoo_id": product_id, "sku": sku}

    except Exception as exc:
        delay = retry_backoff(self.request.retries)
        _insert_sync_log(webhook_event_id, f"Error: {exc}. Retrying in {delay:.1f}s", "WARN")
        raise self.retry(exc=exc, countdown=delay)

    finally:
        try:
            lock.release()
        except redis_lib.exceptions.LockNotOwnedError:
            pass
