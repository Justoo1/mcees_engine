'use client'

import { Ic } from '@/components/icons'
import { Sparkline } from '@/components/ui'
import type { MockEvent, SparklineData } from '@/lib/mockData'
import type { ApiStats } from '@/lib/api'

function formatBig(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}

function KPICard({ label, value, suffix, delta, deltaTone = 'up', spark, sparkColor }: {
  label: string; value: string; suffix: string
  delta: string; deltaTone?: 'up' | 'down'
  spark: number[]; sparkColor?: string
}) {
  return (
    <div className="kpi">
      <div className="head">
        <div className="ic">
          {label === 'Total events' && <Ic.activity />}
          {label === 'Synced'       && <Ic.check />}
          {label === 'Failed'       && <Ic.alert />}
          {label === 'Avg duration' && <Ic.dot3 />}
        </div>
        <div className="lbl">{label}</div>
      </div>
      <div className="v">
        {value}<small>{suffix}</small>
      </div>
      <div className="meta">
        <span className={`delta ${deltaTone}`}>{delta}</span>
        <span className="muted">vs prev 24h</span>
      </div>
      <Sparkline data={spark} color={sparkColor ?? 'var(--acc)'} />
    </div>
  )
}

export function StatsBar({ events, sparklines, apiStats }: {
  events: MockEvent[]
  sparklines: SparklineData
  apiStats?: ApiStats | null
}) {
  // Prefer real 24h counts from the stats endpoint; fall back to in-memory count
  const total  = apiStats?.total_24h  ?? events.length
  const synced = apiStats?.synced     ?? events.filter(e => e.status === 'SYNCED').length
  const failed = apiStats?.failed     ?? events.filter(e => e.status === 'FAILED').length
  const avgMs  = apiStats?.avg_processing_ms
    ?? (() => {
      const durs = events.filter(e => e.duration != null).map(e => e.duration!)
      return durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0
    })()

  return (
    <div className="kpi-grid">
      <KPICard label="Total events" value={formatBig(total)} suffix="last 24h"
               delta="+12.4%" spark={sparklines.total} />
      <KPICard label="Synced" value={formatBig(synced)}
               suffix={`${total ? Math.round((synced / total) * 100) : 0}%`}
               delta="+9.8%" spark={sparklines.synced} sparkColor="var(--ok)" />
      <KPICard label="Failed" value={String(failed)}
               suffix={`${total ? (failed / total * 100).toFixed(1) : 0}%`}
               delta={failed > 8 ? '+24%' : '−6%'} deltaTone={failed > 8 ? 'down' : 'up'}
               spark={sparklines.failed} sparkColor="var(--err)" />
      <KPICard label="Avg duration" value={(avgMs / 1000).toFixed(2)} suffix="s"
               delta="−18%" spark={sparklines.dur} sparkColor="var(--info)" />
    </div>
  )
}
