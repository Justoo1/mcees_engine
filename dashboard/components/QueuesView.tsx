'use client'

import { Ic } from '@/components/icons'
import { formatBig } from '@/components/ui'
import type { QueueInfo, WorkerInfo } from '@/lib/api'

interface Props {
  queues:  QueueInfo[]
  workers: WorkerInfo[]
  loading: boolean
  error?:  string
}

const ICON_BY_QUEUE: Record<string, keyof typeof Ic> = {
  orders:    'inbox',
  customers: 'activity',
  inventory: 'queue',
}

function depthClass(depth: number) {
  if (depth >= 200) return 'err'
  if (depth >= 50)  return 'warn'
  return ''
}

function depthPct(depth: number) {
  return Math.min(100, (depth / 200) * 100)
}

export function QueuesView({ queues, workers, loading, error }: Props) {
  const totalDepth = queues.reduce((s, q) => s + q.depth, 0)
  const totalActive = queues.reduce((s, q) => s + q.active, 0)

  return (
    <div className="page">
      <div className="row" style={{ gap: 10 }}>
        <div className="lbl">Queues · broker depth</div>
        {workers.length > 0
          ? <span className="chip ok"><span className="d" />{workers.length} worker{workers.length === 1 ? '' : 's'} online</span>
          : <span className="chip warn"><span className="d" />no workers online</span>}
        {totalDepth > 0 && <span className="chip info"><span className="d" />{formatBig(totalDepth)} queued</span>}
        <div className="grow" />
        <span className="muted" style={{ fontSize: 11.5 }}>
          Active: <span className="mono tnum" style={{ color: 'var(--t-0)' }}>{totalActive}</span>
          &nbsp;·&nbsp;Total depth: <span className="mono tnum" style={{ color: 'var(--t-0)' }}>{totalDepth}</span>
        </span>
      </div>

      {error && (
        <div className="card" style={{ padding: '10px 14px', color: 'var(--err)', fontSize: 12 }}>
          <Ic.alert style={{ width: 12, height: 12, verticalAlign: 'middle', marginRight: 6 }} />
          Backend unreachable: {error}
        </div>
      )}

      <div className="card">
        <div className="card-h"><div className="t">Queue depth</div><div className="right muted" style={{ fontSize: 11 }}>redis · LLEN</div></div>
        <div style={{ padding: '4px 16px' }}>
          {queues.length === 0 && !loading && (
            <div className="muted" style={{ padding: '16px 0', fontSize: 12 }}>No queue data.</div>
          )}
          {queues.map(q => {
            const IconCmp = Ic[ICON_BY_QUEUE[q.name] ?? 'queue']
            return (
              <div className="hr-row" key={q.name}>
                <div className="col">
                  <span className="label" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconCmp style={{ width: 12, height: 12, color: 'var(--t-2)' }} />
                    {q.name}
                  </span>
                  <span className="meta">{q.active} active · {q.reserved} reserved</span>
                </div>
                <div><div className={`qbar ${depthClass(q.depth)}`}><span style={{ width: depthPct(q.depth) + '%' }} /></div></div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <span className="mono tnum" style={{ fontSize: 12, color: 'var(--t-0)' }}>{q.depth}</span>
                  <span className="muted" style={{ fontSize: 11 }}>jobs</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {q.depth >= 200
                    ? <span className="chip err"><span className="d" />backlog</span>
                    : q.depth >= 50
                      ? <span className="chip warn"><span className="d" />elevated</span>
                      : <span className="chip ok"><span className="d" />nominal</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><div className="t">Workers</div><div className="right muted" style={{ fontSize: 11 }}>celery · inspect</div></div>
        <div style={{ padding: '4px 16px' }}>
          {workers.length === 0 && !loading && (
            <div className="muted" style={{ padding: '16px 0', fontSize: 12 }}>
              No workers responding to <span className="mono">celery inspect ping</span>. Worker container may be down.
            </div>
          )}
          {workers.map(w => (
            <div className="hr-row" key={w.name} style={{ gridTemplateColumns: '260px 1fr 80px 100px' }}>
              <div className="col">
                <span className="label mono" style={{ fontSize: 12 }}>{w.name}</span>
                <span className="meta">
                  {w.queues.length ? w.queues.join(' · ') : 'no queues bound'}
                </span>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {w.queues.map(q => (
                  <span key={q} className="chip neu" style={{ fontSize: 10.5 }}>{q}</span>
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <span className="mono tnum" style={{ fontSize: 12, color: 'var(--t-0)' }}>{w.active}</span>
                <span className="muted" style={{ fontSize: 11 }}>active</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono tnum" style={{ fontSize: 11, color: 'var(--t-0)' }}>{formatBig(w.processed)}</div>
                <span className="chip ok" style={{ marginTop: 2 }}><span className="d" />{w.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
