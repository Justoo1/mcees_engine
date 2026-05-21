import base64
import hashlib
import hmac

from fastapi import Depends, Header, HTTPException, Request

from app.core.config import Settings, get_settings


def verify_shopify_signature(secret: str, payload_bytes: bytes, header_value: str) -> bool:
    """Validate X-Shopify-Hmac-Sha256 header (base64-encoded HMAC-SHA256)."""
    digest = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    try:
        received = base64.b64decode(header_value)
        return hmac.compare_digest(base64.b64decode(expected), received)
    except Exception:
        return False


def verify_woocommerce_signature(secret: str, payload_bytes: bytes, header_value: str) -> bool:
    """Validate X-WC-Webhook-Signature header (base64-encoded HMAC-SHA256)."""
    digest = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    try:
        received = base64.b64decode(header_value)
        return hmac.compare_digest(base64.b64decode(expected), received)
    except Exception:
        return False


async def verify_shopify_request(
    request: Request,
    x_shopify_hmac_sha256: str = Header(...),
    settings: Settings = Depends(get_settings),
) -> bytes:
    body = await request.body()
    if not verify_shopify_signature(settings.shopify_webhook_secret, body, x_shopify_hmac_sha256):
        raise HTTPException(status_code=401, detail="Invalid Shopify HMAC signature")
    return body


async def verify_woocommerce_request(
    request: Request,
    x_wc_webhook_signature: str = Header(...),
    settings: Settings = Depends(get_settings),
) -> bytes:
    body = await request.body()
    if not verify_woocommerce_signature(
        settings.woocommerce_webhook_secret, body, x_wc_webhook_signature
    ):
        raise HTTPException(status_code=401, detail="Invalid WooCommerce HMAC signature")
    return body
