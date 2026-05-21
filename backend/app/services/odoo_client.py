import socket
import xmlrpc.client
from typing import Any


class OdooConnectionError(Exception):
    pass


class OdooClient:
    def __init__(self, url: str, db: str, user: str, password: str) -> None:
        self._url = url.rstrip("/")
        self._db = db
        self._user = user
        self._password = password
        self._uid: int | None = None

    def authenticate(self) -> int:
        if self._uid is not None:
            return self._uid
        try:
            proxy = xmlrpc.client.ServerProxy(
                f"{self._url}/xmlrpc/2/common", allow_none=True
            )
            uid = proxy.authenticate(self._db, self._user, self._password, {})
            if not uid:
                raise OdooConnectionError("Odoo authentication failed — check credentials")
            self._uid = uid
            return uid
        except (socket.timeout, ConnectionRefusedError, OSError) as exc:
            raise OdooConnectionError(f"Cannot reach Odoo at {self._url}: {exc}") from exc
        except xmlrpc.client.Fault as exc:
            raise OdooConnectionError(f"Odoo XML-RPC fault during auth: {exc}") from exc

    def execute(
        self,
        model: str,
        method: str,
        args: list,
        kwargs: dict,
        timeout: int = 30,
    ) -> Any:
        if self._uid is None:
            self.authenticate()
        try:
            transport = xmlrpc.client.SafeTransport()
            transport.timeout = timeout  # type: ignore[attr-defined]
            proxy = xmlrpc.client.ServerProxy(
                f"{self._url}/xmlrpc/2/object",
                transport=transport,
                allow_none=True,
            )
            return proxy.execute_kw(self._db, self._uid, self._password, model, method, args, kwargs)
        except socket.timeout as exc:
            raise OdooConnectionError(f"Odoo call timed out after {timeout}s: {exc}") from exc
        except (ConnectionRefusedError, OSError) as exc:
            raise OdooConnectionError(f"Odoo connection error: {exc}") from exc
        except xmlrpc.client.Fault as exc:
            raise OdooConnectionError(f"Odoo XML-RPC fault: {exc}") from exc

    def execute_void(self, model: str, method: str, args: list, timeout: int = 30) -> None:
        """Call a method that may return None — swallows the marshal-None XML-RPC error."""
        try:
            self.execute(model, method, args, {}, timeout=timeout)
        except Exception as exc:
            if "cannot marshal None" not in str(exc):
                raise

    def search_ids(self, model: str, domain: list) -> list[int]:
        return self.execute(model, "search", [domain], {}) or []

    def find_or_create_partner(self, name: str, email: str) -> int:
        """Return existing partner ID by email, or create a new one."""
        if email:
            ids = self.search_ids("res.partner", [("email", "=", email)])
            if ids:
                return ids[0]
        vals: dict = {"name": name or email}
        if email:
            vals["email"] = email
        return self.execute("res.partner", "create", [vals], {})

    def find_currency_id(self, name: str) -> int | None:
        """Return currency ID by ISO code (e.g. 'USD'), or None if not found."""
        ids = self.search_ids("res.currency", [("name", "=", name)])
        return ids[0] if ids else None

    def find_product_id(self, sku: str) -> int | None:
        """Return product.product ID by internal reference (SKU), or None."""
        if not sku:
            return None
        ids = self.search_ids("product.product", [("default_code", "=", sku)])
        return ids[0] if ids else None
