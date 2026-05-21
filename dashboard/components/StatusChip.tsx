import { cn } from "@/lib/utils";
import type { WebhookStatus } from "@/lib/types";

const STATUS_STYLES: Record<WebhookStatus, string> = {
  SYNCED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
  PROCESSING: "bg-amber-100 text-amber-700 border-amber-200",
  RECEIVED: "bg-slate-100 text-slate-600 border-slate-200",
};

interface StatusChipProps {
  status: WebhookStatus;
}

export function StatusChip({ status }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}
