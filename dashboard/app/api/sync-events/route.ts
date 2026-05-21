import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WebhookSource, WebhookStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as WebhookStatus | null;
  const source = searchParams.get("source") as WebhookSource | null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "20", 10)));

  const where = {
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        logs: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    }),
    prisma.webhookEvent.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, page_size: pageSize });
}
