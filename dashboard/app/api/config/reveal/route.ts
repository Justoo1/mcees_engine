import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ALLOWED = new Set(['shopify_webhook_secret', 'woocommerce_webhook_secret', 'odoo_password'])

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json() as { key: string }

    if (!ALLOWED.has(key)) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const row = await prisma.appConfig.findUnique({ where: { key } })
    return NextResponse.json({ value: row?.value ?? '' })
  } catch (err) {
    console.error('POST /api/config/reveal:', err)
    return NextResponse.json({ error: 'Failed to reveal secret' }, { status: 500 })
  }
}
