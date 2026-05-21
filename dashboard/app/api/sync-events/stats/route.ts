import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total_24h, synced, failed] = await Promise.all([
    prisma.webhookEvent.count({ where: { created_at: { gte: since } } }),
    prisma.webhookEvent.count({ where: { created_at: { gte: since }, status: "SYNCED" } }),
    prisma.webhookEvent.count({ where: { created_at: { gte: since }, status: "FAILED" } }),
  ]);

  // Average time from RECEIVED → SYNCED using created_at vs updated_at as a proxy
  const syncedEvents = await prisma.webhookEvent.findMany({
    where: { created_at: { gte: since }, status: "SYNCED" },
    select: { created_at: true, updated_at: true },
  });

  const avg_processing_ms =
    syncedEvents.length > 0
      ? syncedEvents.reduce(
          (sum, e) => sum + (e.updated_at.getTime() - e.created_at.getTime()),
          0
        ) / syncedEvents.length
      : null;

  return NextResponse.json({ total_24h, synced, failed, avg_processing_ms });
}
