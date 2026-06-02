// Typed client for the Next.js API routes that sit in front of the database.
// All functions throw on non-OK responses so callers can catch and handle errors.

export interface ApiLog {
  id: string
  message: string
  level: 'INFO' | 'WARN' | 'ERROR'
  created_at: string
}

export interface ApiEvent {
  id: string
  source: 'SHOPIFY' | 'WOOCOMMERCE'
  event_type: string
  external_id: string
  raw_payload: Record<string, unknown>
  status: 'RECEIVED' | 'PROCESSING' | 'SYNCED' | 'FAILED'
  created_at: string
  updated_at: string
  logs?: ApiLog[]
}

export interface ApiListResponse {
  data: ApiEvent[]
  total: number
  page: number
  page_size: number
}

export interface ApiStats {
  total_24h: number
  synced: number
  failed: number
  avg_processing_ms: number | null
}

export interface FetchEventsOpts {
  status?: string
  source?: string
  page?: number
  page_size?: number
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API ${res.status}: ${res.url}`)
  return res.json() as Promise<T>
}

export async function fetchEvents(opts: FetchEventsOpts = {}): Promise<ApiListResponse> {
  const p = new URLSearchParams()
  if (opts.status && opts.status !== 'all') p.set('status', opts.status.toUpperCase())
  if (opts.source && opts.source !== 'all') p.set('source', opts.source.toUpperCase())
  if (opts.page)      p.set('page',      String(opts.page))
  if (opts.page_size) p.set('page_size', String(opts.page_size))
  return json(await fetch(`/api/sync-events?${p}`))
}

export async function fetchEvent(id: string): Promise<ApiEvent> {
  return json(await fetch(`/api/sync-events/${id}`))
}

export async function fetchStats(): Promise<ApiStats> {
  return json(await fetch('/api/sync-events/stats'))
}

export async function retryEvent(id: string): Promise<{ queued: boolean }> {
  return json(await fetch(`/api/sync-events/${id}/retry`, { method: 'POST' }))
}

// ---------- Connector / settings config ----------

export interface ConnectorStats {
  last_sync: string | null
  events_24h: number
}

export interface AppConfig {
  shopify_store_domain:  string
  woocommerce_store_url: string
  odoo_url:          string
  odoo_db:           string
  odoo_user:         string
  auto_confirm:      boolean
  sku_mode:          string
  failure_threshold: number
  slack_webhook:     string
  shopify_secret_set: boolean
  woo_secret_set:     boolean
  odoo_password_set:  boolean
  connectors: {
    shopify:     ConnectorStats
    woocommerce: ConnectorStats
  }
}

export async function fetchConfig(): Promise<AppConfig> {
  return json(await fetch('/api/config'))
}

export async function updateConfig(patch: Partial<Record<string, string | boolean | number>>): Promise<{ ok: boolean }> {
  return json(await fetch('/api/config', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(patch),
  }))
}

export async function revealSecret(key: 'shopify_webhook_secret' | 'woocommerce_webhook_secret' | 'odoo_password'): Promise<string> {
  const res: { value: string } = await json(await fetch('/api/config/reveal', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ key }),
  }))
  return res.value
}

export interface TestResult {
  ok: boolean
  status: number
  latency: number | null
  backend?: Record<string, unknown>
  error?: string
}

export async function testEndpoint(): Promise<TestResult> {
  return json(await fetch('/api/config/test'))
}

// ---------- Webhook simulation ----------

export interface SimulateResult {
  ok:       boolean
  status:   number
  latency:  number | null
  data?:    Record<string, unknown>
  event_id?: number
  path?:    string
  error?:   string
}

// ---------- Queues + health ----------

export interface QueueInfo {
  name:     string
  depth:    number
  active:   number
  reserved: number
}

export interface WorkerInfo {
  name:      string
  queues:    string[]
  active:    number
  processed: number
  status:    'online' | 'offline'
}

export interface QueuesResponse {
  queues:    QueueInfo[]
  workers:   WorkerInfo[]
  timestamp: string
  error?:    string
}

export async function fetchQueues(): Promise<QueuesResponse> {
  return json(await fetch('/api/queues'))
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface HealthCheck {
  ok:         boolean
  latency_ms: number | null
  detail:     string
}

export interface HealthResponse {
  status:    HealthStatus
  checks: {
    postgres: HealthCheck
    redis:    HealthCheck
    celery:   HealthCheck
    odoo:     HealthCheck
  }
  timestamp: string
  error?:    string
}

export async function fetchHealth(): Promise<HealthResponse> {
  return json(await fetch('/api/health'))
}

export async function simulateWebhook(opts: {
  source:     'SHOPIFY' | 'WOOCOMMERCE'
  event_type: 'order' | 'customer' | 'inventory'
  fields:     Record<string, string>
}): Promise<SimulateResult> {
  return json(await fetch('/api/config/simulate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(opts),
  }))
}
