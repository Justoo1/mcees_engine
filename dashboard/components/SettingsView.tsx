'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Ic } from '@/components/icons'
import { fetchConfig, updateConfig, revealSecret, simulateWebhook, type AppConfig, type ConnectorStats, type SimulateResult } from '@/lib/api'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtSync(iso: string | null) {
  if (!iso) return 'never'
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 19)
}

function fmtCount(n: number) {
  return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : n.toLocaleString()
}

function genSecret(bytes = 24) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Simulate Modal ───────────────────────────────────────────────────────────

type SimSource    = 'SHOPIFY' | 'WOOCOMMERCE'
type SimEventType = 'order' | 'customer' | 'inventory'

const EVENT_TYPES: { id: SimEventType; label: string; sub: string }[] = [
  { id: 'order',     label: 'New order',        sub: 'Line items · payment · shipping' },
  { id: 'customer',  label: 'New customer',      sub: 'Profile · billing address'       },
  { id: 'inventory', label: 'Inventory update',  sub: 'SKU · stock quantity'            },
]

function SimulateModal({ onClose }: { onClose: () => void }) {
  const [source,  setSource]  = useState<SimSource>('SHOPIFY')
  const [evType,  setEvType]  = useState<SimEventType>('order')
  const [fields,  setFields]  = useState<Record<string, string>>({
    sku: 'TSHIRT-BLK-M', quantity: '2', price: '49.99',
    email: 'customer@example.com',
    first_name: 'Test', last_name: 'Customer',
    phone: '+1234567890', city: 'Accra', country: 'GH',
  })
  const [sending, setSending] = useState(false)
  const [result,  setResult]  = useState<SimulateResult | null>(null)

  const set = (k: string, v: string) => setFields(f => ({ ...f, [k]: v }))

  const handleSend = async () => {
    setSending(true); setResult(null)
    try {
      const r = await simulateWebhook({ source, event_type: evType, fields })
      setResult(r)
    } catch {
      setResult({ ok: false, status: 0, latency: null, error: 'Request failed — check backend connection' })
    } finally {
      setSending(false)
    }
  }

  const inp = {
    width: '100%', boxSizing: 'border-box' as const, height: 34, padding: '0 10px', fontSize: 13,
    background: 'var(--bg-1)', border: '1px solid var(--bd-1)', borderRadius: 7,
    color: 'var(--t-0)', outline: 'none', fontFamily: 'Inter',
  }
  const monoInp = { ...inp, fontFamily: 'JetBrains Mono', fontSize: 12 }

  const Field = ({ label, k, type = 'text', mono }: { label: string; k: string; type?: string; mono?: boolean }) => (
    <div>
      <div className="lbl" style={{ marginBottom: 5 }}>{label}</div>
      <input type={type} value={fields[k] ?? ''} onChange={e => set(k, e.target.value)} style={mono ? monoInp : inp} />
    </div>
  )

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 520 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd-0)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ic.activity style={{ color: 'var(--acc)' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Simulate webhook</div>
          <div className="muted" style={{ fontSize: 12 }}>Fire a real event through the pipeline</div>
          <div className="grow" />
          <button className="iconbtn" onClick={onClose}><Ic.close /></button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Platform */}
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}>Platform</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {PLATFORMS.map(p => {
                const active = source === p.id.toUpperCase()
                return (
                  <button key={p.id} onClick={() => setSource(p.id.toUpperCase() as SimSource)}
                    style={{
                      flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: active ? 'var(--acc-soft)' : 'var(--bg-1)',
                      border:     `1px solid ${active ? 'var(--acc)' : 'var(--bd-1)'}`,
                      color:      active ? 'var(--acc)' : 'var(--t-1)',
                    }}>
                    <div className={`plat ${p.cls}`} style={{ width: 26, height: 26, fontSize: 12, borderRadius: 6, flexShrink: 0 }}>{p.init}</div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Event type */}
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}>Event type</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {EVENT_TYPES.map(e => {
                const active = evType === e.id
                return (
                  <button key={e.id} onClick={() => setEvType(e.id)}
                    style={{
                      flex: 1, padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
                      background: active ? 'var(--acc-soft)' : 'var(--bg-1)',
                      border:     `1px solid ${active ? 'var(--acc)' : 'var(--bd-1)'}`,
                      color:      active ? 'var(--acc)' : 'var(--t-1)',
                    }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{e.label}</span>
                    <span style={{ fontSize: 10.5, color: active ? 'var(--acc)' : 'var(--t-3)' }}>{e.sub}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dynamic fields */}
          {evType === 'order' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="SKU"              k="sku"      mono />
              <Field label="Quantity"         k="quantity" type="number" />
              <Field label="Unit price (USD)" k="price"    type="number" />
              <Field label="Customer email"   k="email"    type="email" />
            </div>
          )}
          {evType === 'customer' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="First name" k="first_name" />
              <Field label="Last name"  k="last_name"  />
              <Field label="Email"      k="email"      type="email" />
              <Field label="Phone"      k="phone" />
              <Field label="City"       k="city"  />
              <Field label="Country"    k="country" />
            </div>
          )}
          {evType === 'inventory' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="SKU"            k="sku"      mono />
              <Field label="Stock quantity" k="quantity" type="number" />
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{
              borderRadius: 8, padding: '10px 14px',
              background: result.ok ? 'var(--ok-bg)' : 'var(--err-bg)',
              border: `1px solid ${result.ok ? 'var(--ok)' : 'var(--err)'}`,
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              {result.ok ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ok)' }}>
                    Accepted · {result.latency}ms · HTTP {result.status}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--t-2)' }}>
                    event_id={result.event_id} · {result.path}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t-2)' }}>
                    Check the Timeline tab to see it arrive in real time.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--err)' }}>
                  {result.error ?? `HTTP ${result.status} — check backend logs`}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bd-0)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={handleSend} disabled={sending}>
            {sending
              ? <><span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Sending…</>
              : <><Ic.activity /> Send test webhook</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Source Modal ─────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'shopify',     label: 'Shopify',     cls: 'shopify',     init: 'S', placeholder: 'mystore.myshopify.com' },
  { id: 'woocommerce', label: 'WooCommerce', cls: 'woocommerce', init: 'W', placeholder: 'store.example.com' },
]

function AddSourceModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (platform: string, storeUrl: string, secret: string) => Promise<void>
}) {
  const [platform, setPlatform] = useState('shopify')
  const [storeUrl, setStoreUrl] = useState('')
  const [secret,   setSecret]   = useState('')
  const [saving,   setSaving]   = useState(false)

  const plat = PLATFORMS.find(p => p.id === platform)!

  const handleSave = async () => {
    if (!secret.trim()) return
    setSaving(true)
    try { await onSave(platform, storeUrl, secret) }
    finally { setSaving(false) }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd-0)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Add webhook source</div>
          <div className="grow" />
          <button className="iconbtn" onClick={onClose}><Ic.close /></button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Platform picker */}
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}>Platform</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setPlatform(p.id)}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background:   platform === p.id ? 'var(--acc-soft)' : 'var(--bg-1)',
                    border:       `1px solid ${platform === p.id ? 'var(--acc)' : 'var(--bd-1)'}`,
                    color:        platform === p.id ? 'var(--acc)' : 'var(--t-1)',
                  }}>
                  <div className={`plat ${p.cls}`} style={{ width: 28, height: 28, fontSize: 12, borderRadius: 6, flexShrink: 0 }}>{p.init}</div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Store URL */}
          <div>
            <div className="lbl" style={{ marginBottom: 6 }}>Store URL</div>
            <input type="text" value={storeUrl} onChange={e => setStoreUrl(e.target.value)}
              placeholder={plat.placeholder}
              style={{
                width: '100%', boxSizing: 'border-box', height: 34, padding: '0 10px', fontSize: 13,
                background: 'var(--bg-1)', border: '1px solid var(--bd-1)', borderRadius: 7,
                color: 'var(--t-0)', outline: 'none', fontFamily: 'Inter',
              }}
            />
          </div>

          {/* Signing secret */}
          <div>
            <div className="lbl" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Signing secret</span>
              <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setSecret(genSecret())}>
                Generate
              </button>
            </div>
            <input type="text" value={secret} onChange={e => setSecret(e.target.value)}
              placeholder="Paste or generate a signing secret…"
              style={{
                width: '100%', boxSizing: 'border-box', height: 34, padding: '0 10px', fontSize: 12,
                fontFamily: 'JetBrains Mono', background: 'var(--bg-1)',
                border: `1px solid ${secret ? 'var(--acc)' : 'var(--bd-1)'}`,
                borderRadius: 7, color: 'var(--t-0)', outline: 'none',
              }}
            />
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Webhook endpoint: <span className="mono" style={{ color: 'var(--t-1)' }}>https://api.mcees.engine/v1/webhooks/{platform}</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bd-0)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={!secret.trim() || saving}>
            {saving ? 'Adding…' : 'Add source'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ConnectorCard ────────────────────────────────────────────────────────────

function ConnectorCard({ source, displayName, stats, secretKey, secretSet, onSave }: {
  source: 'shopify' | 'woocommerce'
  displayName: string
  stats: ConnectorStats
  secretKey: 'shopify_webhook_secret' | 'woocommerce_webhook_secret'
  secretSet: boolean
  onSave: (patch: Record<string, string>) => Promise<void>
}) {
  const platCls = source === 'shopify' ? 'shopify' : 'woocommerce'
  const init    = source === 'shopify' ? 'S' : 'W'
  const topics  = source === 'shopify'
    ? ['orders/create', 'orders/updated', 'customers/create', 'customers/update', 'products/update', 'inventory_levels/update']
    : ['order.created', 'order.updated', 'customer.created', 'customer.updated', 'product.updated']
  const domainKey = source === 'shopify' ? 'shopify_store_domain' : 'woocommerce_store_url'

  const [editing,    setEditing]    = useState(false)
  const [domainEdit, setDomainEdit] = useState(displayName)
  const [secretEdit, setSecretEdit] = useState('')
  const [revealed,   setRevealed]   = useState(false)
  const [revealVal,  setRevealVal]  = useState('')
  const [revealing,  setRevealing]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [rotating,   setRotating]   = useState(false)
  const [rotatedVal, setRotatedVal] = useState('')

  const startEdit = () => { setDomainEdit(displayName); setSecretEdit(''); setEditing(true) }
  const cancel    = () => { setEditing(false); setRotating(false) }

  const doSave = async () => {
    setSaving(true)
    const patch: Record<string, string> = { [domainKey]: domainEdit }
    if (secretEdit)  patch[secretKey] = secretEdit
    if (rotatedVal)  patch[secretKey] = rotatedVal
    await onSave(patch)
    setSaving(false)
    setEditing(false)
    setRotating(false)
    setRotatedVal('')
    setRevealed(false)
  }

  const reveal = async () => {
    if (revealed) { setRevealed(false); return }
    setRevealing(true)
    try { const v = await revealSecret(secretKey); setRevealVal(v); setRevealed(true) }
    catch { /* silent */ }
    finally { setRevealing(false) }
  }

  const rotate = () => { setRotatedVal(genSecret()); setRotating(true) }

  const status = secretSet ? 'ok' : 'err'

  return (
    <div className="card" style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--bd-0)' }}>
        <div className={`plat ${platCls}`} style={{ width: 36, height: 36, fontSize: 14, borderRadius: 8 }}>{init}</div>
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input type="text" value={domainEdit} onChange={e => setDomainEdit(e.target.value)}
              placeholder={source === 'shopify' ? 'mystore.myshopify.com' : 'store.example.com'}
              style={{
                width: '100%', height: 28, padding: '0 8px', fontSize: 13, fontWeight: 600,
                background: 'var(--bg-1)', border: '1px solid var(--acc)', borderRadius: 6,
                color: 'var(--t-0)', outline: 'none', fontFamily: 'Inter',
              }}
            />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {source === 'shopify' ? 'Shopify' : 'WooCommerce'}{displayName ? ` · ${displayName}` : ''}
            </div>
          )}
          <div className="muted" style={{ fontSize: 11.5 }}>
            Last sync <span className="mono" style={{ color: 'var(--t-1)' }}>{fmtSync(stats.last_sync)}</span>
            {' · '}{fmtCount(stats.events_24h)} events / 24h
          </div>
        </div>
        {status === 'ok'
          ? <span className="chip ok"><span className="d" />connected</span>
          : <span className="chip err"><span className="d" />not configured</span>}
        {editing
          ? <>
              <button className="btn ghost" onClick={cancel} style={{ fontSize: 12 }}>Cancel</button>
              <button className="btn primary" onClick={doSave} disabled={saving} style={{ fontSize: 12 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          : <button className="btn ghost" onClick={startEdit} style={{ fontSize: 12 }}>Edit</button>}
      </div>

      {/* Body */}
      <div style={{ padding: '6px 16px 14px' }}>
        <div className="kvrow">
          <span className="k">Webhook URL</span>
          <span className="v mono" style={{ fontSize: 12 }}>https://api.mcees.engine/v1/webhooks/{source}</span>
        </div>

        <div className="kvrow">
          <span className="k">Signing secret</span>
          {editing || rotating ? (
            <span className="v row" style={{ gap: 8 }}>
              <input type="text"
                value={rotatedVal || secretEdit}
                onChange={e => { if (rotatedVal) setRotatedVal(e.target.value); else setSecretEdit(e.target.value) }}
                placeholder="New secret value…"
                style={{
                  flex: 1, height: 28, padding: '0 8px', fontSize: 12, fontFamily: 'JetBrains Mono',
                  background: 'var(--bg-1)', border: '1px solid var(--acc)', borderRadius: 6,
                  color: 'var(--t-0)', outline: 'none',
                }}
              />
              <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={rotate}>
                Re-generate
              </button>
            </span>
          ) : (
            <span className="v row" style={{ gap: 8 }}>
              <span style={{ flex: 1, fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                {revealed ? revealVal : (secretSet ? '•'.repeat(32) : <span style={{ color: 'var(--t-3)' }}>not set</span>)}
              </span>
              <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={reveal} disabled={revealing}>
                {revealing ? '…' : revealed ? 'Hide' : 'Reveal'}
              </button>
              <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={rotate}>
                Rotate
              </button>
            </span>
          )}
        </div>

        <div className="kvrow">
          <span className="k">Subscribed topics</span>
          <span className="v">
            {topics.map(t => (
              <span key={t} className="chip neu"
                style={{ marginRight: 4, marginBottom: 3, fontFamily: 'JetBrains Mono', textTransform: 'none', letterSpacing: 0 }}>
                {t}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── SettingsView ─────────────────────────────────────────────────────────────

export function SettingsView() {
  const [config,   setConfig]   = useState<AppConfig | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [odooEdit, setOdooEdit] = useState(false)
  const [addOpen,  setAddOpen]  = useState(false)
  const [simOpen,  setSimOpen]  = useState(false)
  const [odooForm, setOdooForm] = useState({ url: '', db: '', user: '', password: '' })
  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const cfg = await fetchConfig()
      setConfig(cfg)
      setOdooForm({ url: cfg.odoo_url, db: cfg.odoo_db, user: cfg.odoo_user, password: '' })
    } catch {
      setError('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (patch: Record<string, string | boolean | number>) => {
    setSaving(true); setError(null)
    try {
      await updateConfig(patch)
      setSaved(true)
      if (testTimerRef.current) clearTimeout(testTimerRef.current)
      testTimerRef.current = setTimeout(() => setSaved(false), 2500)
      await load()
    } catch {
      setError('Save failed — check API connection')
    } finally {
      setSaving(false)
    }
  }, [load])

  const handleAddSource = async (platform: string, storeUrl: string, secret: string) => {
    const patch: Record<string, string> = { [`${platform}_webhook_secret`]: secret }
    if (storeUrl) patch[platform === 'shopify' ? 'shopify_store_domain' : 'woocommerce_store_url'] = storeUrl
    await save(patch)
    setAddOpen(false)
  }

  const saveOdoo = async () => {
    const patch: Record<string, string> = { odoo_url: odooForm.url, odoo_db: odooForm.db, odoo_user: odooForm.user }
    if (odooForm.password) patch.odoo_password = odooForm.password
    await save(patch)
    setOdooEdit(false)
  }

  if (loading) return (
    <div className="page">
      <div className="row"><div className="lbl">Connectors</div></div>
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t-3)' }}>Loading configuration…</div>
    </div>
  )

  if (!config) return (
    <div className="page">
      <div style={{ color: 'var(--err)', padding: 20 }}>{error ?? 'Unknown error'}</div>
    </div>
  )

  return (
    <div className="page">
      {addOpen  && <AddSourceModal onClose={() => setAddOpen(false)} onSave={handleAddSource} />}
      {simOpen  && <SimulateModal  onClose={() => setSimOpen(false)} />}

      {/* Header */}
      <div className="row">
        <div className="lbl">Connectors</div>
        <div className="grow" />
        {saved && <span className="chip ok"><span className="d" />Saved</span>}
        {error && <span className="chip err" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{error}</span>}
        <button className="btn" onClick={() => setSimOpen(true)}>
          <Ic.activity /> Simulate
        </button>
        <button className="btn primary" onClick={() => setAddOpen(true)}>+ Add source</button>
      </div>

      {/* Connector cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ConnectorCard
          source="shopify"
          displayName={config.shopify_store_domain}
          stats={config.connectors.shopify}
          secretKey="shopify_webhook_secret"
          secretSet={config.shopify_secret_set}
          onSave={save}
        />
        <ConnectorCard
          source="woocommerce"
          displayName={config.woocommerce_store_url}
          stats={config.connectors.woocommerce}
          secretKey="woocommerce_webhook_secret"
          secretSet={config.woo_secret_set}
          onSave={save}
        />
      </div>

      {/* ERP target */}
      <div className="lbl">ERP target</div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--bd-0)' }}>
          <div className="plat odoo" style={{ width: 36, height: 36, fontSize: 14, borderRadius: 8 }}>O</div>
          <div className="col" style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-0)' }}>Odoo 17 · Production</div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              XML-RPC · <span className="mono" style={{ color: 'var(--t-1)' }}>{config.odoo_url || '—'}</span>
              {' · '}db <span className="mono" style={{ color: 'var(--t-1)' }}>{config.odoo_db || '—'}</span>
            </div>
          </div>
          <span className="chip warn"><span className="d" />elevated p99</span>
          {odooEdit
            ? <>
                <button className="btn ghost" onClick={() => setOdooEdit(false)}>Cancel</button>
                <button className="btn primary" onClick={saveOdoo} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </>
            : <button className="btn ghost" onClick={() => setOdooEdit(true)}>Edit</button>}
        </div>

        <div style={{ padding: '6px 16px 14px' }}>
          {odooEdit ? (
            <>
              {([['ODOO_URL', 'url', 'https://mcees.odoo.com'], ['ODOO_DB', 'db', 'mcees-prod'], ['ODOO_USER', 'user', 'integrations@mcees.com']] as const).map(([label, key, ph]) => (
                <div key={key} className="kvrow">
                  <span className="k">{label}</span>
                  <span className="v">
                    <input type="text" value={odooForm[key]} placeholder={ph}
                      onChange={e => setOdooForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 12, fontFamily: 'JetBrains Mono', background: 'var(--bg-1)', border: '1px solid var(--acc)', borderRadius: 6, color: 'var(--t-0)', outline: 'none' }}
                    />
                  </span>
                </div>
              ))}
              <div className="kvrow">
                <span className="k">ODOO_PASSWORD</span>
                <span className="v">
                  <input type="password" value={odooForm.password} placeholder="Leave blank to keep current"
                    onChange={e => setOdooForm(f => ({ ...f, password: e.target.value }))}
                    style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 12, fontFamily: 'JetBrains Mono', background: 'var(--bg-1)', border: '1px solid var(--acc)', borderRadius: 6, color: 'var(--t-0)', outline: 'none' }}
                  />
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="kvrow"><span className="k">ODOO_URL</span><span className="v">{config.odoo_url || <span style={{ color: 'var(--t-3)' }}>not set</span>}</span></div>
              <div className="kvrow"><span className="k">ODOO_DB</span><span className="v">{config.odoo_db || <span style={{ color: 'var(--t-3)' }}>not set</span>}</span></div>
              <div className="kvrow"><span className="k">ODOO_USER</span><span className="v">{config.odoo_user || <span style={{ color: 'var(--t-3)' }}>not set</span>}</span></div>
              <div className="kvrow">
                <span className="k">ODOO_PASSWORD</span>
                <OdooPasswordField isSet={config.odoo_password_set} />
              </div>
              <div className="kvrow"><span className="k">Connection pool</span><span className="v">8 connections · timeout 30s</span></div>
            </>
          )}
        </div>
      </div>

      {/* Sync rules */}
      <div className="lbl">Sync rules</div>
      <div className="card" style={{ padding: '6px 16px 14px' }}>
        <div className="kvrow">
          <span className="k">Auto-confirm new orders</span>
          <span className="v row">
            <div className={`tog ${config.auto_confirm ? 'on' : ''}`}
              onClick={() => save({ auto_confirm: String(!config.auto_confirm) })} />
            <span style={{ marginLeft: 10, color: 'var(--t-2)', fontFamily: 'Inter', fontSize: 12 }}>
              Calls <span className="mono" style={{ color: 'var(--t-0)' }}>action_confirm()</span> after upsert · reserves stock
            </span>
          </span>
        </div>
        <div className="kvrow">
          <span className="k">SKU matching mode</span>
          <span className="v row" style={{ gap: 6 }}>
            {([
              ['strict', 'Strict',         'Match default_code only · skip if missing'],
              ['name',   'Name fallback',   'Fall back to product.product.name fuzzy'],
              ['skip',   'Skip on missing', 'Skip entire order if any line unmatched'],
            ] as const).map(([id, label, sub]) => (
              <button key={id} className="btn" onClick={() => save({ sku_mode: id })}
                style={{
                  borderColor: config.sku_mode === id ? 'var(--acc)' : 'var(--bd-0)',
                  background:  config.sku_mode === id ? 'var(--acc-soft)' : 'var(--bg-1)',
                  color:       config.sku_mode === id ? 'var(--acc)' : 'var(--t-1)',
                  flexDirection: 'column', alignItems: 'flex-start', padding: '8px 12px', fontFamily: 'Inter',
                }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 10.5, color: 'var(--t-2)', marginTop: 2 }}>{sub}</span>
              </button>
            ))}
          </span>
        </div>
        <div className="kvrow">
          <span className="k">Max retry attempts</span>
          <span className="v"><span className="mono" style={{ color: 'var(--t-0)' }}>5</span> · exponential backoff 2^n + jitter</span>
        </div>
        <div className="kvrow">
          <span className="k">Inventory lock TTL</span>
          <span className="v"><span className="mono" style={{ color: 'var(--t-0)' }}>30s</span> · redis · keyed by inventory_lock:&#123;sku&#125;</span>
        </div>
        <div className="kvrow">
          <span className="k">Max payload size</span>
          <span className="v"><span className="mono" style={{ color: 'var(--t-0)' }}>1 MB</span></span>
        </div>
      </div>

      {/* Notifications */}
      <div className="lbl">Notifications</div>
      <div className="card" style={{ padding: '6px 16px 14px' }}>
        <div className="kvrow">
          <span className="k">Failure threshold</span>
          <span className="v">
            Alert if &gt; <span className="mono" style={{ color: 'var(--t-0)' }}>{config.failure_threshold}</span> failures in <span className="mono" style={{ color: 'var(--t-0)' }}>5 min</span>
          </span>
        </div>
        <div className="kvrow">
          <span className="k">Slack webhook</span>
          <span className="v">
            {config.slack_webhook
              ? <span className="mono" style={{ fontSize: 11.5 }}>{config.slack_webhook}</span>
              : <span className="chip neu">not configured</span>}
            <button className="btn ghost" style={{ marginLeft: 8, padding: '3px 8px', fontSize: 11 }}
              onClick={() => {
                const url = prompt('Slack webhook URL:', config.slack_webhook)
                if (url !== null) save({ slack_webhook: url })
              }}>
              {config.slack_webhook ? 'Edit' : 'Connect'}
            </button>
          </span>
        </div>
        <div className="kvrow">
          <span className="k">PagerDuty</span>
          <span className="v">
            <span className="chip neu">not configured</span>
            <button className="btn ghost" style={{ marginLeft: 8, padding: '3px 8px', fontSize: 11 }}>Connect</button>
          </span>
        </div>
      </div>
    </div>
  )
}

// Standalone Odoo password reveal (read-only mode)
function OdooPasswordField({ isSet }: { isSet: boolean }) {
  const [revealed,  setRevealed]  = useState(false)
  const [val,       setVal]       = useState('')
  const [revealing, setRevealing] = useState(false)

  const toggle = async () => {
    if (revealed) { setRevealed(false); return }
    setRevealing(true)
    try { const v = await revealSecret('odoo_password'); setVal(v); setRevealed(true) }
    catch { /* silent */ }
    finally { setRevealing(false) }
  }

  return (
    <span className="v row" style={{ gap: 8 }}>
      <span style={{ flex: 1, fontFamily: 'JetBrains Mono', fontSize: 12 }}>
        {revealed ? val : (isSet ? '•'.repeat(28) : <span style={{ color: 'var(--t-3)' }}>not set</span>)}
      </span>
      <button className="btn ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={toggle} disabled={revealing}>
        {revealing ? '…' : revealed ? 'Hide' : 'Reveal'}
      </button>
    </span>
  )
}
