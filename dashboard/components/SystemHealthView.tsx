'use client'

import { Ic } from '@/components/icons'
import { formatAgo } from '@/components/ui'
import type { HealthResponse, HealthCheck } from '@/lib/api'

interface Props {
  health:  HealthResponse | null
  loading: boolean
}

const CHECK_META: { key: keyof HealthResponse['checks']; label: string; sub: string; icon: keyof typeof Ic }[] = [
  { key: 'postgres', label: 'PostgreSQL', sub: 'asyncpg pool',   icon: 'diagram' },
  { key: 'redis',    label: 'Redis',      sub: 'broker · PING',  icon: 'queue'   },
  { key: 'celery',   label: 'Celery',     sub: 'inspect.ping',   icon: 'activity'},
  { key: 'odoo',     label: 'Odoo',       sub: 'XML-RPC auth',   icon: 'cog'     },
]

function statusChip(status: HealthResponse['status']) {
  if (status === 'healthy')   return <span className="chip ok"><span className="d" />healthy</span>
  if (status === 'degraded')  return <span className="chip warn"><span className="d" />degraded</span>
  return <span className="chip err"><span className="d" />unhealthy</span>
}

function CheckCard({ label, sub, icon, check }: { label: string; sub: string; icon: keyof typeof Ic; check: HealthCheck }) {
  const IconCmp = Ic[icon]
  const tone = check.ok ? 'ok' : 'err'
  return (
    <div
      className="kpi"
      style={{
        borderColor: check.ok ? 'oklch(0.74 0.15 158 / 0.35)' : 'oklch(0.68 0.2 26 / 0.35)',
        background: check.ok ? 'var(--ok-bg)' : 'var(--err-bg)',
      }}
    >
      <div className="head">
        <div className="ic" style={{ color: `var(--${tone})` }}><IconCmp /></div>
        <div className="col" style={{ gap: 1 }}>
          <span className="lbl">{label}</span>
          <span className="muted" style={{ fontSize: 10.5 }}>{sub}</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {check.ok
            ? <span className="chip ok"><span className="d" />ok</span>
            : <span className="chip err"><span className="d" />down</span>}
        </div>
      </div>
      <div className="v">
        {check.latency_ms != null ? check.latency_ms : '—'}
        <small>ms</small>
      </div>
      <div className="meta" title={check.detail}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--t-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}>
          {check.detail}
        </span>
      </div>
    </div>
  )
}

export function SystemHealthView({ health, loading }: Props) {
  return (
    <div className="page">
      <div className="row" style={{ gap: 10 }}>
        <div className="lbl">System health · dependency probes</div>
        {health
          ? statusChip(health.status)
          : <span className="chip neu"><span className="d" />{loading ? 'probing…' : 'no data'}</span>}
        <div className="grow" />
        {health && (
          <span className="muted" style={{ fontSize: 11.5 }}>
            Last checked: <span className="mono tnum" style={{ color: 'var(--t-0)' }}>
              {formatAgo(Date.now() - new Date(health.timestamp).getTime())}
            </span>
          </span>
        )}
      </div>

      {health?.error && (
        <div className="card" style={{ padding: '10px 14px', color: 'var(--err)', fontSize: 12 }}>
          <Ic.alert style={{ width: 12, height: 12, verticalAlign: 'middle', marginRight: 6 }} />
          {health.error}
        </div>
      )}

      <div className="kpi-grid">
        {CHECK_META.map(meta => (
          <CheckCard
            key={meta.key}
            label={meta.label}
            sub={meta.sub}
            icon={meta.icon}
            check={health?.checks[meta.key] ?? { ok: false, latency_ms: null, detail: loading ? 'probing…' : 'no data' }}
          />
        ))}
      </div>

      <div className="card">
        <div className="card-h"><div className="t">What these checks mean</div></div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--t-1)' }}>
          <div><b style={{ color: 'var(--t-0)' }}>PostgreSQL</b> — <span className="muted">acquires a connection from the asyncpg pool and runs <span className="mono">SELECT 1</span>. Latency is the round-trip including pool acquire.</span></div>
          <div><b style={{ color: 'var(--t-0)' }}>Redis</b> — <span className="muted"><span className="mono">PING</span> on the broker URL. Used by Celery and by the distributed inventory lock.</span></div>
          <div><b style={{ color: 'var(--t-0)' }}>Celery</b> — <span className="muted"><span className="mono">control.inspect().ping()</span>. Reports number of workers that responded within 0.6s.</span></div>
          <div><b style={{ color: 'var(--t-0)' }}>Odoo</b> — <span className="muted">XML-RPC <span className="mono">common.authenticate</span> against the configured Odoo instance with a 3s timeout. Failures here mean ERP sync will retry but eventually move events to FAILED.</span></div>
        </div>
      </div>
    </div>
  )
}
