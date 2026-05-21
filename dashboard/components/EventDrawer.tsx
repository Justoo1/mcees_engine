"use client";

import useSWR from "swr";
import { formatDate } from "@/lib/utils";
import { StatusChip } from "@/components/StatusChip";
import type { WebhookEvent, LogLevel } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<WebhookEvent>;

const LOG_COLORS: Record<LogLevel, string> = {
  INFO: "text-slate-600",
  WARN: "text-amber-600",
  ERROR: "text-red-600",
};

interface EventDrawerProps {
  eventId: string | null;
  onClose: () => void;
}

export function EventDrawer({ eventId, onClose }: EventDrawerProps) {
  const { data, mutate } = useSWR<WebhookEvent>(
    eventId ? `/api/sync-events/${eventId}` : null,
    fetcher,
    { refreshInterval: 3_000 }
  );

  async function handleRetry() {
    if (!eventId) return;
    await fetch(`/api/sync-events/${eventId}/retry`, { method: "POST" });
    await mutate();
  }

  const isRetryable = data?.status === "FAILED";
  const isPending = data?.status === "RECEIVED" || data?.status === "PROCESSING";

  if (!eventId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Event Detail</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!data ? (
          <div className="flex flex-1 items-center justify-center text-slate-400">Loading…</div>
        ) : (
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            <div className="flex items-center gap-3">
              <StatusChip status={data.status} />
              <span className="text-sm text-slate-500 uppercase tracking-wide">{data.source}</span>
              <span className="text-sm text-slate-500">{data.event_type}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-slate-500">External ID</span>
              <span className="font-mono text-slate-800">{data.external_id}</span>
              <span className="text-slate-500">Created</span>
              <span className="text-slate-800">{formatDate(data.created_at)}</span>
              <span className="text-slate-500">Updated</span>
              <span className="text-slate-800">{formatDate(data.updated_at)}</span>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Raw Payload
              </p>
              <pre className="max-h-48 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
                {JSON.stringify(data.raw_payload, null, 2)}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sync Log
              </p>
              <ol className="space-y-2">
                {(data.logs ?? []).map((log) => (
                  <li key={log.id} className="flex gap-3 text-xs">
                    <span className="w-32 shrink-0 text-slate-400">{formatDate(log.created_at)}</span>
                    <span className={LOG_COLORS[log.level]}>{log.message}</span>
                  </li>
                ))}
              </ol>
            </div>

            {(isRetryable || isPending) && (
              <button
                onClick={handleRetry}
                disabled={isPending}
                className="mt-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Retrying…" : "Retry Sync"}
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
