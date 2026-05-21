from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr


class ShopifyAddress(BaseModel):
    model_config = ConfigDict(extra="ignore")

    first_name: str | None = None
    last_name: str | None = None
    address1: str | None = None
    city: str | None = None
    country: str | None = None
    zip: str | None = None
    phone: str | None = None


class ShopifyLineItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    product_id: int | None = None
    variant_id: int | None = None
    sku: str | None = None
    title: str
    quantity: int
    price: Decimal


class ShopifyOrderPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    order_number: int
    email: EmailStr | None = None
    total_price: Decimal
    currency: str
    financial_status: str
    fulfillment_status: str | None = None
    line_items: list[ShopifyLineItem]
    shipping_address: ShopifyAddress | None = None
    billing_address: ShopifyAddress | None = None
    created_at: str
    updated_at: str


class ShopifyInventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    sku: str | None = None
    tracked: bool = True


class ShopifyInventoryLevel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    inventory_item_id: int
    location_id: int
    available: int


class ShopifyProductPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    title: str
    status: str
    variants: list[dict]


class ShopifyCustomerPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    default_address: ShopifyAddress | None = None
    created_at: str
    updated_at: str
