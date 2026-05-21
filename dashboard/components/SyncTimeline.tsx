"use client";

import { useState } from "react";
import useSWR from "swr";
import { formatDate } from "@/lib/utils";
import { StatusChip } from "@/components/StatusChip";
import { EventDrawer } from "@/components/EventDrawer";
import type { PaginatedEvents, WebhookSource, WebhookStatus } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<PaginatedEvents>;

const SOURCES: WebhookSource[] = ["SHOPIFY", "WOOCOMMERCE"];
const STATUSES: WebhookStatus[] = ["RECEIVED", "PROCESSING", "SYNCED", "FAILED"];

export function SyncTimeline() {
  const [source, setSource] = useState<WebhookSource | "">("");
  const [status, setStatus] = useState<WebhookStatus | "">("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page) });
  if (source) params.set("source", source);
  if (status) params.set("status", status);

  const { data } = useSWR<PaginatedEvents>(
    `/api/sync-events?${params.toString()}`,
    fetcher,
    { refreshInterval: 5_000 }
  );

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-800 mr-auto">Sync Timeline</h2>

          <select
            value={source}
            onChange={(e) => { setSource(e.target.value as WebhookSource | ""); setPage(1); }}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
          >
            <option value="">All Sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as WebhookStatus | ""); setPage(1); }}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3 text-left">Source</th>
                <th className="px-6 py-3 text-left">Event</th>
                <th className="px-6 py-3 text-left">External ID</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!data ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : data.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No events found.
                  </td>
                </tr>
              ) : (
                data.data.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => setSelectedId(event.id)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {event.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{event.event_type}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{event.external_id}</td>
                    <td className="px-6 py-4">
                      <StatusChip status={event.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(event.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
            <span>
              Page {data.page} of {totalPages} ({data.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>

      <EventDrawer eventId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
