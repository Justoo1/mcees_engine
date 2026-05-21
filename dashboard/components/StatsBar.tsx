"use client";

import useSWR from "swr";
import type { SyncStats } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<SyncStats>;

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function StatsBar() {
  const { data } = useSWR<SyncStats>("/api/sync-events/stats", fetcher, {
    refreshInterval: 10_000,
  });

  const avgMs =
    data?.avg_processing_ms != null ? `${Math.round(data.avg_processing_ms)}ms` : "—";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Events (24h)" value={data?.total_24h ?? "—"} />
      <StatCard label="Synced" value={data?.synced ?? "—"} />
      <StatCard label="Failed" value={data?.failed ?? "—"} />
      <StatCard label="Avg Processing" value={avgMs} />
    </div>
  );
}
