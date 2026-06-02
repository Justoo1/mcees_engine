import { Ic } from '@/components/icons'

const GROUPS = [
  { name: 'Navigation', items: [
    ['G then T', 'Go to Timeline'],
    ['G then A', 'Go to Architecture'],
    ['G then Q', 'Go to Queues'],
    ['G then F', 'Go to Failures'],
    ['G then S', 'Go to Settings'],
    ['G then H', 'Go to System health'],
    ['?',        'Toggle this overlay'],
  ]},
  { name: 'Events', items: [
    ['↑ / ↓',  'Move selection'],
    ['Enter',  'Open event drawer'],
    ['Esc',    'Close drawer'],
    ['R',      'Retry selected event'],
    ['/',      'Focus search'],
  ]},
  { name: 'Filters', items: [
    ['S',      'Cycle source filter'],
    ['F',      'Cycle status filter'],
    ['Space',  'Pause / resume live stream'],
    ['L',      'Toggle dark / light'],
  ]},
]

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd-0)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ic.kbd />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Keyboard shortcuts</div>
          <div className="grow" />
          <button className="iconbtn" onClick={onClose}><Ic.close /></button>
        </div>
        <div style={{ padding: 16, overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {GROUPS.map(g => (
            <div key={g.name}>
              <div className="lbl" style={{ marginBottom: 8 }}>{g.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.items.map(([k, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                    <span style={{ color: 'var(--t-1)' }}>{label}</span>
                    <span className="kbd" style={{ fontSize: 11 }}>{k}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bd-0)', display: 'flex', alignItems: 'center', fontSize: 11.5, color: 'var(--t-2)' }}>
          Press <span className="kbd" style={{ margin: '0 5px' }}>?</span> anytime to toggle this overlay.
        </div>
      </div>
    </div>
  )
}
