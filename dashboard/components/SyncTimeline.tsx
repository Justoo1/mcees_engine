'use client'

import { useMemo } from 'react'
import { Ic, PlatIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { formatDur } from '@/components/ui'
import { timeStr, type MockEvent, type FeedItem, type SparklineData } from '@/lib/mockData'

interface Filters { q: string; source: string; status: string }

function Filters({ filters, setFilters, paused, setPaused, eventCount }: {
  filters: Filters
  setFilters: (f: Filters) => void
  paused: boolean
  setPaused: (p: boolean) => void
  eventCount: number
}) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
      <div className="search">
        <Ic.search style={{ color: 'var(--t-2)' }} />
        <input
          placeholder="Search SKU, email, external id…"
          value={filters.q}
          onChange={e => setFilters({ ...filters, q: e.target.value })}
        />
        <span className="kbd">/</span>
      </div>
      <div className="seg">
        {['all', 'shopify', 'woocommerce'].map(s => (
          <button key={s} className={filters.source === s ? 'on' : ''}
                  onClick={() => setFilters({ ...filters, source: s })}>
            {s === 'all' ? 'All sources' : s}
          </button>
        ))}
      </div>
      <div className="seg">
        {['all', 'SYNCED', 'PROCESSING', 'FAILED', 'RETRYING', 'RECEIVED'].map(s => (
          <button key={s} className={filters.status === s ? 'on' : ''}
                  onClick={() => setFilters({ ...filters, status: s })}>
            {s === 'all' ? 'All status' : s.toLowerCase()}
          </button>
        ))}
      </div>
      <div className="grow" />
      <button className="btn ghost" onClick={() => setPaused(!paused)}>
        {paused ? <Ic.play /> : <Ic.pause />} {paused ? 'Live OFF' : 'Live'}
      </button>
      <div className="lbl tnum" style={{ letterSpacing: '0.04em' }}>{eventCount} events</div>
    </div>
  )
}

function EventRow({ ev, selected, onClick }: {
  ev: MockEvent; selected: boolean; onClick: () => void
}) {
  const lineSummary = ev._lines?.length
    ? ev._lines.map(l => l.sku).slice(0, 2).join(', ') + (ev._lines.length > 2 ? ` +${ev._lines.length - 2}` : '')
    : '—'
  const subjectLabel = ev.kind.startsWith('order')
    ? `${ev.source === 'shopify' ? '#' : 'WC-'}${String(ev._externalId).slice(-5)}`
    : ev.kind.startsWith('customer')
      ? ev._customer.email
      : `${ev._lines[0].sku} ${ev._delta >= 0 ? '+' : ''}${ev._delta}`
  return (
    <tr className={`${selected ? 'sel' : ''} ${ev._isNew ? 'new' : ''}`} onClick={onClick}>
      <td className="t">{timeStr(new Date(ev.createdAtMs))}</td>
      <td><PlatIcon source={ev.source} /></td>
      <td>
        <span className="ev-type">{ev.kind}</span>
        <span className="ev-sub mono">{subjectLabel}</span>
      </td>
      <td className="k">{ev._customer.email}</td>
      <td className="k" style={{ color: 'var(--t-2)' }}>{lineSummary}</td>
      <td><StatusChip status={ev.status} /></td>
      <td className="t tnum">{formatDur(ev.duration)}</td>
      <td className="t tnum">{ev._attempts}/5</td>
    </tr>
  )
}

function LiveStream({ feed }: { feed: FeedItem[] }) {
  return (
    <div className="stream">
      {feed.slice(0, 10).map(f => (
        <div className="ln" key={f.key}>
          <span className="t">{timeStr(new Date(f.createdAtMs))}</span>
          <span className="src" style={{ color: f.source === 'shopify' ? 'oklch(0.78 0.16 145)' : 'oklch(0.66 0.18 305)' }}>
            {f.source.toUpperCase().slice(0, 6)}
          </span>
          <span>
            <span style={{ color: 'var(--t-0)' }}>{f.kind}</span>
            <span style={{ color: 'var(--t-3)', marginLeft: 6 }}>→</span>
            <span style={{ color: 'var(--t-2)', marginLeft: 6 }}>{f.summary}</span>
          </span>
          <span className="muted" style={{ fontSize: 10 }}>id={f.id.slice(-6)}</span>
        </div>
      ))}
    </div>
  )
}

function ThroughputChart({ data, failed }: { data: number[]; failed: number[] }) {
  const w = 100, h = 100
  const max = Math.max(...data, 1)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      {[0.25, 0.5, 0.75].map(y => (
        <line key={y} x1="0" y1={h * y} x2={w} y2={h * y} stroke="var(--grid)" strokeWidth="0.3" />
      ))}
      {data.map((v, i) => {
        const bw = w / data.length
        return (
          <g key={i}>
            <rect x={i * bw + 0.4} y={h - (v / max) * h} width={bw - 0.8} height={(v / max) * h} fill="var(--acc)" opacity="0.85" />
            <rect x={i * bw + 0.4} y={h - (failed[i] / max) * h} width={bw - 0.8} height={(failed[i] / max) * h} fill="var(--err)" opacity="0.9" />
          </g>
        )
      })}
    </svg>
  )
}

export function SyncTimeline({ events, selected, setSelected, paused, setPaused, filters, setFilters, sparklines, feed, page, setPage }: {
  events: MockEvent[]
  selected: MockEvent | null
  setSelected: (ev: MockEvent | null) => void
  paused: boolean
  setPaused: (p: boolean) => void
  filters: Filters
  setFilters: (f: Filters) => void
  sparklines: SparklineData
  feed: FeedItem[]
  page: number
  setPage: (p: number) => void
}) {
  const filtered = useMemo(() => events.filter(e => {
    if (filters.source !== 'all' && e.source !== filters.source) return false
    if (filters.status !== 'all' && e.status !== filters.status) return false
    if (filters.q) {
      const q = filters.q.toLowerCase()
      const hay = [e._customer.email, e.kind, String(e._externalId), ...e._lines.map(l => l.sku)].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [events, filters])

  const PER = 14
  const pages = Math.max(1, Math.ceil(filtered.length / PER))
  const start = (page - 1) * PER
  const pageRows = filtered.slice(start, start + PER)

  const DIST = [
    { k: 'order.create',    v: 1247, c: 'var(--acc)' },
    { k: 'order.update',    v: 486,  c: 'var(--info)' },
    { k: 'inventory.update',v: 614,  c: 'var(--warn)' },
    { k: 'customer.create', v: 308,  c: 'oklch(0.74 0.14 215)' },
    { k: 'customer.update', v: 217,  c: 'var(--t-2)' },
  ]

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 12 }}>
        <div className="col" style={{ gap: 12, minWidth: 0 }}>
          <Filters filters={filters} setFilters={setFilters} paused={paused} setPaused={setPaused} eventCount={filtered.length} />

          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>TIME</th>
                  <th style={{ width: 36 }}>SRC</th>
                  <th>EVENT</th>
                  <th style={{ width: 220 }}>CUSTOMER</th>
                  <th style={{ width: 180 }}>LINES / SKU</th>
                  <th style={{ width: 110 }}>STATUS</th>
                  <th style={{ width: 70 }}>DUR</th>
                  <th style={{ width: 50 }}>ATT</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(ev => (
                  <EventRow key={ev.id} ev={ev}
                            selected={!!selected && selected.id === ev.id}
                            onClick={() => setSelected(ev)} />
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--t-2)' }}>No events match these filters.</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid var(--bd-0)', gap: 10 }}>
              <div className="muted" style={{ fontSize: 11.5 }}>
                Showing <b style={{ color: 'var(--t-0)' }} className="mono tnum">{start + 1}–{Math.min(start + PER, filtered.length)}</b>{' '}
                of <b style={{ color: 'var(--t-0)' }} className="mono tnum">{filtered.length}</b>
              </div>
              <div className="grow" />
              <div className="pager">
                <button className="btn ghost" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}><Ic.chevL /></button>
                <span className="mono tnum">{page} / {pages}</span>
                <button className="btn ghost" onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages}><Ic.chevR /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 12, minWidth: 0 }}>
          <div className="card">
            <div className="card-h">
              <div className="t">Live ingest</div>
              <div className="right"><span className="chip ok"><span className="d" />streaming</span></div>
            </div>
            <LiveStream feed={feed} />
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Throughput · last 24h</div>
              <div className="right muted" style={{ fontSize: 11 }}>req / hour</div>
            </div>
            <div style={{ padding: '16px 14px 8px', position: 'relative', height: 168 }}>
              <ThroughputChart data={sparklines.total} failed={sparklines.failed} />
            </div>
          </div>

          <div className="card">
            <div className="card-h"><div className="t">Distribution by event type</div></div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {DIST.map(row => (
                <div key={row.k} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 50px', gap: 10, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: 'var(--t-1)' }} className="mono">{row.k}</span>
                  <div className="qbar"><span style={{ width: (row.v / 1247 * 100) + '%', background: row.c }} /></div>
                  <span className="mono tnum" style={{ color: 'var(--t-0)', textAlign: 'right' }}>{row.v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
