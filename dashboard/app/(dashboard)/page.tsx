import { StatsBar } from "@/components/StatsBar";
import { SyncTimeline } from "@/components/SyncTimeline";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Sync Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time view of all webhook events and their ERP synchronization status.
        </p>
      </header>
      <StatsBar />
      <SyncTimeline />
    </main>
  );
}
