import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/permissions'

type Source    = 'SHOPIFY' | 'WOOCOMMERCE'
type EventType = 'order' | 'customer' | 'inventory'

function buildShopifyPayload(evType: EventType, id: number, now: string, f: Record<string, string>) {
  const sku = f.sku   || 'TSHIRT-BLK-M'
  const qty = parseInt(f.quantity, 10) || 2
  const price = parseFloat(f.price)  || 49.99
  const email = f.email || 'customer@example.com'

  if (evType === 'order') return {
    path: '/api/v1/webhooks/shopify/orders',
    payload: {
      id, order_number: id, email,
      total_price: (qty * price).toFixed(2),
      currency: 'USD', financial_status: 'paid',
      line_items: [{ id: 1, title: `Test Product (${sku})`, sku, quantity: qty, price: price.toFixed(2) }],
      created_at: now, updated_at: now,
    },
  }

  if (evType === 'customer') return {
    path: '/api/v1/webhooks/shopify/customers',
    payload: {
      id, email: f.email || `test${id}@example.com`,
      first_name: f.first_name || 'Test', last_name: f.last_name || 'Customer',
      phone: f.phone || '+1234567890',
      default_address: { address1: '123 Main St', city: f.city || 'Accra', country: f.country || 'GH', zip: '00233' },
      created_at: now, updated_at: now,
    },
  }

  // inventory
  return {
    path: '/api/v1/webhooks/shopify/products',
    payload: { id, title: `Test Product (${sku})`, status: 'active', variants: [{ sku, inventory_quantity: qty }] },
  }
}

function buildWooPayload(evType: EventType, id: number, now: string, f: Record<string, string>) {
  const sku   = f.sku   || 'TSHIRT-BLK-M'
  const qty   = parseInt(f.quantity, 10) || 2
  const price = parseFloat(f.price) || 49.99
  const email = f.email || 'customer@example.com'

  if (evType === 'order') return {
    path: '/api/v1/webhooks/woocommerce/orders',
    payload: {
      id, number: String(id), status: 'processing', currency: 'USD',
      total: (qty * price).toFixed(2),
      billing: { first_name: 'Test', last_name: 'Customer', email },
      line_items: [{ id: 1, product_id: 1, name: `Test Product (${sku})`, sku, quantity: qty, price }],
      date_created: now, date_modified: now,
    },
  }

  if (evType === 'customer') return {
    path: '/api/v1/webhooks/woocommerce/customers',
    payload: {
      id, email: f.email || `test${id}@example.com`,
      first_name: f.first_name || 'Test', last_name: f.last_name || 'Customer',
      billing: {
        first_name: f.first_name || 'Test', last_name: f.last_name || 'Customer',
        email: f.email || `test${id}@example.com`,
        phone: f.phone || '+1234567890', address_1: '123 Main St',
        city: f.city || 'Accra', country: f.country || 'GH', postcode: '00233',
      },
      date_created: now, date_modified: now,
    },
  }

  // inventory
  return {
    path: '/api/v1/webhooks/woocommerce/products',
    payload: { id, name: `Test Product (${sku})`, status: 'publish', sku, stock_quantity: qty, manage_stock: true },
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole("OPERATOR");
  if (error) return error;
  try {
    const { source, event_type, fields = {} } = await req.json() as {
      source:     Source
      event_type: EventType
      fields:     Record<string, string>
    }

    const secretKey = source === 'SHOPIFY' ? 'shopify_webhook_secret' : 'woocommerce_webhook_secret'
    const row = await prisma.appConfig.findUnique({ where: { key: secretKey } })
    const secret = row?.value ?? ''

    const id  = Date.now()
    const now = new Date().toISOString()
    const { path, payload } = source === 'SHOPIFY'
      ? buildShopifyPayload(event_type, id, now, fields)
      : buildWooPayload(event_type, id, now, fields)

    const body      = JSON.stringify(payload)
    const sig       = createHmac('sha256', secret).update(body).digest('base64')
    const sigHeader = source === 'SHOPIFY' ? 'X-Shopify-Hmac-Sha256' : 'X-Wc-Webhook-Signature'

    const apiUrl = process.env.API_URL ?? 'http://api:8000'
    const start  = Date.now()
    const res    = await fetch(`${apiUrl}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', [sigHeader]: sig },
      body,
      signal:  AbortSignal.timeout(10000),
    })
    const latency = Date.now() - start
    const data    = await res.json().catch(() => ({}))

    return NextResponse.json({ ok: res.ok, status: res.status, latency, data, event_id: id, path })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, status: 0, latency: null, error: msg }, { status: 502 })
  }
}
