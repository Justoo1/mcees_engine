import pytest
from pydantic import ValidationError

from app.schemas.shopify import ShopifyCustomerPayload, ShopifyOrderPayload, ShopifyProductPayload
from app.schemas.woocommerce import WooCustomerPayload, WooOrderPayload, WooProductPayload

SHOPIFY_ORDER = {
    "id": 1234567890,
    "order_number": 1001,
    "email": "buyer@example.com",
    "total_price": "199.99",
    "currency": "USD",
    "financial_status": "paid",
    "line_items": [
        {"id": 1, "title": "Widget A", "quantity": 2, "price": "99.99", "sku": "WGT-A"}
    ],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T01:00:00Z",
}

WOO_ORDER = {
    "id": 99,
    "number": "99",
    "status": "processing",
    "currency": "USD",
    "total": "49.00",
    "billing": {"first_name": "Jane", "last_name": "Doe"},
    "line_items": [
        {"id": 1, "product_id": 5, "name": "Gadget", "quantity": 1, "price": "49.00", "sku": "GDG-1"}
    ],
    "date_created": "2024-01-01T00:00:00Z",
    "date_modified": "2024-01-01T00:30:00Z",
}


class TestShopifySchemas:
    def test_valid_order(self):
        payload = ShopifyOrderPayload.model_validate(SHOPIFY_ORDER)
        assert payload.id == 1234567890
        assert len(payload.line_items) == 1

    def test_order_ignores_extra_fields(self):
        data = {**SHOPIFY_ORDER, "unknown_field": "ignored"}
        payload = ShopifyOrderPayload.model_validate(data)
        assert not hasattr(payload, "unknown_field")

    def test_order_missing_required_field(self):
        data = {k: v for k, v in SHOPIFY_ORDER.items() if k != "total_price"}
        with pytest.raises(ValidationError):
            ShopifyOrderPayload.model_validate(data)

    def test_valid_customer(self):
        data = {
            "id": 555,
            "email": "test@example.com",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }
        payload = ShopifyCustomerPayload.model_validate(data)
        assert payload.email == "test@example.com"

    def test_customer_invalid_email(self):
        data = {
            "id": 555,
            "email": "not-an-email",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }
        with pytest.raises(ValidationError):
            ShopifyCustomerPayload.model_validate(data)


class TestWooSchemas:
    def test_valid_order(self):
        payload = WooOrderPayload.model_validate(WOO_ORDER)
        assert payload.id == 99

    def test_order_missing_billing(self):
        data = {k: v for k, v in WOO_ORDER.items() if k != "billing"}
        with pytest.raises(ValidationError):
            WooOrderPayload.model_validate(data)

    def test_valid_product(self):
        payload = WooProductPayload.model_validate(
            {"id": 1, "name": "Widget", "status": "publish", "sku": "WGT-1"}
        )
        assert payload.sku == "WGT-1"
