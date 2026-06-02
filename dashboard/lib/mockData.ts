export type EventStatus = 'SYNCED' | 'PROCESSING' | 'FAILED' | 'RECEIVED' | 'RETRYING'
export type EventSource = 'shopify' | 'woocommerce'

export interface SKU { sku: string; name: string; price: number }
export interface Customer { email: string; name: string; city: string }
export interface LineItem extends SKU { qty: number; _missing?: boolean }

export interface MockEvent {
  id: string
  _externalId: number
  source: EventSource
  kind: string
  status: EventStatus
  duration: number | null
  createdAtMs: number
  _isoCreated: string
  _customer: Customer
  _lines: LineItem[]
  _task: string
  _attempts: number
  _failed: boolean
  _failReason: string
  _delta: number
  _stockBefore: number
  _isNew?: boolean
}

export interface FeedItem {
  key: string
  id: string
  source: EventSource
  kind: string
  createdAtMs: number
  summary: string
}

export interface LogLine {
  at: Date
  lv: 'INFO' | 'WARN' | 'ERROR' | 'OK'
  m: string
}

export interface SparklineData {
  total: number[]
  synced: number[]
  failed: number[]
  dur: number[]
}

export interface WorkerData {
  name: string; queue: string; depth: number
  processed24h: number; errors: number; cpu: number; mem: number
}

export interface ServiceData {
  name: string; uptime: string; p99: string; status: 'ok' | 'warn'
}

export const SKUS: SKU[] = [
  { sku: 'TSHIRT-BLK-M',  name: 'Heavyweight Tee · Black · M',  price: 38 },
  { sku: 'TSHIRT-WHT-L',  name: 'Heavyweight Tee · White · L',  price: 38 },
  { sku: 'HOODIE-NVY-XL', name: 'Brushed Hoodie · Navy · XL',   price: 92 },
  { sku: 'HOODIE-GRN-S',  name: 'Brushed Hoodie · Forest · S',  price: 92 },
  { sku: 'CAP-5PNL-OLV',  name: '5-Panel Cap · Olive',          price: 36 },
  { sku: 'TOTE-CNV-NAT',  name: 'Canvas Tote · Natural',        price: 24 },
  { sku: 'SOCK-CRW-3PK',  name: 'Crew Socks · 3-Pack',          price: 18 },
  { sku: 'CANDLE-AMB-08', name: 'Amber Candle · 8oz',           price: 32 },
  { sku: 'MUG-CER-CRM',   name: 'Ceramic Mug · Cream · 12oz',   price: 22 },
  { sku: 'POSTER-A3-MAP', name: 'Map Poster · A3',              price: 28 },
]

export const CUSTOMERS: Customer[] = [
  { email: 'mira.holloway@fastmail.com', name: 'Mira Holloway',    city: 'Brooklyn, NY' },
  { email: 'k.tanaka@proton.me',         name: 'Kenji Tanaka',     city: 'Osaka' },
  { email: 'jules@vanderveen.co',        name: 'Jules Vanderveen', city: 'Amsterdam' },
  { email: 'r.okafor@gmail.com',         name: 'Rotimi Okafor',    city: 'Lagos' },
  { email: 'p.rossi@outlook.com',        name: 'Paola Rossi',      city: 'Milan' },
  { email: 'd.weiss@hey.com',            name: 'Dana Weiss',       city: 'Berlin' },
  { email: 'sage.kim@duck.com',          name: 'Sage Kim',         city: 'Seoul' },
  { email: 'isla.murphy@me.com',         name: 'Isla Murphy',      city: 'Dublin' },
  { email: 'b.aragon@fastmail.com',      name: 'Benicio Aragón',   city: 'Mexico City' },
  { email: 'no-reply@bot-net.example',   name: 'Suspicious User',  city: '—' },
]

const EVENT_TYPES = [
  { id: 'order.create',    w: 5 },
  { id: 'order.update',    w: 2 },
  { id: 'customer.create', w: 1.5 },
  { id: 'customer.update', w: 1 },
  { id: 'product.update',  w: 2.5 },
]

const SOURCES: EventSource[] = ['shopify', 'woocommerce']

export const WORKERS: WorkerData[] = [
  { name: 'mcees-worker-01', queue: 'orders',    depth: 14, processed24h: 3201, errors: 4, cpu: 32, mem: 41 },
  { name: 'mcees-worker-02', queue: 'orders',    depth: 18, processed24h: 3088, errors: 6, cpu: 38, mem: 44 },
  { name: 'mcees-worker-03', queue: 'inventory', depth: 6,  processed24h: 1124, errors: 1, cpu: 22, mem: 28 },
  { name: 'mcees-worker-04', queue: 'customers', depth: 2,  processed24h: 612,  errors: 0, cpu: 11, mem: 19 },
]

export const SERVICES: ServiceData[] = [
  { name: 'FastAPI · ingestion',  uptime: '14d 6h', p99: '38ms',   status: 'ok' },
  { name: 'PostgreSQL · primary', uptime: '62d 0h', p99: '4ms',    status: 'ok' },
  { name: 'Redis · broker',       uptime: '62d 0h', p99: '0.6ms',  status: 'ok' },
  { name: 'Odoo · XML-RPC',       uptime: '2d 12h', p99: '740ms',  status: 'warn' },
]

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickW<T extends { w?: number }>(arr: T[]): T {
  const tot = arr.reduce((s, x) => s + (x.w ?? 1), 0)
  let r = Math.random() * tot
  for (const x of arr) { r -= (x.w ?? 1); if (r <= 0) return x }
  return arr[arr.length - 1]
}

export function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

export function timeStr(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function isoMs(d: Date): string {
  return `${d.toISOString().slice(0, 19)}.${pad(d.getMilliseconds(), 3)}Z`
}

function shopifyOrderPayload(ev: MockEvent): Record<string, unknown> {
  const cust = ev._customer
  const lines = ev._lines
  return {
    id: ev._externalId,
    name: `#${1000 + (ev._externalId % 9999)}`,
    email: cust.email,
    created_at: ev._isoCreated,
    currency: 'USD',
    financial_status: 'paid',
    fulfillment_status: null,
    total_price: lines.reduce((s, l) => s + l.price * l.qty, 0).toFixed(2),
    customer: {
      id: 9000000 + (ev._externalId % 9999),
      first_name: cust.name.split(' ')[0],
      last_name: cust.name.split(' ').slice(1).join(' '),
      email: cust.email,
    },
    line_items: lines.map((l, i) => ({
      id: 10000 + i, sku: l.sku, title: l.name, quantity: l.qty, price: l.price.toFixed(2),
    })),
    shipping_address: { city: cust.city, country: 'US', zip: '11211' },
  }
}

function wooOrderPayload(ev: MockEvent): Record<string, unknown> {
  const cust = ev._customer
  const lines = ev._lines
  return {
    id: ev._externalId,
    number: String(ev._externalId).slice(-6),
    status: 'processing',
    currency: 'EUR',
    date_created: ev._isoCreated,
    total: lines.reduce((s, l) => s + l.price * l.qty, 0).toFixed(2),
    billing: {
      email: cust.email,
      first_name: cust.name.split(' ')[0],
      last_name: cust.name.split(' ').slice(1).join(' '),
      city: cust.city,
    },
    line_items: lines.map((l, i) => ({
      id: 7000 + i, sku: l.sku, name: l.name, quantity: l.qty,
      total: (l.price * l.qty).toFixed(2),
    })),
  }
}

function customerPayload(ev: MockEvent): Record<string, unknown> {
  const c = ev._customer
  if (ev.source === 'shopify') {
    return {
      id: 9100000 + (ev._externalId % 9999),
      email: c.email,
      first_name: c.name.split(' ')[0],
      last_name: c.name.split(' ').slice(1).join(' '),
      accepts_marketing: true,
      updated_at: ev._isoCreated,
      tags: 'wholesale, vip',
    }
  }
  return {
    id: ev._externalId,
    email: c.email,
    first_name: c.name.split(' ')[0],
    last_name: c.name.split(' ').slice(1).join(' '),
    role: 'customer',
    date_modified: ev._isoCreated,
  }
}

function inventoryPayload(ev: MockEvent): Record<string, unknown> {
  return {
    inventory_item_id: 5500000 + (ev._externalId % 9999),
    sku: ev._lines[0].sku,
    location_id: 4039,
    available_adjustment: ev._delta,
    updated_at: ev._isoCreated,
  }
}

export function samplePayload(ev: MockEvent): Record<string, unknown> {
  if (ev.kind === 'order.create' || ev.kind === 'order.update')
    return ev.source === 'shopify' ? shopifyOrderPayload(ev) : wooOrderPayload(ev)
  if (ev.kind === 'customer.create' || ev.kind === 'customer.update') return customerPayload(ev)
  if (ev.kind === 'product.update') return inventoryPayload(ev)
  return {}
}

export function buildLog(ev: MockEvent): LogLine[] {
  const d0 = new Date(ev.createdAtMs)
  const lines: LogLine[] = []
  let off = 0
  const tick = (ms: number, lv: LogLine['lv'], m: string) => {
    off += ms
    lines.push({ at: new Date(d0.getTime() + off), lv, m })
  }

  tick(0,  'INFO', `Webhook received from ${ev.source} (${(JSON.stringify(samplePayload(ev)).length / 1024).toFixed(1)} KB)`)
  tick(2,  'INFO', 'HMAC verification: PASSED (sha256)')
  tick(4,  'INFO', `WebhookEvent inserted id=${ev.id} external_id=${ev._externalId} status=RECEIVED`)
  tick(3,  'OK',   `202 Accepted returned in ${4 + Math.floor(Math.random() * 8)} ms`)
  tick(18, 'INFO', `Celery task ${ev._task} dispatched → queue:default`)
  tick(56, 'INFO', `Worker mcees-worker-${pick(['01', '02', '03', '04'])} acquired task`)
  tick(8,  'INFO', 'status → PROCESSING')

  if (ev.kind === 'order.create' || ev.kind === 'order.update') {
    tick(34, 'INFO', `Resolving customer by email "${ev._customer.email}"`)
    tick(78, 'INFO', `res.partner upsert → id=${4000 + (ev._externalId % 8888)} (matched by email)`)
    ev._lines.forEach((l, i) => {
      if (!l._missing) tick(60 + i * 12, 'INFO', `Resolved product "${l.sku}" → product.product id=${2000 + i}`)
      else             tick(60 + i * 12, 'WARN', `Product "${l.sku}" not found in Odoo · line skipped`)
    })
    if (!ev._failed) {
      tick(140, 'INFO', `sale.order.create → name="SO00${1240 + (ev._externalId % 800)}", lines=${ev._lines.filter(l => !l._missing).length}`)
      tick(98,  'INFO', `action_confirm() → reservation issued, delivery DO00${300 + (ev._externalId % 500)} generated`)
      tick(12,  'OK',   `Sync completed → status=SYNCED (${((ev.duration ?? 0) / 1000).toFixed(2)}s total)`)
    } else {
      tick(120, 'ERROR', `XML-RPC fault: ${ev._failReason || 'Connection refused (Odoo server)'}`)
      tick(0,   'INFO',  `Retry attempt ${ev._attempts}/5 scheduled in ${(2 ** ev._attempts).toFixed(1)}s (jitter +0.${Math.floor(Math.random() * 9)})`)
      if (ev._attempts >= 5) tick(0, 'ERROR', 'Max retries exceeded → status=FAILED')
    }
  } else if (ev.kind === 'customer.create' || ev.kind === 'customer.update') {
    tick(40, 'INFO', 'Searching res.partner by email')
    if (!ev._failed) {
      tick(60, 'INFO', `${ev.kind === 'customer.create' ? 'Created' : 'Updated'} res.partner id=${4000 + (ev._externalId % 8888)}`)
      tick(8,  'OK',   'status=SYNCED')
    } else {
      tick(80, 'ERROR', ev._failReason || 'Duplicate email constraint')
    }
  } else if (ev.kind === 'product.update') {
    tick(15, 'INFO', `Redis lock requested: inventory_lock:${ev._lines[0].sku} (TTL=30s)`)
    tick(8,  'INFO', `Lock acquired in ${Math.floor(Math.random() * 40) + 5}ms`)
    tick(70, 'INFO', `Read current stock.quant.quantity = ${ev._stockBefore} for "${ev._lines[0].sku}"`)
    if (!ev._failed) {
      tick(40, 'INFO', `Applying delta ${ev._delta > 0 ? '+' : ''}${ev._delta} → new quantity ${ev._stockBefore + ev._delta}`)
      tick(30, 'INFO', 'stock.quant.write → committed')
      tick(5,  'INFO', 'Lock released')
      tick(2,  'OK',   'status=SYNCED')
    } else {
      tick(40, 'WARN', 'Lock timeout — could not acquire within 5s')
      tick(0,  'INFO', `Self-retry scheduled (attempt ${ev._attempts}/5)`)
    }
  }
  return lines
}

export function makeEvent(opts: {
  now?: number
  forceStatus?: EventStatus
  forceKind?: string
  forceSource?: EventSource
  customer?: Customer
  lines?: LineItem[]
} = {}): MockEvent {
  const { now = Date.now(), forceStatus, forceKind, forceSource, customer, lines } = opts
  const source = forceSource ?? pick(SOURCES)
  const kind = forceKind ?? pickW(EVENT_TYPES).id
  const cust = customer ?? pick(CUSTOMERS)
  const nlines = kind.startsWith('order') ? 1 + Math.floor(Math.random() * 3) : 1
  const skuCh: LineItem[] = []
  for (let i = 0; i < nlines; i++) {
    const s = pick(SKUS)
    if (!skuCh.find(x => x.sku === s.sku)) skuCh.push({ ...s, qty: 1 + Math.floor(Math.random() * 3) })
  }
  if (kind.startsWith('order') && Math.random() < 0.18) {
    skuCh[skuCh.length - 1] = {
      sku: `LEGACY-${Math.floor(Math.random() * 999)}`,
      name: 'Legacy SKU', qty: 1, price: 12.0, _missing: true,
    }
  }

  const createdAtMs = now - Math.floor(Math.random() * 60_000)
  const dur = 280 + Math.floor(Math.random() * 1400)
  const externalId = Math.floor(Math.random() * 8_999_999) + 1_000_000

  let status: EventStatus = forceStatus ?? 'SYNCED'
  if (!forceStatus) {
    const r = Math.random()
    if (r < 0.78)       status = 'SYNCED'
    else if (r < 0.88)  status = 'PROCESSING'
    else if (r < 0.94)  status = 'FAILED'
    else if (r < 0.98)  status = 'RECEIVED'
    else                status = 'RETRYING'
  }

  const failReasons = [
    'Connection refused (Odoo server)',
    'Server timed out after 30s',
    'AccessDenied: insufficient permission on res.partner',
    'UniqueViolation: client_order_ref already exists',
    'XML-RPC fault 1 — "Invalid sale.order.line"',
  ]

  const ev: MockEvent = {
    id: String(externalId),
    _externalId: externalId,
    source,
    kind,
    status,
    duration: status === 'PROCESSING' ? null : dur,
    createdAtMs,
    _isoCreated: isoMs(new Date(createdAtMs)),
    _customer: cust,
    _lines: lines ?? skuCh,
    _task: `sync_${kind.split('.')[0]}`,
    _attempts: status === 'FAILED' ? 5 : (status === 'RETRYING' ? 2 + Math.floor(Math.random() * 3) : 1),
    _failed: status === 'FAILED' || status === 'RETRYING',
    _failReason: pick(failReasons),
    _delta: (Math.random() < 0.85 ? 1 : -1) * (5 + Math.floor(Math.random() * 60)),
    _stockBefore: 30 + Math.floor(Math.random() * 200),
  }
  return ev
}

export function seedEvents(n = 36): MockEvent[] {
  const now = Date.now()
  const out: MockEvent[] = []
  for (let i = 0; i < n; i++) {
    out.push(makeEvent({ now: now - Math.floor((i / n) * 3_600_000) - Math.floor(Math.random() * 4000) }))
  }
  out.sort((a, b) => b.createdAtMs - a.createdAtMs)
  return out
}

export function buildSparklines(): SparklineData {
  const total = Array.from({ length: 24 }, () => 60 + Math.floor(Math.random() * 220))
  const synced = total.map(t => t - Math.floor(t * (0.04 + Math.random() * 0.06)))
  const failed = total.map(t => Math.floor(t * (0.02 + Math.random() * 0.05)))
  total[total.length - 1] = Math.max(total[total.length - 1], 220)
  synced[synced.length - 1] = Math.floor(total[total.length - 1] * 0.93)
  const dur = Array.from({ length: 24 }, () => 320 + Math.floor(Math.random() * 600))
  return { total, synced, failed, dur }
}

export function makeFeedItem(ev: MockEvent): FeedItem {
  return {
    key: ev.id + Math.random(),
    id: ev.id,
    source: ev.source,
    kind: ev.kind,
    createdAtMs: ev.createdAtMs,
    summary: ev.kind.startsWith('order') || ev.kind.startsWith('customer')
      ? ev._customer.email
      : `${ev._lines[0].sku} ${ev._delta >= 0 ? '+' : ''}${ev._delta}`,
  }
}
