import json

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.core.hmac_verify import verify_woocommerce_request
from app.core.queue import enqueue_event, insert_webhook_event
from app.schemas.woocommerce import WooCustomerPayload, WooOrderPayload, WooProductPayload

router = APIRouter()


@router.post("/orders", status_code=202)
async def woo_order(body: bytes = Depends(verify_woocommerce_request)):
    payload = WooOrderPayload.model_validate_json(body)
    event_id = await insert_webhook_event(
        source="WOOCOMMERCE",
        event_type="order",
        external_id=str(payload.id),
        raw_payload=json.loads(body),
    )
    enqueue_event("workers.tasks.orders.sync_order", payload.model_dump(mode="json"), event_id)
    return JSONResponse(status_code=202, content={"received": True, "event_id": event_id})


@router.post("/products", status_code=202)
async def woo_product(body: bytes = Depends(verify_woocommerce_request)):
    payload = WooProductPayload.model_validate_json(body)
    event_id = await insert_webhook_event(
        source="WOOCOMMERCE",
        event_type="product",
        external_id=str(payload.id),
        raw_payload=json.loads(body),
    )
    enqueue_event(
        "workers.tasks.inventory.sync_inventory", payload.model_dump(mode="json"), event_id
    )
    return JSONResponse(status_code=202, content={"received": True, "event_id": event_id})


@router.post("/customers", status_code=202)
async def woo_customer(body: bytes = Depends(verify_woocommerce_request)):
    payload = WooCustomerPayload.model_validate_json(body)
    event_id = await insert_webhook_event(
        source="WOOCOMMERCE",
        event_type="customer",
        external_id=str(payload.id),
        raw_payload=json.loads(body),
    )
    enqueue_event(
        "workers.tasks.customers.sync_customer", payload.model_dump(mode="json"), event_id
    )
    return JSONResponse(status_code=202, content={"received": True, "event_id": event_id})
