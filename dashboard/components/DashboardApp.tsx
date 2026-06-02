'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Ic } from '@/components/icons'
import { formatBig } from '@/components/ui'
import { StatsBar } from '@/components/StatsBar'
import { SyncTimeline } from '@/components/SyncTimeline'
import { EventDrawer } from '@/components/EventDrawer'
import { ArchitectureView } from '@/components/ArchitectureView'
import { SettingsView } from '@/components/SettingsView'
import { QueuesView } from '@/components/QueuesView'
import { FailuresView } from '@/components/FailuresView'
import { SystemHealthView } from '@/components/SystemHealthView'
import { ShortcutsModal } from '@/components/ShortcutsModal'
import { UserMenu, type CurrentUser } from '@/components/UserMenu'
import { can } from '@/lib/auth/permissions'
import { useTweaks, TweaksPanel, TweakSection, TweakSlider, TweakRadio, TweakColor } from '@/components/TweaksPanel'
import { makeFeedItem, type MockEvent, type FeedItem, type SparklineData } from '@/lib/mockData'
import { fetchEvents, fetchStats, retryEvent, fetchQueues, fetchHealth, type ApiStats, type QueuesResponse, type HealthResponse } from '@/lib/api'
import { apiEventToMock, buildSparklineFromEvents } from '@/lib/mappers'

type Route = 'timeline' | 'architecture' | 'settings' | 'queues' | 'failures' | 'health'

const TWEAK_DEFAULTS = {
  theme:       'dark',
  density:     'comfortable',
  accent:      'emerald',
  liveSpeed:   3,
  failureRate: 12,
}

const ACCENTS: Record<string, { l: number; c: number; h: number; fg: string }> = {
  emerald: { l: 0.74, c: 0.15, h: 158, fg: 'oklch(0.16 0.04 158)' },
  blue:    { l: 0.72, c: 0.15, h: 245, fg: 'oklch(0.16 0.04 245)' },
  amber:   { l: 0.80, c: 0.14, h: 78,  fg: 'oklch(0.18 0.04 78)' },
  violet:  { l: 0.72, c: 0.18, h: 295, fg: 'oklch(0.16 0.04 295)' },
  white:   { l: 0.95, c: 0.0,  h: 0,   fg: 'oklch(0.16 0 0)' },
}

function applyTheme(theme: string, density: string, accent: string) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.setAttribute('data-density', density)
  const a = ACCENTS[accent] ?? ACCENTS.emerald
  document.documentElement.style.setProperty('--acc', `oklch(${a.l} ${a.c} ${a.h})`)
  document.documentElement.style.setProperty('--acc-fg', a.fg)
  document.documentElement.style.setProperty('--acc-soft', `oklch(${a.l} ${a.c} ${a.h} / 0.15)`)
}

// liveSpeed 1→15s, 2→12s, 3→9s, 4→6s, 5→3s — minimum 3s to avoid hammering the API
function pollInterval(liveSpeed: number) {
  return Math.max(3000, 18000 - liveSpeed * 3000)
}

export function DashboardApp({ currentUser }: { currentUser: CurrentUser }) {
  const canWrite     = can.retry(currentUser.role)
  const canConfigure = can.configure(currentUser.role)
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS)

  useEffect(() => { applyTheme(t.theme as string, t.density as string, t.accent as string) }, [t.theme, t.density, t.accent])

  const [route, setRoute]       = useState<Route>('timeline')
  const [events, setEvents]     = useState<MockEvent[]>([])
  const [feed, setFeed]         = useState<FeedItem[]>([])
  const [apiStats, setApiStats] = useState<ApiStats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<MockEvent | null>(null)
  const [paused, setPaused]     = useState(false)
  const [filters, setFilters]   = useState({ q: '', source: 'all', status: 'all' })
  const [page, setPage]         = useState(1)
  const [shortcuts, setShortcuts] = useState(false)
  const [toast, setToast]       = useState<{ msg: string; tone: string } | null>(null)
  const [queuesData, setQueuesData] = useState<QueuesResponse | null>(null)
  const [healthData, setHealthData] = useState<HealthResponse | null>(null)
  const [failedEvents, setFailedEvents] = useState<MockEvent[]>([])

  const eventsPerMinRef = useRef(0)
  const prevIdsRef      = useRef(new Set<string>())

  // Compute sparklines from the live events array — no separate state needed
  const sparklines = useMemo<SparklineData>(
    () => buildSparklineFromEvents(events),
    [events],
  )

  // ---------- initial load ----------
  useEffect(() => {
    Promise.all([fetchEvents({ page_size: 100 }), fetchStats()])
      .then(([evRes, stats]) => {
        const mapped = evRes.data.map(apiEventToMock)
        setEvents(mapped)
        setFeed(mapped.slice(0, 12).map(makeFeedItem))
        setApiStats(stats)
        prevIdsRef.current = new Set(mapped.map(e => e.id))
        eventsPerMinRef.current = stats.total_24h > 0
          ? Math.round(stats.total_24h / (24 * 60))
          : 0
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ---------- polling ----------
  useEffect(() => {
    if (paused || loading) return
    const ms = pollInterval(t.liveSpeed as number)

    const id = setInterval(async () => {
      try {
        const [evRes, stats] = await Promise.all([
          fetchEvents({ page_size: 100 }),
          fetchStats(),
        ])

        const mapped    = evRes.data.map(apiEventToMock)
        const newEvents = mapped.filter(e => !prevIdsRef.current.has(e.id))
        newEvents.forEach(e => { e._isNew = true })

        if (newEvents.length > 0) {
          setFeed(prev => [...newEvents.map(makeFeedItem), ...prev].slice(0, 20))
        }

        setEvents(mapped)
        setApiStats(stats)
        prevIdsRef.current      = new Set(mapped.map(e => e.id))
        eventsPerMinRef.current = stats.total_24h > 0
          ? Math.round(stats.total_24h / (24 * 60))
          : eventsPerMinRef.current
      } catch {
        // silently keep stale data on transient errors
      }
    }, ms)

    return () => clearInterval(id)
  }, [paused, loading, t.liveSpeed])

  // ---------- per-route data: queues / health / failures ----------
  useEffect(() => {
    if (loading) return
    let cancelled = false
    const ms = pollInterval(t.liveSpeed as number)

    const loadFor = async () => {
      try {
        if (route === 'queues') {
          const q = await fetchQueues()
          if (!cancelled) setQueuesData(q)
        } else if (route === 'health') {
          const h = await fetchHealth()
          if (!cancelled) setHealthData(h)
        } else if (route === 'failures') {
          const res = await fetchEvents({ status: 'FAILED', page_size: 100 })
          if (!cancelled) setFailedEvents(res.data.map(apiEventToMock))
        }
      } catch {
        // keep prior data on transient errors
      }
    }

    loadFor()
    if (paused) return () => { cancelled = true }
    const id = setInterval(loadFor, ms)
    return () => { cancelled = true; clearInterval(id) }
  }, [route, loading, paused, t.liveSpeed])

  // Clear _isNew flash after animation
  useEffect(() => {
    if (events.every(e => !e._isNew)) return
    const id = setTimeout(() => {
      setEvents(prev => prev.map(e => e._isNew ? { ...e, _isNew: false } : e))
    }, 700)
    return () => clearTimeout(id)
  }, [events])

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    let gPending = false
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === '?')                         { setShortcuts(true); e.preventDefault(); return }
      if (e.key === '/')                         { (document.querySelector('.search input') as HTMLInputElement)?.focus(); e.preventDefault(); return }
      if (e.key === 'l' || e.key === 'L')        { setTweak('theme', t.theme === 'dark' ? 'light' : 'dark'); return }
      if (e.key === ' ' && route === 'timeline') { setPaused(p => !p); e.preventDefault(); return }
      if (e.key === 'Escape')                    { setShortcuts(false); return }
      if (e.key === 'g' || e.key === 'G')        { gPending = true; setTimeout(() => { gPending = false }, 1200); return }
      if (gPending) {
        if      (e.key === 't' || e.key === 'T') setRoute('timeline')
        else if (e.key === 'a' || e.key === 'A') setRoute('architecture')
        else if (e.key === 's' || e.key === 'S') setRoute('settings')
        else if (e.key === 'q' || e.key === 'Q') setRoute('queues')
        else if (e.key === 'f' || e.key === 'F') setRoute('failures')
        else if (e.key === 'h' || e.key === 'H') setRoute('health')
        gPending = false
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [t.theme, route, setTweak])

  // ---------- retry ----------
  const onReplayAll = useCallback(async () => {
    const failed = events.filter(e => e.status === 'FAILED')
    if (failed.length === 0) return
    setEvents(prev => prev.map(e => e.status === 'FAILED' ? { ...e, status: 'PROCESSING' as const } : e))
    setToast({ msg: `Queuing ${failed.length} failed event${failed.length > 1 ? 's' : ''} for retry…`, tone: 'info' })
    const results = await Promise.allSettled(failed.map(e => retryEvent(e.id)))
    const queued  = results.filter(r => r.status === 'fulfilled').length
    const errored = results.length - queued
    if (errored > 0) {
      setToast({ msg: `Queued ${queued}, ${errored} failed to queue — check API`, tone: 'err' })
    } else {
      setToast({ msg: `Queued ${queued} event${queued > 1 ? 's' : ''} for retry`, tone: 'ok' })
    }
    setTimeout(() => setToast(null), 3000)
  }, [events])

  const onRetry = useCallback(async (ev: MockEvent) => {
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: 'PROCESSING' as const } : e))
    setToast({ msg: `Retrying ${ev.kind} · ext_id=${ev._externalId}`, tone: 'info' })
    try {
      await retryEvent(ev.id)
      setToast({ msg: `Queued ${ev.kind} for retry`, tone: 'ok' })
    } catch {
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: 'FAILED' as const } : e))
      setToast({ msg: 'Retry request failed — check API connection', tone: 'err' })
    }
    setTimeout(() => setToast(null), 2400)
  }, [])

  const counts = useMemo(() => ({
    total:  apiStats?.total_24h ?? events.length,
    failed: apiStats?.failed    ?? events.filter(e => e.status === 'FAILED').length,
    proc:   events.filter(e => e.status === 'PROCESSING' || e.status === 'RETRYING').length,
  }), [events, apiStats])

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="side">
        <div className="brand">
          <div className="mark">M</div>
          <div className="name">
            <span>mcees</span>
            <small>engine · v0.4.2</small>
          </div>
        </div>

        <div className="navsection">Operations</div>
        <div className={`navitem ${route === 'timeline' ? 'active' : ''}`} onClick={() => setRoute('timeline')}>
          <Ic.activity className="ic" /> Timeline
          <span className="count tnum">{formatBig(counts.total)}</span>
        </div>
        <div className={`navitem ${route === 'architecture' ? 'active' : ''}`} onClick={() => setRoute('architecture')}>
          <Ic.diagram className="ic" /> Architecture
          <span className="count tnum">live</span>
        </div>
        <div className={`navitem ${route === 'queues' ? 'active' : ''}`} onClick={() => setRoute('queues')}>
          <Ic.queue className="ic" /> Queues
          <span className="count tnum" style={counts.proc > 0 ? { color: 'var(--warn)', background: 'var(--warn-bg)' } : {}}>
            {counts.proc}
          </span>
        </div>
        <div className={`navitem ${route === 'failures' ? 'active' : ''}`} onClick={() => setRoute('failures')}>
          <Ic.alert className="ic" /> Failures
          <span className="count tnum" style={counts.failed > 0 ? { color: 'var(--err)', background: 'var(--err-bg)' } : {}}>
            {counts.failed}
          </span>
        </div>

        <div className="navsection">Configuration</div>
        {canConfigure && (
          <div className={`navitem ${route === 'settings' ? 'active' : ''}`} onClick={() => setRoute('settings')}>
            <Ic.cog className="ic" /> Connectors
          </div>
        )}
        <div className={`navitem ${route === 'health' ? 'active' : ''}`} onClick={() => setRoute('health')}>
          <Ic.health className="ic" /> System health
        </div>

        <div className="side-foot">
          <span className="ok">●</span>
          <div className="col" style={{ gap: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--t-0)' }}>
              {loading ? 'Connecting…' : 'All systems operational'}
            </span>
            <span className="ver" style={{ fontSize: 10, color: 'var(--t-3)' }}>commit a8c7f2e · 2026-05-21</span>
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header className="topbar">
        <div className="crumb">
          {route === 'timeline'     && <>Operations<span style={{ margin: '0 6px', color: 'var(--t-3)' }}>/</span><b>Sync timeline</b></>}
          {route === 'architecture' && <>Operations<span style={{ margin: '0 6px', color: 'var(--t-3)' }}>/</span><b>Architecture</b></>}
          {route === 'queues'       && <>Operations<span style={{ margin: '0 6px', color: 'var(--t-3)' }}>/</span><b>Queues</b></>}
          {route === 'failures'     && <>Operations<span style={{ margin: '0 6px', color: 'var(--t-3)' }}>/</span><b>Failures</b></>}
          {route === 'settings'     && <>Configuration<span style={{ margin: '0 6px', color: 'var(--t-3)' }}>/</span><b>Connectors</b></>}
          {route === 'health'       && <>Configuration<span style={{ margin: '0 6px', color: 'var(--t-3)' }}>/</span><b>System health</b></>}
        </div>
        <span className="dot-sep" />
        <span className="pill">
          <span className={`dot ${paused ? '' : 'pulse'}`} />
          <span>
            {paused ? 'Paused' : 'Live'}
            {!paused && <> · <span className="mono tnum" style={{ color: 'var(--t-0)' }}>{eventsPerMinRef.current}</span> req/min</>}
          </span>
        </span>
        <span className="pill">
          <span className="mono" style={{ color: 'var(--t-2)' }}>env=</span>
          <span className="mono" style={{ color: 'var(--t-0)' }}>production</span>
        </span>
        <div className="spacer" />
        <button className="iconbtn" title="Toggle theme (L)" onClick={() => setTweak('theme', t.theme === 'dark' ? 'light' : 'dark')}>
          {t.theme === 'dark' ? <Ic.sun /> : <Ic.moon />}
        </button>
        <button className="iconbtn" title="Keyboard shortcuts (?)" onClick={() => setShortcuts(true)}>
          <Ic.kbd />
        </button>
        <button
          className="btn primary"
          onClick={onReplayAll}
          disabled={counts.failed === 0 || !canWrite}
          title={canWrite ? undefined : 'Requires OPERATOR or ADMIN role'}
        >
          <Ic.retry /> Replay {counts.failed} failed
        </button>
        <UserMenu user={currentUser} />
      </header>

      {/* Main content */}
      <main className="main">
        {route === 'timeline' && (
          <>
            <div className="page" style={{ paddingBottom: 0 }}>
              <StatsBar events={events} sparklines={sparklines} apiStats={apiStats} />
            </div>
            <SyncTimeline
              events={events}
              selected={selected}
              setSelected={setSelected}
              paused={paused}
              setPaused={setPaused}
              filters={filters}
              setFilters={setFilters}
              sparklines={sparklines}
              feed={feed}
              page={page}
              setPage={setPage}
            />
          </>
        )}
        {route === 'architecture' && (
          <ArchitectureView eventsPerMin={eventsPerMinRef.current} qdepth={14 + 18 + 6 + 2} />
        )}
        {route === 'queues' && (
          <QueuesView
            queues={queuesData?.queues ?? []}
            workers={queuesData?.workers ?? []}
            loading={!queuesData}
            error={queuesData?.error}
          />
        )}
        {route === 'failures' && (
          <FailuresView
            events={failedEvents}
            loading={failedEvents.length === 0 && loading}
            onOpen={setSelected}
            onRetry={onRetry}
            onBulkRetried={(queued, errored) => {
              if (errored > 0) {
                setToast({ msg: `Queued ${queued}, ${errored} failed to queue — check API`, tone: 'err' })
              } else {
                setToast({ msg: `Queued ${queued} event${queued === 1 ? '' : 's'} for retry`, tone: 'ok' })
              }
              setTimeout(() => setToast(null), 3000)
            }}
          />
        )}
        {route === 'health' && (
          <SystemHealthView health={healthData} loading={!healthData} />
        )}
        {route === 'settings' && canConfigure && <SettingsView />}
      </main>

      {selected && <EventDrawer event={selected} onClose={() => setSelected(null)} onRetry={onRetry} canRetry={canWrite} />}
      {shortcuts && <ShortcutsModal onClose={() => setShortcuts(false)} />}

      {toast && (
        <div className="toast">
          {toast.tone === 'ok'
            ? <Ic.check   style={{ color: 'var(--ok)'   }} />
            : toast.tone === 'err'
              ? <Ic.alert style={{ color: 'var(--err)'  }} />
              : <Ic.activity style={{ color: 'var(--info)' }} />}
          {toast.msg}
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme"   value={t.theme as string}   options={['dark', 'light']}                       onChange={v => setTweak('theme', v)} />
        <TweakRadio label="Density" value={t.density as string} options={['compact', 'comfortable', 'spacious']}  onChange={v => setTweak('density', v)} />
        <TweakColor
          label="Accent"
          value={`oklch(${ACCENTS[t.accent as string]?.l ?? 0.74} ${ACCENTS[t.accent as string]?.c ?? 0.15} ${ACCENTS[t.accent as string]?.h ?? 158})`}
          options={Object.keys(ACCENTS).map(k => `oklch(${ACCENTS[k].l} ${ACCENTS[k].c} ${ACCENTS[k].h})`)}
          onChange={v => {
            const m = v.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/)
            if (!m) return
            const key = Object.keys(ACCENTS).find(k => Math.abs(ACCENTS[k].l - +m[1]) < 0.02 && Math.abs(ACCENTS[k].h - +m[3]) < 5)
            if (key) setTweak('accent', key)
          }}
        />
        <TweakSection label="Poll rate" />
        <TweakSlider label="Refresh speed" value={t.liveSpeed as number} min={1} max={5} step={1} onChange={v => setTweak('liveSpeed', v)} />
      </TweaksPanel>
    </div>
  )
}
