import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// All editable config keys. Secrets are stored in the database so they can be
// updated from the UI without touching the .env file. DATABASE_URL stays in .env.
const DEFAULTS: Record<string, string> = {
  shopify_webhook_secret:     process.env.SHOPIFY_WEBHOOK_SECRET     ?? '',
  shopify_store_domain:       process.env.SHOPIFY_STORE_DOMAIN       ?? '',
  woocommerce_webhook_secret: process.env.WOOCOMMERCE_WEBHOOK_SECRET ?? '',
  woocommerce_store_url:      process.env.WOOCOMMERCE_STORE_URL      ?? '',
  odoo_url:                   process.env.ODOO_URL                   ?? '',
  odoo_db:                    process.env.ODOO_DB                    ?? '',
  odoo_user:                  process.env.ODOO_USER                  ?? '',
  odoo_password:              process.env.ODOO_PASSWORD              ?? '',
  auto_confirm:               'true',
  sku_mode:                   'strict',
  failure_threshold:          '10',
  slack_webhook:              '',
}

const ALLOWED_KEYS = new Set(Object.keys(DEFAULTS))

async function getAll(): Promise<Record<string, string>> {
  await Promise.all(
    Object.entries(DEFAULTS).map(([key, value]) =>
      prisma.appConfig.upsert({
        where:  { key },
        create: { key, value },
        update: {},           // never overwrite an existing value on read
      })
    )
  )
  const rows = await prisma.appConfig.findMany()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

export async function GET() {
  try {
    const cfg = await getAll()

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [shopifyLast, wooLast, shopifyCount, wooCount] = await Promise.all([
      prisma.webhookEvent.findFirst({
        where: { source: 'SHOPIFY' }, orderBy: { updated_at: 'desc' }, select: { updated_at: true },
      }),
      prisma.webhookEvent.findFirst({
        where: { source: 'WOOCOMMERCE' }, orderBy: { updated_at: 'desc' }, select: { updated_at: true },
      }),
      prisma.webhookEvent.count({ where: { source: 'SHOPIFY',     created_at: { gte: yesterday } } }),
      prisma.webhookEvent.count({ where: { source: 'WOOCOMMERCE', created_at: { gte: yesterday } } }),
    ])

    return NextResponse.json({
      // Non-secret fields — returned as plain values
      shopify_store_domain:  cfg.shopify_store_domain,
      woocommerce_store_url: cfg.woocommerce_store_url,
      odoo_url:          cfg.odoo_url,
      odoo_db:           cfg.odoo_db,
      odoo_user:         cfg.odoo_user,
      auto_confirm:      cfg.auto_confirm === 'true',
      sku_mode:          cfg.sku_mode,
      failure_threshold: parseInt(cfg.failure_threshold, 10) || 10,
      slack_webhook:     cfg.slack_webhook,
      // Secrets — indicate whether they are set but don't expose the value
      shopify_secret_set:  cfg.shopify_webhook_secret.length > 0,
      woo_secret_set:      cfg.woocommerce_webhook_secret.length > 0,
      odoo_password_set:   cfg.odoo_password.length > 0,
      // Connector live stats derived from the webhook events table
      connectors: {
        shopify:     { last_sync: shopifyLast?.updated_at ?? null, events_24h: shopifyCount },
        woocommerce: { last_sync: wooLast?.updated_at    ?? null,  events_24h: wooCount    },
      },
    })
  } catch (err) {
    console.error('GET /api/config:', err)
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const updates = Object.entries(body).filter(([k]) => ALLOWED_KEYS.has(k))

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid keys provided' }, { status: 400 })
    }

    await Promise.all(
      updates.map(([key, val]) =>
        prisma.appConfig.upsert({
          where:  { key },
          create: { key, value: String(val) },
          update: { value: String(val) },
        })
      )
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/config:', err)
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
  }
}
