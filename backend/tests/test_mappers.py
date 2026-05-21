import pytest

from app.services.mappers import map_order, map_partner, map_product


class TestMapOrder:
    def test_shopify_order(self):
        payload = {
            "id": 1001,
            "order_number": 1001,
            "email": "buyer@example.com",
            "total_price": "99.00",
            "currency": "GBP",
            "line_items": [
                {"title": "Widget", "quantity": 1, "price": "99.00", "sku": "WGT-1"}
            ],
        }
        result = map_order(payload)
        assert result["client_order_ref"] == "1001"
        assert result["currency_id_name"] == "GBP"
        assert len(result["order_line"]) == 1
        assert result["order_line"][0]["product_default_code"] == "WGT-1"

    def test_woo_order(self):
        payload = {
            "id": 42,
            "number": "ORD-42",
            "total": "20.00",
            "currency": "EUR",
            "billing": {"email": "woo@example.com"},
            "line_items": [],
        }
        result = map_order(payload)
        assert result["client_order_ref"] == "ORD-42"
        assert result["partner_email"] == "woo@example.com"


class TestMapPartner:
    def test_shopify_customer(self):
        payload = {
            "id": 99,
            "email": "jane@example.com",
            "first_name": "Jane",
            "last_name": "Doe",
            "default_address": {"address1": "123 Main St", "city": "London", "zip": "EC1A"},
        }
        result = map_partner(payload)
        assert result["name"] == "Jane Doe"
        assert result["email"] == "jane@example.com"
        assert result["street"] == "123 Main St"

    def test_name_fallback_to_email(self):
        payload = {"id": 1, "email": "anon@example.com"}
        result = map_partner(payload)
        assert result["name"] == "anon@example.com"


class TestMapProduct:
    def test_shopify_product_with_sku(self):
        payload = {
            "id": 7,
            "title": "Blue Widget",
            "status": "active",
            "variants": [{"sku": "BLU-WGT", "inventory_quantity": 50}],
        }
        result = map_product(payload)
        assert result["default_code"] == "BLU-WGT"
        assert result["qty_on_hand"] == 50
        assert result["active"] is True

    def test_woo_product_with_sku(self):
        payload = {"id": 3, "name": "Red Widget", "status": "publish", "sku": "RED-WGT", "stock_quantity": 10}
        result = map_product(payload)
        assert result["default_code"] == "RED-WGT"
        assert result["qty_on_hand"] == 10

    def test_missing_sku_raises(self):
        payload = {"id": 5, "title": "No-SKU Product", "variants": [{"sku": ""}]}
        with pytest.raises(ValueError, match="no SKU"):
            map_product(payload)

    def test_completely_missing_sku_raises(self):
        payload = {"id": 6, "name": "No SKU at all"}
        with pytest.raises(ValueError):
            map_product(payload)
