from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr


class WooAddress(BaseModel):
    model_config = ConfigDict(extra="ignore")

    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    address_1: str | None = None
    city: str | None = None
    country: str | None = None
    postcode: str | None = None
    phone: str | None = None


class WooLineItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    product_id: int
    variation_id: int = 0
    sku: str | None = None
    name: str
    quantity: int
    price: Decimal


class WooOrderPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    number: str
    status: str
    currency: str
    total: Decimal
    billing: WooAddress
    shipping: WooAddress | None = None
    line_items: list[WooLineItem]
    date_created: str
    date_modified: str


class WooProductPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    name: str
    status: str
    sku: str | None = None
    stock_quantity: int | None = None
    manage_stock: bool = False


class WooCustomerPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    billing: WooAddress | None = None
    date_created: str
    date_modified: str
