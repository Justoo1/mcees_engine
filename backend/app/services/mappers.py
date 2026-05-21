from decimal import Decimal


def map_order(payload: dict) -> dict:
    """Map a Shopify or WooCommerce order payload to an Odoo sale.order field dict."""
    # Normalize across Shopify (id/order_number) and WooCommerce (id/number)
    external_id = str(payload.get("id", ""))
    order_ref = str(payload.get("order_number") or payload.get("number") or external_id)
    email = payload.get("email") or (payload.get("billing") or {}).get("email", "")

    lines = []
    for item in payload.get("line_items", []):
        sku = item.get("sku") or ""
        lines.append(
            {
                "product_default_code": sku,
                "name": item.get("title") or item.get("name", ""),
                "product_uom_qty": item.get("quantity", 1),
                "price_unit": float(item.get("price", 0)),
            }
        )

    return {
        "client_order_ref": order_ref,
        "x_external_id": external_id,
        "partner_email": email,
        "currency_id_name": payload.get("currency", "USD"),
        "amount_total": float(payload.get("total_price") or payload.get("total") or 0),
        "order_line": lines,
    }


def map_partner(payload: dict) -> dict:
    """Map a Shopify or WooCommerce customer payload to an Odoo res.partner field dict."""
    address = payload.get("default_address") or payload.get("billing") or {}
    return {
        "x_external_id": str(payload.get("id", "")),
        "email": payload.get("email", ""),
        "name": " ".join(
            filter(None, [payload.get("first_name"), payload.get("last_name")])
        ).strip() or payload.get("email", ""),
        "phone": payload.get("phone") or address.get("phone", ""),
        "street": address.get("address1") or address.get("address_1", ""),
        "city": address.get("city", ""),
        "zip": address.get("zip") or address.get("postcode", ""),
        "country_code": address.get("country", ""),
    }


def map_product(payload: dict) -> dict:
    """Map a Shopify or WooCommerce product/inventory payload to an Odoo product.product field dict.

    Raises ValueError if no SKU (default_code) is present — strict SKU-only matching enforced.
    """
    # Shopify products nest SKU inside variants; WooCommerce has top-level sku
    sku = payload.get("sku")
    if not sku:
        variants = payload.get("variants", [])
        if variants:
            sku = variants[0].get("sku")

    if not sku:
        raise ValueError(
            f"Product payload (id={payload.get('id')}) has no SKU — "
            "strict SKU-only matching requires a non-empty SKU"
        )

    stock_qty = payload.get("stock_quantity")
    if stock_qty is None and payload.get("variants"):
        stock_qty = payload["variants"][0].get("inventory_quantity")

    return {
        "default_code": sku,
        "name": payload.get("title") or payload.get("name", ""),
        "x_external_id": str(payload.get("id", "")),
        "qty_on_hand": int(stock_qty) if stock_qty is not None else None,
        "active": payload.get("status", "active") == "active",
    }
