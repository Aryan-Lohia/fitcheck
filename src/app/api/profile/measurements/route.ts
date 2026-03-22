import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { profileCompletionFromUserProfile } from "@/lib/validators/profile";
import { ok } from "@/lib/http";

/** Lightweight read for dashboard / clients that only need completion %. */
export async function GET() {
  const session = await requireAuth();
  if ("status" in session) return session;
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.userId },
    select: { profileCompletion: true },
  });
  return ok({ profile });
}

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
  const mergedJson = JSON.parse(JSON.stringify(current)) as Prisma.InputJsonValue;
  const profileCompletion = profileCompletionFromUserProfile({
    gender: existing?.gender ?? null,
    skinTone: existing?.skinTone ?? null,
    preferredFit: existing?.preferredFit ?? null,
    preferredStyle: existing?.preferredStyle ?? null,
    preferredColors: existing?.preferredColors ?? null,
    measurementsJson: mergedJson,
  });
  const profile = await prisma.userProfile.upsert({
    where: { userId: session.userId },
    update: {
      measurementsJson: mergedJson,
      profileCompletion,
    },
    create: {
      userId: session.userId,
      measurementsJson: mergedJson,
      profileCompletion,
    },
  });
  return ok({ profile });
}

