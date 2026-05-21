import logging

from workers.base import BaseTask, _insert_sync_log, _update_event_status, retry_backoff
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, base=BaseTask, name="workers.tasks.customers.sync_customer")
def sync_customer(self, webhook_event_id: str, payload: dict) -> dict:
    _update_event_status(webhook_event_id, "PROCESSING")
    _insert_sync_log(webhook_event_id, "Customer sync started")

    try:
        from app.core.config import get_settings
        from app.services.mappers import map_partner
        from app.services.odoo_client import OdooClient

        settings = get_settings()
        client = OdooClient(
            settings.odoo_url, settings.odoo_db, settings.odoo_user, settings.odoo_password
        )
        client.authenticate()

        vals = map_partner(payload)

        # Resolve country_id from ISO code if provided
        country_id = None
        if vals.get("country_code"):
            ids = client.search_ids("res.country", [("code", "=", vals["country_code"].upper())])
            country_id = ids[0] if ids else None

        partner_vals: dict = {
            "name": vals["name"],
            "email": vals["email"],
        }
        if vals.get("phone"):
            partner_vals["phone"] = vals["phone"]
        if vals.get("street"):
            partner_vals["street"] = vals["street"]
        if vals.get("city"):
            partner_vals["city"] = vals["city"]
        if vals.get("zip"):
            partner_vals["zip"] = vals["zip"]
        if country_id:
            partner_vals["country_id"] = country_id

        # Upsert by email
        existing_ids = client.search_ids("res.partner", [("email", "=", vals["email"])])
        if existing_ids:
            odoo_id = existing_ids[0]
            client.execute("res.partner", "write", [[odoo_id], partner_vals], {})
        else:
            odoo_id = client.execute("res.partner", "create", [partner_vals], {})

        _update_event_status(webhook_event_id, "SYNCED")
        _insert_sync_log(webhook_event_id, f"Customer synced. Odoo res.partner ID: {odoo_id}")
        return {"status": "synced", "odoo_id": odoo_id}

    except Exception as exc:
        delay = retry_backoff(self.request.retries)
        _insert_sync_log(webhook_event_id, f"Error: {exc}. Retrying in {delay:.1f}s", "WARN")
        raise self.retry(exc=exc, countdown=delay)
