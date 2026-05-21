import logging

from workers.base import BaseTask, _insert_sync_log, _update_event_status, retry_backoff
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, base=BaseTask, name="workers.tasks.orders.sync_order")
def sync_order(self, webhook_event_id: str, payload: dict) -> dict:
    _update_event_status(webhook_event_id, "PROCESSING")
    _insert_sync_log(webhook_event_id, "Order sync started")

    try:
        from app.core.config import get_settings
        from app.services.mappers import map_order
        from app.services.odoo_client import OdooClient

        settings = get_settings()
        client = OdooClient(
            settings.odoo_url, settings.odoo_db, settings.odoo_user, settings.odoo_password
        )
        client.authenticate()

        order_vals = map_order(payload)

        # Resolve partner
        partner_id = client.find_or_create_partner(
            name=order_vals.get("partner_email", ""),
            email=order_vals.get("partner_email", ""),
        )

        # Resolve order lines — only include lines where product is found in Odoo
        line_commands = []
        skipped_lines = []
        for line in order_vals.get("order_line", []):
            product_id = client.find_product_id(line.get("product_default_code", ""))
            if product_id:
                line_commands.append((0, 0, {
                    "product_id": product_id,
                    "name": line["name"],
                    "product_uom_qty": line["product_uom_qty"],
                    "price_unit": line["price_unit"],
                }))
            else:
                sku = line.get("product_default_code") or "no-sku"
                skipped_lines.append(f"{line['name']} (SKU: {sku})")

        if skipped_lines:
            _insert_sync_log(
                webhook_event_id,
                f"Skipped {len(skipped_lines)} line(s) — no matching Odoo product: {', '.join(skipped_lines)}",
                "WARN",
            )

        # Upsert: update if order ref already exists, else create
        existing_ids = client.search_ids(
            "sale.order", [("client_order_ref", "=", order_vals["client_order_ref"])]
        )

        if existing_ids:
            odoo_id = existing_ids[0]
            # Only update draft orders — confirmed orders should not be modified
            order_state = client.execute(
                "sale.order", "read", [[odoo_id], ["state"]], {}
            )
            if order_state and order_state[0].get("state") == "draft":
                client.execute("sale.order", "write", [[odoo_id], {
                    "partner_id": partner_id,
                    "order_line": line_commands,
                }], {})
        else:
            currency_id = client.find_currency_id(order_vals.get("currency_id_name", "USD"))
            create_vals: dict = {
                "partner_id": partner_id,
                "client_order_ref": order_vals["client_order_ref"],
            }
            if line_commands:
                create_vals["order_line"] = line_commands
            if currency_id:
                create_vals["currency_id"] = currency_id
            odoo_id = client.execute("sale.order", "create", [create_vals], {})

            # Confirm the order so stock is reserved and a delivery is created
            try:
                client.execute_void("sale.order", "action_confirm", [[odoo_id]])
                _insert_sync_log(webhook_event_id, f"Order {odoo_id} confirmed — delivery created")
            except Exception as confirm_exc:
                _insert_sync_log(
                    webhook_event_id,
                    f"Order created but auto-confirm failed: {confirm_exc}",
                    "WARN",
                )

        _update_event_status(webhook_event_id, "SYNCED")
        _insert_sync_log(webhook_event_id, f"Order synced. Odoo sale.order ID: {odoo_id}")
        return {"status": "synced", "odoo_id": odoo_id}

    except Exception as exc:
        delay = retry_backoff(self.request.retries)
        _insert_sync_log(webhook_event_id, f"Error: {exc}. Retrying in {delay:.1f}s", "WARN")
        raise self.retry(exc=exc, countdown=delay)
