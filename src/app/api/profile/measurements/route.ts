import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const body = await req.json();
  const existing = await prisma.userProfile.findUnique({ where: { userId: session.userId } });
  const currentRaw = existing?.measurementsJson;
  const current = (currentRaw && typeof currentRaw === "object" && "versions" in currentRaw)
    ? (currentRaw as { versions: Array<{ source: string; values: Record<string, unknown>; updatedAt: string }> })
    : { versions: [] as Array<{ source: string; values: Record<string, unknown>; updatedAt: string }> };
  current.versions.push({ source: body.source || "user-entered", values: body.measurements || {}, updatedAt: new Date().toISOString() });
  const profile = await prisma.userProfile.upsert({
    where: { userId: session.userId },
    update: { measurementsJson: JSON.parse(JSON.stringify(current)) },
    create: { userId: session.userId, measurementsJson: JSON.parse(JSON.stringify(current)) },
  });
  return ok({ profile });
}

