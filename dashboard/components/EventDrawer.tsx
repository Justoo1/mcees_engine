'use client'

import { useState, useEffect } from 'react'
import { Ic, PlatIcon, HighlightedJSON } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { formatDur } from '@/components/ui'
import { isoMs, samplePayload, buildLog, type MockEvent, type LogLine } from '@/lib/mockData'
import { fetchEvent } from '@/lib/api'
import { apiLogToLogLine } from '@/lib/mappers'

function PipelineSteps({ event }: { event: MockEvent }) {
  const isOrder = event.kind.startsWith('order')
  const allSteps = [
    { k: 'verify',  label: 'HMAC verify',   sub: 'X-Shopify-Hmac-Sha256' },
    { k: 'persist', label: 'Persist event', sub: 'WebhookEvent UPSERT' },
    { k: 'enqueue', label: 'Enqueue task',  sub: `${event._task} → redis` },
    { k: 'consume', label: 'Worker pickup', sub: 'mcees-worker-02' },
    { k: 'odoo',    label: isOrder ? 'Odoo · sale.order' : event.kind === 'product.update' ? 'Odoo · stock.quant' : 'Odoo · res.partner', sub: 'XML-RPC' },
    { k: 'confirm', label: isOrder ? 'action_confirm' : 'commit', sub: isOrder ? 'reservation' : 'write' },
  ]
  let lastDoneIdx = 5
  if (event.status === 'RECEIVED')   lastDoneIdx = 1
  if (event.status === 'PROCESSING') lastDoneIdx = 3
  if (event.status === 'RETRYING')   lastDoneIdx = 3
  if (event.status === 'FAILED')     lastDoneIdx = 3

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
      {allSteps.map((s, i) => {
        const done   = i <= lastDoneIdx
        const failed = event.status === 'FAILED'  && i === lastDoneIdx + 1
        const proc   = event.status === 'PROCESSING' && i === lastDoneIdx + 1
        return (
          <span key={s.k} style={{ display: 'contents' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 6,
                          background: failed ? 'var(--err-bg)' : proc ? 'var(--info-bg)' : 'transparent' }}>
              <div style={{ position: 'relative', height: 18, marginBottom: 4 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: failed ? 'var(--err)' : done ? 'var(--ok)' : proc ? 'var(--info)' : 'var(--bg-3)',
                  border: `1px solid ${failed ? 'var(--err)' : done ? 'var(--ok)' : proc ? 'var(--info)' : 'var(--bd-1)'}`,
                  margin: '0 auto', display: 'grid', placeItems: 'center', color: 'var(--bg-0)',
                  animation: proc ? 'pulse 1.4s infinite' : 'none',
                }}>
                  {done && !failed && <Ic.check style={{ width: 9, height: 9 }} />}
                  {failed && <Ic.close style={{ width: 9, height: 9 }} />}
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--t-0)', fontWeight: 500 }}>{s.label}</div>
              <div className="mono" style={{ fontSize: 9.5, color: 'var(--t-3)', marginTop: 2 }}>{s.sub}</div>
            </div>
            {i < allSteps.length - 1 && (
              <div style={{ flex: '0 0 14px', display: 'flex', alignItems: 'center', color: i < lastDoneIdx ? 'var(--ok)' : 'var(--t-3)' }}>
                <Ic.arrow style={{ width: 12, height: 12 }} />
              </div>
            )}
          </span>
        )
      })}
    </div>
  )
}

function OverviewTab({ event }: { event: MockEvent }) {
  const total   = event._lines.reduce((s, l) => s + l.price * l.qty, 0)
  const skipped = event._lines.filter(l => l._missing).length
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section>
        <div className="lbl" style={{ marginBottom: 8 }}>Pipeline</div>
        <PipelineSteps event={event} />
      </section>

      <section>
        <div className="lbl" style={{ marginBottom: 6 }}>Summary</div>
        <div style={{ background: 'var(--bg-0)', border: '1px solid var(--bd-0)', borderRadius: 8 }}>
          {[
            ['External ID', String(event._externalId)],
            ['Source', null],
            ['Customer', `${event._customer.name} · ${event._customer.email}`],
          ].map(([k, v]) => k === 'Source' ? (
            <div key="src" className="kvrow" style={{ padding: '10px 14px' }}>
              <span className="k">Source</span>
              <span className="v"><PlatIcon source={event.source} /> &nbsp;{event.source}</span>
            </div>
          ) : (
            <div key={k} className="kvrow" style={{ padding: '10px 14px' }}>
              <span className="k">{k}</span>
              <span className="v">{v}</span>
            </div>
          ))}
          {event.kind.startsWith('order') && (<>
            <div className="kvrow" style={{ padding: '10px 14px' }}>
              <span className="k">Line items</span>
              <span className="v">{event._lines.length} {skipped > 0 && <span style={{ color: 'var(--warn)' }}>· {skipped} skipped (missing SKU)</span>}</span>
            </div>
            <div className="kvrow" style={{ padding: '10px 14px' }}>
              <span className="k">Total</span>
              <span className="v">{(event.source === 'shopify' ? '$' : '€') + total.toFixed(2)}</span>
            </div>
          </>)}
          {event.kind === 'product.update' && (<>
            <div className="kvrow" style={{ padding: '10px 14px' }}>
              <span className="k">SKU</span><span className="v">{event._lines[0].sku}</span>
            </div>
            <div className="kvrow" style={{ padding: '10px 14px' }}>
              <span className="k">Adjustment</span>
              <span className="v" style={{ color: event._delta >= 0 ? 'var(--ok)' : 'var(--err)' }}>
                {event._delta >= 0 ? '+' : ''}{event._delta} units
              </span>
            </div>
            <div className="kvrow" style={{ padding: '10px 14px' }}>
              <span className="k">Stock before → after</span>
              <span className="v">{event._stockBefore} → <span style={{ color: 'var(--t-0)' }}>{event._stockBefore + event._delta}</span></span>
            </div>
          </>)}
          <div className="kvrow" style={{ padding: '10px 14px' }}>
            <span className="k">Duration</span><span className="v">{formatDur(event.duration)}</span>
          </div>
          <div className="kvrow" style={{ padding: '10px 14px' }}>
            <span className="k">Attempts</span><span className="v">{event._attempts} / 5</span>
          </div>
        </div>
      </section>

      {event.kind.startsWith('order') && (
        <section>
          <div className="lbl" style={{ marginBottom: 6 }}>Line items</div>
          <table className="tbl" style={{ fontSize: 11.5 }}>
            <thead><tr><th style={{ width: 140 }}>SKU</th><th>Product</th><th style={{ width: 50, textAlign: 'right' }}>QTY</th><th style={{ width: 60, textAlign: 'right' }}>PRICE</th><th style={{ width: 60 }}>STATE</th></tr></thead>
            <tbody>
              {event._lines.map((l, i) => (
                <tr key={i} style={{ cursor: 'default' }}>
                  <td className="k">{l.sku}</td>
                  <td style={{ color: 'var(--t-1)' }}>{l.name}</td>
                  <td className="t tnum" style={{ textAlign: 'right' }}>{l.qty}</td>
                  <td className="t tnum" style={{ textAlign: 'right' }}>{l.price.toFixed(2)}</td>
                  <td>{l._missing ? <span className="chip warn"><span className="d" />skipped</span> : <span className="chip ok"><span className="d" />matched</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {event._failed && (
        <section>
          <div className="lbl" style={{ marginBottom: 6 }}>Failure</div>
          <div style={{ background: 'var(--err-bg)', border: '1px solid color-mix(in oklch, var(--err) 30%, transparent)', borderRadius: 8, padding: 12, fontSize: 12.5, color: 'var(--t-0)', display: 'flex', gap: 10 }}>
            <Ic.alert style={{ color: 'var(--err)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ color: 'var(--err)', fontWeight: 600, marginBottom: 3 }} className="mono">XML-RPC Fault</div>
              <div>{event._failReason}</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 11.5 }}>Attempts exhausted after 5 tries · last delay 32.4s</div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function OdooTab({ event }: { event: MockEvent }) {
  const isOrder = event.kind.startsWith('order')
  const isInv   = event.kind === 'product.update'
  const model   = isOrder ? 'sale.order' : isInv ? 'stock.quant' : 'res.partner'
  const mappings = isOrder ? [
    ['shopify.email',         '→', 'res.partner.email'],
    ['shopify.id',            '→', 'sale.order.client_order_ref'],
    ['line_items[].sku',      '→', 'product.product.default_code (lookup)'],
    ['line_items[].quantity', '→', 'sale.order.line.product_uom_qty'],
    ['line_items[].price',    '→', 'sale.order.line.price_unit'],
  ] : isInv ? [
    ['inventory_item.sku',    '→', 'product.product.default_code (lookup)'],
    ['available_adjustment',  '→', 'stock.quant.quantity (additive)'],
    ['location_id',           '→', 'stock.quant.location_id'],
  ] : [
    ['customer.email',        '→', 'res.partner.email (key)'],
    ['customer.first_name',   '→', 'res.partner.name'],
    ['customer.tags',         '→', 'res.partner.category_id'],
  ]
  const xmlCall = `xmlrpc.client.ServerProxy(
  ODOO_URL + '/xmlrpc/2/object'
).execute_kw(
  '${model}',
  '${event.status === 'SYNCED' ? 'write' : 'create'}',
  [${event.status === 'SYNCED' ? `[${4000 + (event._externalId % 8888)}], ` : ''}{
    ${isOrder
      ? `'partner_id': ${4000 + (event._externalId % 8888)},\n    'client_order_ref': '${event.source[0].toUpperCase()}-${event._externalId}',\n    'order_line': [(0, 0, {...}) for line in lines if line.matched]`
      : isInv
        ? `'product_id': ${2000 + (event._externalId % 200)},\n    'location_id': 8,\n    'inventory_quantity': ${event._stockBefore + event._delta}`
        : `'email': '${event._customer.email}',\n    'name': '${event._customer.name}'`}
  }]
)`
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section>
        <div className="lbl" style={{ marginBottom: 6 }}>Target model</div>
        <div className="mono" style={{ background: 'var(--bg-0)', border: '1px solid var(--bd-0)', borderRadius: 8, padding: '10px 14px', fontSize: 12.5 }}>
          <span style={{ color: 'var(--info)' }}>{model}</span>
          <span style={{ color: 'var(--t-3)', margin: '0 6px' }}>·</span>
          <span style={{ color: event.status === 'SYNCED' ? 'var(--ok)' : 'var(--t-2)' }}>
            {event.status === 'SYNCED' ? `id=${4000 + (event._externalId % 8888)}` : 'not yet created'}
          </span>
        </div>
      </section>
      <section>
        <div className="lbl" style={{ marginBottom: 6 }}>XML-RPC call</div>
        <pre className="code">{xmlCall}</pre>
      </section>
      <section>
        <div className="lbl" style={{ marginBottom: 6 }}>Mapping</div>
        <div className="log">
          {mappings.map(([from, arrow, to]) => (
            <div className="line" key={from} style={{ gridTemplateColumns: '1fr 24px 1fr' }}>
              <span className="m mono">{from}</span>
              <span className="t">{arrow}</span>
              <span className="m mono" style={{ color: 'var(--t-0)' }}>{to}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

type DrawerTab = 'overview' | 'payload' | 'log' | 'odoo'

export function EventDrawer({ event, onClose, onRetry, canRetry: roleCanRetry = true }: {
  event: MockEvent | null
  onClose: () => void
  onRetry: (ev: MockEvent) => void
  canRetry?: boolean
}) {
  const [tab, setTab]         = useState<DrawerTab>('overview')
  const [retrying, setRetrying] = useState(false)

  // Real data fetched from the API when the drawer opens
  const [remotePayload,  setRemotePayload]  = useState<Record<string, unknown> | null>(null)
  const [remoteLogLines, setRemoteLogLines] = useState<LogLine[] | null>(null)

  useEffect(() => {
    if (!event) return
    setRemotePayload(null)
    setRemoteLogLines(null)
    fetchEvent(event.id)
      .then(data => {
        setRemotePayload(data.raw_payload)
        setRemoteLogLines(data.logs?.map(apiLogToLogLine) ?? [])
      })
      .catch(() => { /* fall through to mock fallbacks below */ })
  }, [event?.id])

  // Fall back to mock data while the fetch is in flight or if the API is unavailable
  const payload  = remotePayload  ?? (event ? samplePayload(event) : null)
  const logLines = remoteLogLines ?? (event ? buildLog(event) : [])

  useEffect(() => {
    if (!event) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [event, onClose])

  if (!event) return null

  const handleRetry = () => {
    setRetrying(true)
    setTimeout(() => { setRetrying(false); onRetry(event) }, 1700)
  }
  const isRetryable = event.status === 'FAILED' || event.status === 'RETRYING'
  const canRetry = isRetryable && roleCanRetry

  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-h">
          <PlatIcon source={event.source} />
          <div className="col" style={{ gap: 2 }}>
            <div className="title">{event.kind}</div>
            <div className="id">ext_id: {event._externalId} · task_id: <span style={{ color: 'var(--t-0)' }}>{event._task}_{String(event._externalId).slice(-6)}</span></div>
          </div>
          <div className="grow" />
          <StatusChip status={event.status} />
          <button className="iconbtn" onClick={onClose} title="Close (Esc)"><Ic.close /></button>
        </div>

        <div className="tabs">
          {(['overview', 'payload', 'log', 'odoo'] as DrawerTab[]).map(t => (
            <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t === 'log' ? <>Sync log<span className="mono" style={{ color: 'var(--t-3)', marginLeft: 6, fontSize: 10 }}>{logLines.length}</span></> : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {tab === 'overview' && <OverviewTab event={event} />}
          {tab === 'payload' && (
            <div style={{ padding: 16 }}>
              <div className="row" style={{ marginBottom: 10, fontSize: 11, color: 'var(--t-2)' }}>
                <span className="mono">POST /api/v1/webhooks/{event.source}/{event.kind.split('.')[0]}</span>
                <div className="grow" />
                <span className="chip neu"><span className="d" />{payload ? (JSON.stringify(payload).length / 1024).toFixed(1) : 0} KB</span>
                <span className="chip ok"><span className="d" />HMAC OK</span>
              </div>
              {payload && <HighlightedJSON obj={payload} />}
            </div>
          )}
          {tab === 'log' && (
            <div style={{ padding: 16 }}>
              <div className="log">
                {logLines.map((ln, i) => (
                  <div className="line" key={i}>
                    <span className="t">{isoMs(ln.at).slice(11, 23)}</span>
                    <span className={`lv ${ln.lv}`}>{ln.lv}</span>
                    <span className="m">{ln.m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'odoo' && <OdooTab event={event} />}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bd-0)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="muted" style={{ fontSize: 11.5 }}>
            Created <span className="mono" style={{ color: 'var(--t-0)' }}>{isoMs(new Date(event.createdAtMs)).slice(0, 19)}Z</span>
          </div>
          <div className="grow" />
          <button className="btn ghost">View in Odoo <Ic.ext /></button>
          {canRetry ? (
            <button className="btn primary" onClick={handleRetry} disabled={retrying}>
              {retrying
                ? <><span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />Retrying…</>
                : <><Ic.retry />Retry sync</>}
            </button>
          ) : (
            <button
              className="btn"
              disabled
              title={isRetryable && !roleCanRetry ? 'Requires OPERATOR or ADMIN role' : undefined}
            >
              {isRetryable && !roleCanRetry
                ? 'Read-only'
                : event.status === 'SYNCED' ? 'Already synced' : 'In progress…'}
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
