# Product Context - E-Commerce & ERP Sync Engine

## Overview
A production-grade, asynchronous synchronization middleware designed to bridge real-time sales, customer data, and inventory balances between external e-commerce platforms (e.g., Shopify, WooCommerce) and an internal Odoo ERP instance. The system ensures operational consistency across sales channels while shielding the ERP from high-frequency webhook spikes.

## Goals
1. Automate inventory and sales record syncing between consumer storefronts and central accounting/warehouse systems.
2. Maintain high system availability and zero data loss during high-traffic flash sales.
3. Provide full visibility into the synchronization pipeline via a centralized administrative dashboard.

## Features
- **Asynchronous Webhook Ingestion:** Fast, secure endpoints to capture incoming payload bursts, immediately queuing them to maintain an ultra-low response latency.
- **Resilient Distributed Worker Pipeline:** Background task consumers handling queue processing, structured payloads translation, and Odoo XML-RPC communication.
- **Conflict & Concurrency Resolver:** System checks to handle inventory race conditions and lock resources during simultaneous updates.

## Scope
### In Scope
- Webhook endpoints supporting validation (HMAC signature verification).
- Celery worker orchestration with exponential backoff retries.
- Odoo model mapper for `sale.order`, `res.partner`, and `product.product`.
- Administrative Next.js tracking dashboard.

### Out of Scope
- Creating custom front-facing e-commerce shopping carts or checkouts.
- Syncing payroll, HR, or non-supply-chain Odoo models.