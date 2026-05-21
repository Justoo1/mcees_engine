import base64
import hashlib
import hmac as hmac_lib

import pytest

from app.core.hmac_verify import verify_shopify_signature, verify_woocommerce_signature


def _make_shopify_header(secret: str, payload: bytes) -> str:
    digest = hmac_lib.new(secret.encode(), payload, hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


class TestShopifyHmac:
    def test_valid_signature(self):
        secret = "test_secret"
        payload = b'{"id": 1}'
        header = _make_shopify_header(secret, payload)
        assert verify_shopify_signature(secret, payload, header) is True

    def test_wrong_secret(self):
        payload = b'{"id": 1}'
        header = _make_shopify_header("correct_secret", payload)
        assert verify_shopify_signature("wrong_secret", payload, header) is False

    def test_tampered_payload(self):
        secret = "test_secret"
        header = _make_shopify_header(secret, b'{"id": 1}')
        assert verify_shopify_signature(secret, b'{"id": 2}', header) is False

    def test_malformed_header(self):
        assert verify_shopify_signature("secret", b"payload", "not-base64!!!") is False

    def test_empty_payload(self):
        secret = "test_secret"
        header = _make_shopify_header(secret, b"")
        assert verify_shopify_signature(secret, b"", header) is True


class TestWooCommerceHmac:
    def test_valid_signature(self):
        secret = "woo_secret"
        payload = b'{"id": 42}'
        digest = hmac_lib.new(secret.encode(), payload, hashlib.sha256).digest()
        header = base64.b64encode(digest).decode()
        assert verify_woocommerce_signature(secret, payload, header) is True

    def test_invalid_signature(self):
        payload = b'{"id": 42}'
        digest = hmac_lib.new(b"other_secret", payload, hashlib.sha256).digest()
        header = base64.b64encode(digest).decode()
        assert verify_woocommerce_signature("woo_secret", payload, header) is False
