'use client'

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    SYNCED:     { cls: 'ok',   label: 'synced' },
    PROCESSING: { cls: 'proc', label: 'processing' },
    FAILED:     { cls: 'err',  label: 'failed' },
    RECEIVED:   { cls: 'neu',  label: 'received' },
    RETRYING:   { cls: 'warn', label: 'retrying' },
  }
  const m = map[status] ?? map.RECEIVED
  return (
    <span className={`chip ${m.cls}`}>
      <span className="d" />{m.label}
    </span>
  )
}

export function Sparkline({
  data,
  color = 'var(--acc)',
  fill = true,
  height = 44,
}: {
  data: number[]
  color?: string
  fill?: boolean
  height?: number
}) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const w = 100, h = height
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return [x, y]
  })
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = line + ` L${w} ${h} L0 ${h} Z`
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {fill && <path d={area} fill={color} opacity="0.13" />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Ring({
  value,
  max = 100,
  label,
  sub,
}: {
  value: number; max?: number; label: string; sub: string
}) {
  const r = 22, c = 2 * Math.PI * r
  const pct = Math.min(1, value / max)
  const tone = pct > 0.85 ? 'var(--err)' : pct > 0.6 ? 'var(--warn)' : 'var(--acc)'
  return (
    <svg className="ring" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--bd-1)" strokeWidth="3.5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={tone} strokeWidth="3.5"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x="28" y="29" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="13" fill="var(--t-0)" fontWeight="500">{label}</text>
      <text x="28" y="40" textAnchor="middle" fontFamily="Inter" fontSize="7.5" fill="var(--t-2)" letterSpacing="0.1em">{sub}</text>
    </svg>
  )
}

export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 5) return 'now'
  if (s < 60) return s + 's ago'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  return Math.floor(h / 24) + 'd ago'
}

export function formatDur(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(2) + 's'
}

export function formatBig(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}
