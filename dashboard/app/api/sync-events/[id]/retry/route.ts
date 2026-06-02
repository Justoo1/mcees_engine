import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/permissions";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole("OPERATOR");
  if (error) return error;

  const { id } = await params;
  const event = await prisma.webhookEvent.findUnique({ where: { id } });

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (event.status !== "FAILED") {
    return NextResponse.json({ error: "Only FAILED events can be retried" }, { status: 400 });
  }

  await prisma.webhookEvent.update({
    where: { id },
    data: { status: "RECEIVED", updated_at: new Date() },
  });

  await prisma.syncLog.create({
    data: {
      webhook_event_id: id,
      message: "Manual retry triggered from dashboard",
      level: "INFO",
    },
  });

  // Re-enqueue via the API service (fire-and-forget HTTP call)
  const apiUrl = process.env.API_URL ?? "http://api:8000";
  void fetch(`${apiUrl}/api/v1/internal/retry/${id}`, { method: "POST" }).catch(() => null);

  return NextResponse.json({ queued: true });
}
