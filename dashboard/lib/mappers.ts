import type { ApiEvent, ApiLog } from './api'
import type { MockEvent, EventSource, EventStatus, Customer, LineItem, LogLine, SparklineData } from './mockData'

// ---------- API event → UI MockEvent ----------

function extractCustomer(ev: ApiEvent): Customer {
  const p = ev.raw_payload as Record<string, any>
  const source = ev.source

  if (ev.event_type === 'order') {
    if (source === 'SHOPIFY') {
      const addr = (p.shipping_address ?? p.billing_address) as Record<string, any> | undefined
      return {
        email: (p.email as string) || '—',
        name: addr ? `${addr.first_name ?? ''} ${addr.last_name ?? ''}`.trim() || '—' : '—',
        city: addr?.city || '—',
      }
    } else {
      const b = p.billing as Record<string, any> | undefined
      return {
        email: b?.email || (p.email as string) || '—',
        name: b ? `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim() || '—' : '—',
        city: b?.city || '—',
      }
    }
  }

  if (ev.event_type === 'customer') {
    const addr = (p.default_address ?? p.billing) as Record<string, any> | undefined
    return {
      email: (p.email as string) || '—',
      name: `${(p.first_name as string) ?? ''} ${(p.last_name as string) ?? ''}`.trim() || '—',
      city: addr?.city || '—',
    }
  }

  return { email: '—', name: '—', city: '—' }
}

function extractLines(ev: ApiEvent): LineItem[] {
  const p = ev.raw_payload as Record<string, any>

  if (ev.event_type === 'order') {
    const items = (p.line_items as any[]) ?? []
    return items.map(item => ({
      sku:   String(item.sku  ?? item.name  ?? '—'),
      name:  String(item.title ?? item.name ?? '—'),
      price: parseFloat(item.price as string) || 0,
      qty:   Number(item.quantity) || 1,
    }))
  }

  if (ev.event_type === 'product') {
    return [{
      sku:   String(p.sku   ?? p.title ?? p.name ?? '—'),
      name:  String(p.title ?? p.name  ?? '—'),
      price: 0,
      qty:   Number(p.stock_quantity) || 0,
    }]
  }

  return [{ sku: '—', name: '—', price: 0, qty: 0 }]
}

export function apiEventToMock(ev: ApiEvent): MockEvent {
  const source: EventSource = ev.source === 'SHOPIFY' ? 'shopify' : 'woocommerce'

  const kindMap: Record<string, string> = {
    order:    'order.create',
    customer: 'customer.create',
    product:  'inventory.update',
  }
  const kind = kindMap[ev.event_type] ?? ev.event_type

  const taskMap: Record<string, string> = {
    order:    'workers.tasks.orders.sync_order',
    customer: 'workers.tasks.customers.sync_customer',
    product:  'workers.tasks.inventory.sync_inventory',
  }

  const createdMs  = new Date(ev.created_at).getTime()
  const updatedMs  = new Date(ev.updated_at).getTime()
  const isSynced   = ev.status === 'SYNCED' || ev.status === 'FAILED'
  const duration   = isSynced ? updatedMs - createdMs : null

  const logs       = ev.logs ?? []
  const attempts   = Math.max(1, logs.filter(l => l.message.toLowerCase().includes('sync started')).length)
  const failReason = logs.filter(l => l.level === 'ERROR').map(l => l.message).join('; ')

  const lines      = extractLines(ev)
  const delta      = ev.event_type === 'product' ? (lines[0]?.qty ?? 0) : 0

  return {
    id:          ev.id,
    _externalId: parseInt(ev.external_id, 10) || 0,
    source,
    kind,
    status:      ev.status as EventStatus,
    duration,
    createdAtMs: createdMs,
    _isoCreated: ev.created_at,
    _customer:   extractCustomer(ev),
    _lines:      lines,
    _task:       taskMap[ev.event_type] ?? 'workers.tasks.sync',
    _attempts:   attempts,
    _failed:     ev.status === 'FAILED',
    _failReason: failReason,
    _delta:      delta,
    _stockBefore: 0,
    _isNew:      false,
  }
}

// ---------- API log → UI LogLine ----------

export function apiLogToLogLine(log: ApiLog): LogLine {
  return {
    at: new Date(log.created_at),
    lv: (log.level === 'ERROR' ? 'ERROR' : log.level === 'WARN' ? 'WARN' : 'INFO') as LogLine['lv'],
    m:  log.message,
  }
}

// ---------- Sparklines derived from real events ----------

export function buildSparklineFromEvents(events: MockEvent[]): SparklineData {
  const BUCKETS   = 24
  const MS_BUCKET = 60 * 60 * 1000
  const now       = Date.now()

  const total  = new Array<number>(BUCKETS).fill(0)
  const synced = new Array<number>(BUCKETS).fill(0)
  const failed = new Array<number>(BUCKETS).fill(0)
  const dur    = new Array<number>(BUCKETS).fill(0)

  for (const ev of events) {
    const bucketIdx = Math.floor((now - ev.createdAtMs) / MS_BUCKET)
    if (bucketIdx < 0 || bucketIdx >= BUCKETS) continue
    const i = BUCKETS - 1 - bucketIdx
    total[i]++
    if (ev.status === 'SYNCED') { synced[i]++; dur[i] += ev.duration ?? 0 }
    if (ev.status === 'FAILED') failed[i]++
  }

  return { total, synced, failed, dur }
}
