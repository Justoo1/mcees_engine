from unittest.mock import MagicMock, patch

import pytest

from app.services.odoo_client import OdooClient, OdooConnectionError


class TestOdooClient:
    def test_authenticate_success(self):
        client = OdooClient("http://odoo:8069", "db", "admin", "pass")
        mock_proxy = MagicMock()
        mock_proxy.authenticate.return_value = 1
        with patch("xmlrpc.client.ServerProxy", return_value=mock_proxy):
            uid = client.authenticate()
        assert uid == 1
        assert client._uid == 1

    def test_authenticate_caches_uid(self):
        client = OdooClient("http://odoo:8069", "db", "admin", "pass")
        client._uid = 42
        uid = client.authenticate()
        assert uid == 42

    def test_authenticate_failure_raises(self):
        client = OdooClient("http://odoo:8069", "db", "admin", "wrongpass")
        mock_proxy = MagicMock()
        mock_proxy.authenticate.return_value = False
        with patch("xmlrpc.client.ServerProxy", return_value=mock_proxy):
            with pytest.raises(OdooConnectionError, match="authentication failed"):
                client.authenticate()

    def test_execute_calls_xmlrpc(self):
        client = OdooClient("http://odoo:8069", "db", "admin", "pass")
        client._uid = 1
        mock_proxy = MagicMock()
        mock_proxy.execute_kw.return_value = 99
        with patch("xmlrpc.client.ServerProxy", return_value=mock_proxy):
            result = client.execute("sale.order", "create", [{"name": "S1"}], {})
        assert result == 99

    def test_execute_timeout_raises_odoo_error(self):
        import socket
        client = OdooClient("http://odoo:8069", "db", "admin", "pass")
        client._uid = 1
        mock_proxy = MagicMock()
        mock_proxy.execute_kw.side_effect = socket.timeout("timed out")
        with patch("xmlrpc.client.ServerProxy", return_value=mock_proxy):
            with pytest.raises(OdooConnectionError, match="timed out"):
                client.execute("sale.order", "create", [], {})


class TestRetryBackoff:
    def test_backoff_grows_exponentially(self):
        from workers.base import retry_backoff
        # Remove jitter for comparison by seeding random — just verify base values
        import random
        random.seed(0)
        val0 = retry_backoff(0)
        val1 = retry_backoff(1)
        val2 = retry_backoff(2)
        # Base is 2^attempt; with jitter each is at least 2^attempt
        assert val0 >= 1   # 2^0 = 1
        assert val1 >= 2   # 2^1 = 2
        assert val2 >= 4   # 2^2 = 4
