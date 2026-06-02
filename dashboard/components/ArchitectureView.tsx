'use client'

import { Ring } from '@/components/ui'
import { WORKERS, SERVICES } from '@/lib/mockData'

const NODES = [
  { id: 'shopify', x: 24,  y: 30,  w: 184, h: 88,  label: 'WEBHOOK SOURCE', name: 'Shopify',            meta: [['rate', '142 / min'], ['version', '2024-10']] },
  { id: 'woo',     x: 24,  y: 150, w: 184, h: 88,  label: 'WEBHOOK SOURCE', name: 'WooCommerce',         meta: [['rate', '38 / min'],  ['version', '8.4']] },
  { id: 'api',     x: 250, y: 90,  w: 200, h: 100, label: 'INGESTION',      name: 'FastAPI',             meta: [['p99', '38ms'],       ['conns', '24/200']] },
  { id: 'pg',      x: 250, y: 230, w: 200, h: 80,  label: 'DATABASE',       name: 'PostgreSQL 16',       meta: [['conns', '12/100'],   ['size', '2.4 GB']] },
  { id: 'redis',   x: 490, y: 90,  w: 184, h: 100, label: 'BROKER',         name: 'Redis 7',             meta: [['depth', '40'],       ['mem', '128 MB']] },
  { id: 'w1',      x: 714, y: 24,  w: 180, h: 64,  label: 'WORKER',         name: 'worker-01 · orders',      meta: [['depth', '14']] },
  { id: 'w2',      x: 714, y: 96,  w: 180, h: 64,  label: 'WORKER',         name: 'worker-02 · orders',      meta: [['depth', '18']] },
  { id: 'w3',      x: 714, y: 168, w: 180, h: 64,  label: 'WORKER',         name: 'worker-03 · inventory',   meta: [['depth', '6']] },
  { id: 'w4',      x: 714, y: 240, w: 180, h: 64,  label: 'WORKER',         name: 'worker-04 · customers',   meta: [['depth', '2']] },
  { id: 'odoo',    x: 934, y: 130, w: 200, h: 100, label: 'ERP',            name: 'Odoo 17',             meta: [['p99', '740ms'],      ['xmlrpc', 'OK']] },
] as const

type NodeId = typeof NODES[number]['id']

const EDGES: [NodeId, NodeId, string][] = [
  ['shopify', 'api',   'HTTPS · HMAC'],
  ['woo',     'api',   'HTTPS · HMAC'],
  ['api',     'pg',    'asyncpg · UPSERT'],
  ['api',     'redis', 'celery enqueue'],
  ['redis',   'w1',    ''],
  ['redis',   'w2',    ''],
  ['redis',   'w3',    ''],
  ['redis',   'w4',    ''],
  ['w1',      'odoo',  ''],
  ['w2',      'odoo',  'sale.order'],
  ['w3',      'odoo',  'stock.quant'],
  ['w4',      'odoo',  'res.partner'],
]

const PACKETS = [
  { path: ['shopify', 'api', 'redis', 'w2', 'odoo'] as NodeId[], color: 'var(--ok)',   duration: 7.0, offset: 0 },
  { path: ['woo',     'api', 'redis', 'w1', 'odoo'] as NodeId[], color: 'var(--info)', duration: 8.4, offset: 2.0 },
  { path: ['shopify', 'api', 'redis', 'w3', 'odoo'] as NodeId[], color: 'var(--warn)', duration: 6.4, offset: 4.0 },
]

export function ArchitectureView({ eventsPerMin, qdepth }: { eventsPerMin: number; qdepth: number }) {
  const map = Object.fromEntries(NODES.map(n => [n.id, n])) as Record<NodeId, typeof NODES[number]>

  return (
    <div className="page">
      <div className="row" style={{ gap: 10 }}>
        <div className="lbl">Architecture · live trace</div>
        <span className="chip ok"><span className="d" />all systems nominal</span>
        <div className="grow" />
        <span className="muted" style={{ fontSize: 11.5 }}>
          Throughput: <span className="mono tnum" style={{ color: 'var(--t-0)' }}>{eventsPerMin}/min</span>
          &nbsp;·&nbsp;Queue depth: <span className="mono tnum" style={{ color: 'var(--t-0)' }}>{qdepth}</span>
        </span>
      </div>

      <div className="arch-wrap" style={{ minHeight: 360 }}>
        <svg width="100%" height="360" viewBox="0 0 1160 360" style={{ display: 'block' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L5,3 L0,6 Z" fill="var(--bd-2)" />
            </marker>
          </defs>
          {EDGES.map(([a, b, lbl], i) => {
            const A = map[a], B = map[b]
            const x1 = A.x + A.w, y1 = A.y + A.h / 2
            const x2 = B.x,       y2 = B.y + B.h / 2
            const mx = (x1 + x2) / 2
            const d = `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
            return (
              <g key={i}>
                <path id={`edge-${a}-${b}`} d={d} fill="none" stroke="var(--bd-1)" strokeWidth="1" strokeDasharray="2 3" />
                {lbl && (
                  <text fontFamily="JetBrains Mono" fontSize="9" fill="var(--t-3)" textAnchor="middle">
                    <textPath href={`#edge-${a}-${b}`} startOffset="50%">{lbl}</textPath>
                  </text>
                )}
              </g>
            )
          })}
          {PACKETS.map((p, i) => {
            const segs: string[] = []
            for (let j = 0; j < p.path.length - 1; j++) {
              const A = map[p.path[j]], B = map[p.path[j + 1]]
              const x1 = A.x + A.w, y1 = A.y + A.h / 2
              const x2 = B.x,       y2 = B.y + B.h / 2
              const mx = (x1 + x2) / 2
              segs.push((j === 0 ? `M${x1} ${y1} ` : '') + `C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`)
            }
            return (
              <g key={i}>
                <path id={`pk-${i}`} d={segs.join(' ')} fill="none" stroke="none" />
                <circle r="4" fill={p.color}>
                  <animateMotion dur={`${p.duration}s`} repeatCount="indefinite" begin={`${-p.offset}s`} rotate="auto">
                    <mpath href={`#pk-${i}`} />
                  </animateMotion>
                  <animate attributeName="opacity" values="0;1;1;1;0" dur={`${p.duration}s`} repeatCount="indefinite" begin={`${-p.offset}s`} />
                </circle>
              </g>
            )
          })}
        </svg>

        {NODES.map(n => (
          <div key={n.id} className={`node ${['api', 'redis'].includes(n.id) ? 'active' : ''}`}
               style={{ left: n.x, top: n.y, width: n.w, minHeight: n.h }}>
            <div className="n-lbl">{n.label}</div>
            <div className="n-name">
              <span className="dot" style={{
                background: n.id === 'odoo' ? 'var(--warn)' : 'var(--ok)',
                boxShadow: `0 0 0 3px ${n.id === 'odoo' ? 'var(--warn-bg)' : 'var(--ok-bg)'}`,
              }} />
              {n.name}
            </div>
            <div className="n-meta">
              {n.meta.map(([k, v]) => <span key={k}>{k}=<b>{v}</b></span>)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="card-h"><div className="t">Workers</div><div className="right muted" style={{ fontSize: 11 }}>celery · default queue</div></div>
          <div style={{ padding: '4px 16px' }}>
            {WORKERS.map(w => (
              <div className="hr-row" key={w.name}>
                <div className="col">
                  <span className="label mono" style={{ fontSize: 12 }}>{w.name}</span>
                  <span className="meta">{w.queue} · {w.processed24h.toLocaleString()} jobs · {w.errors} err</span>
                </div>
                <div><div className="qbar"><span style={{ width: Math.min(100, w.depth / 20 * 100) + '%' }} /></div></div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <span className="mono tnum" style={{ fontSize: 11, color: 'var(--t-0)' }}>{w.depth}</span>
                  <span className="muted" style={{ fontSize: 11 }}>jobs</span>
                </div>
                <div style={{ textAlign: 'right' }}><span className="chip ok"><span className="d" />online</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><div className="t">Services</div><div className="right muted" style={{ fontSize: 11 }}>kubectl get pods</div></div>
          <div style={{ padding: '4px 16px' }}>
            {SERVICES.map(s => (
              <div className="hr-row" key={s.name}>
                <div className="col">
                  <span className="label" style={{ fontSize: 12 }}>{s.name}</span>
                  <span className="meta">uptime {s.uptime}</span>
                </div>
                <div><div className={`qbar ${s.status === 'warn' ? 'warn' : ''}`}><span style={{ width: s.status === 'warn' ? '78%' : '100%' }} /></div></div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <span className="mono tnum" style={{ fontSize: 11, color: 'var(--t-0)' }}>{s.p99}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {s.status === 'ok'
                    ? <span className="chip ok"><span className="d" />healthy</span>
                    : <span className="chip warn"><span className="d" />elevated</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <Ring value={qdepth} max={120} label={String(qdepth)} sub="queue depth" />
        <Ring value={32} max={100} label="32%" sub="cpu · workers" />
        <Ring value={41} max={100} label="41%" sub="mem · workers" />
        <Ring value={87} max={100} label="87%" sub="hit · odoo cache" />
      </div>
    </div>
  )
}
