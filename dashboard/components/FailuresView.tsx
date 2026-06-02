'use client'

import { useMemo, useState } from 'react'
import { Ic, PlatIcon } from '@/components/icons'
import { formatAgo } from '@/components/ui'
import { retryEvent } from '@/lib/api'
import type { MockEvent } from '@/lib/mockData'

interface Props {
  events:  MockEvent[]
  loading: boolean
  onOpen:  (e: MockEvent) => void
  onRetry: (e: MockEvent) => void
  onBulkRetried?: (count: number, errored: number) => void
}

const SOURCES   = ['all', 'shopify', 'woocommerce'] as const
const EV_TYPES  = ['all', 'order', 'customer', 'product'] as const

function truncate(s: string, max: number) {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function eventTypeOf(kind: string): string {
  // mock 'kind' is e.g. 'order.create', 'customer.update', 'product.update'
  return kind.split('.')[0]
}

export function FailuresView({ events, loading, onOpen, onRetry, onBulkRetried }: Props) {
  const [source, setSource]     = useState<typeof SOURCES[number]>('all')
  const [evType, setEvType]     = useState<typeof EV_TYPES[number]>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy]         = useState(false)

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (source !== 'all' && e.source !== source) return false
      if (evType !== 'all' && eventTypeOf(e.kind) !== evType) return false
      return true
    })
  }, [events, source, evType])

  const allVisibleSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id))

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(e => e.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const retrySelected = async () => {
    if (selected.size === 0 || busy) return
    setBusy(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(ids.map(id => retryEvent(id)))
    const queued  = results.filter(r => r.status === 'fulfilled').length
    const errored = results.length - queued
    onBulkRetried?.(queued, errored)
    setSelected(new Set())
    setBusy(false)
  }

  return (
    <div className="page">
      <div className="row" style={{ gap: 10 }}>
        <div className="lbl">Failures · permanent errors</div>
        <span className={`chip ${events.length > 0 ? 'err' : 'ok'}`}>
          <span className="d" />{events.length} failed
        </span>
        <div className="grow" />
        <div className="seg">
          {SOURCES.map(s => (
            <button key={s} className={source === s ? 'on' : ''} onClick={() => setSource(s)}>{s}</button>
          ))}
        </div>
        <div className="seg">
          {EV_TYPES.map(s => (
            <button key={s} className={evType === s ? 'on' : ''} onClick={() => setEvType(s)}>{s}</button>
          ))}
        </div>
        <button
          className="btn primary"
          onClick={retrySelected}
          disabled={selected.size === 0 || busy}
          title="Retry the selected failed events"
        >
          <Ic.retry /> Retry {selected.size > 0 ? `${selected.size} ` : ''}selected
        </button>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  disabled={filtered.length === 0}
                  aria-label="Select all visible"
                />
              </th>
              <th style={{ width: 90 }}>TIME</th>
              <th style={{ width: 36 }}>SRC</th>
              <th style={{ width: 140 }}>EVENT</th>
              <th style={{ width: 120 }}>EXT_ID</th>
              <th style={{ width: 50 }}>ATT</th>
              <th>ERROR</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(ev => {
              const isSel = selected.has(ev.id)
              return (
                <tr
                  key={ev.id}
                  className={isSel ? 'sel' : ''}
                  onClick={() => onOpen(ev)}
                  style={{ cursor: 'pointer' }}
                >
                  <td onClick={e => { e.stopPropagation(); toggleOne(ev.id) }}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleOne(ev.id)} aria-label="Select event" />
                  </td>
                  <td className="t">{formatAgo(Date.now() - ev.createdAtMs)}</td>
                  <td><PlatIcon source={ev.source} /></td>
                  <td><span className="ev-type">{ev.kind}</span></td>
                  <td className="k">#{ev._externalId}</td>
                  <td className="t" style={{ textAlign: 'center' }}>{ev._attempts}</td>
                  <td>
                    <span
                      className="mono"
                      style={{ color: 'var(--err)', fontSize: 11.5 }}
                      title={ev._failReason || 'Unknown error'}
                    >
                      {truncate(ev._failReason || 'Unknown error', 80)}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button
                      className="btn ghost"
                      onClick={() => onRetry(ev)}
                      title="Retry this event"
                    >
                      <Ic.retry /> retry
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--t-2)' }}>
                  {loading ? 'Loading…' : events.length === 0 ? 'No failed events. All clear.' : 'No failures match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
