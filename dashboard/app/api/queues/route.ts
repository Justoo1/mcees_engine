import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiUrl = process.env.API_URL ?? "http://api:8000";
  try {
    const ctl = AbortSignal.timeout(5000);
    const res = await fetch(`${apiUrl}/api/v1/internal/queues`, { signal: ctl, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { queues: [], workers: [], timestamp: new Date().toISOString(), error: `backend ${res.status}` },
      );
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({
      queues: [],
      workers: [],
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : "backend unreachable",
    });
  }
}
