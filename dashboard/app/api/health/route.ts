import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UNREACHABLE = (detail: string) => ({
  status: "unhealthy" as const,
  checks: {
    postgres: { ok: false, latency_ms: null, detail },
    redis:    { ok: false, latency_ms: null, detail },
    celery:   { ok: false, latency_ms: null, detail },
    odoo:     { ok: false, latency_ms: null, detail },
  },
  timestamp: new Date().toISOString(),
  error: detail,
});

export async function GET() {
  const apiUrl = process.env.API_URL ?? "http://api:8000";
  try {
    const ctl = AbortSignal.timeout(6000);
    const res = await fetch(`${apiUrl}/api/v1/internal/health`, { signal: ctl, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(UNREACHABLE(`backend ${res.status}`));
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json(UNREACHABLE(err instanceof Error ? err.message : "backend unreachable"));
  }
}
