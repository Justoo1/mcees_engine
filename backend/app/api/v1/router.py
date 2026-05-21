from fastapi import APIRouter

from app.api.v1.internal import router as internal_router
from app.api.v1.webhooks.shopify import router as shopify_router
from app.api.v1.webhooks.woocommerce import router as woocommerce_router

router = APIRouter()
router.include_router(shopify_router, prefix="/webhooks/shopify", tags=["shopify"])
router.include_router(woocommerce_router, prefix="/webhooks/woocommerce", tags=["woocommerce"])
router.include_router(internal_router, prefix="/internal", tags=["internal"])
