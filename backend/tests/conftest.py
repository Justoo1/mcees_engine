"""Test-wide setup.

Ensures pydantic-settings finds the env vars it requires, regardless of CWD
or whether a `.env` file is present (e.g. in CI).
"""
import os

_DEFAULTS = {
    "POSTGRES_URL": "postgresql://test:test@localhost:5432/test",
    "REDIS_URL": "redis://localhost:6379/0",
    "ODOO_URL": "http://localhost:8069",
    "ODOO_DB": "test_db",
    "ODOO_USER": "admin@example.com",
    "ODOO_PASSWORD": "test_password",
    "SHOPIFY_WEBHOOK_SECRET": "test_shopify_secret",
    "WOOCOMMERCE_WEBHOOK_SECRET": "test_woo_secret",
}

for key, value in _DEFAULTS.items():
    os.environ.setdefault(key, value)
