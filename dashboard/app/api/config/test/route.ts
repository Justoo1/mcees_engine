import { NextResponse } from 'next/server'

// Pings the FastAPI backend health endpoint and optionally makes a smoke-test
// call to each configured webhook endpoint so the UI can confirm reachability.
export async function GET() {
  const apiUrl = process.env.API_URL ?? 'http://api:8000'

  try {
    const start = Date.now()
    const res   = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) })
    const ms    = Date.now() - start
    const data  = await res.json().catch(() => ({}))

    return NextResponse.json({
      ok:      res.ok,
      status:  res.status,
      latency: ms,
      backend: data,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, status: 0, latency: null, error: msg }, { status: 502 })
  }
}
