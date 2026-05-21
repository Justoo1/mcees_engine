import base64
import hashlib
import hmac as hmac_lib
import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings


def make_shopify_header(secret: str, payload: bytes) -> str:
    digest = hmac_lib.new(secret.encode(), payload, hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


TEST_SETTINGS = Settings(
    postgres_url="postgresql://test:test@localhost/test",
    redis_url="redis://localhost:6379/0",
    odoo_url="http://localhost:8069",
    odoo_db="test",
    odoo_user="admin",
    odoo_password="admin",
    shopify_webhook_secret="test_shopify_secret",
    woocommerce_webhook_secret="test_woo_secret",
)

SHOPIFY_ORDER_PAYLOAD = {
    "id": 9999,
    "order_number": 9999,
    "email": "test@example.com",
    "total_price": "50.00",
    "currency": "USD",
    "financial_status": "paid",
    "line_items": [{"id": 1, "title": "Item", "quantity": 1, "price": "50.00", "sku": "TEST-1"}],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
}


@pytest.fixture
def client():
    with (
        patch("app.core.config.get_settings", return_value=TEST_SETTINGS),
        patch("app.core.db.get_pool", new_callable=AsyncMock),
        patch("app.core.queue.insert_webhook_event", new_callable=AsyncMock, return_value="evt-123"),
        patch("app.core.queue.enqueue_event"),
    ):
        from app.main import app
        yield TestClient(app, raise_server_exceptions=True)


def test_health(client: TestClient):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_shopify_order_valid_hmac(client: TestClient):
    body = json.dumps(SHOPIFY_ORDER_PAYLOAD).encode()
    header = make_shopify_header(TEST_SETTINGS.shopify_webhook_secret, body)

    resp = client.post(
        "/api/v1/webhooks/shopify/orders",
        content=body,
        headers={"x-shopify-hmac-sha256": header, "content-type": "application/json"},
    )
    assert resp.status_code == 202
    assert resp.json()["received"] is True


def test_shopify_order_invalid_hmac(client: TestClient):
    body = json.dumps(SHOPIFY_ORDER_PAYLOAD).encode()
    resp = client.post(
        "/api/v1/webhooks/shopify/orders",
        content=body,
        headers={"x-shopify-hmac-sha256": "bad_signature", "content-type": "application/json"},
    )
    assert resp.status_code == 401


def test_shopify_order_missing_hmac_header(client: TestClient):
    body = json.dumps(SHOPIFY_ORDER_PAYLOAD).encode()
    resp = client.post(
        "/api/v1/webhooks/shopify/orders",
        content=body,
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 422
