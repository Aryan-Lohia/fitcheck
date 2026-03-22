import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import {
  profileSchema,
  calculateProfileCompletionFromFields,
} from "@/lib/validators/profile";
import { ok, fail } from "@/lib/http";

function finiteMeasurements(
  m: Record<string, number | null | undefined> | null | undefined,
): Record<string, number> | undefined {
  if (!m || typeof m !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function GET() {
  const session = await requireAuth();
  if ("status" in session) return session;
  const [profile, user] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: session.userId } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, createdAt: true },
    }),
  ]);
  return ok({
    profile,
    user: user
      ? {
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      }
      : null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Please check your profile fields.";
    return fail(msg, 422);
  }

  const existing = await prisma.userProfile.findUnique({
    where: { userId: session.userId },
  });
  const prevFashion =
    existing?.fashionProfileJson &&
      typeof existing.fashionProfileJson === "object" &&
      !Array.isArray(existing.fashionProfileJson)
      ? { ...(existing.fashionProfileJson as Record<string, unknown>) }
      : {};
  const mergedFashion: Prisma.InputJsonValue | undefined =
    parsed.data.fashionProfile !== undefined
      ? ({ ...prevFashion, ...parsed.data.fashionProfile } as Prisma.InputJsonValue)
      : undefined;

  const measurementsRaw = parsed.data.measurements;
  const measurements = finiteMeasurements(measurementsRaw ?? undefined);
  const profileUpdateData = {
    gender: parsed.data.gender ?? undefined,
    skinTone: parsed.data.skinTone ?? undefined,
    preferredFit: parsed.data.preferredFit ?? undefined,
    preferredStyle: parsed.data.preferredStyle ?? undefined,
    preferredColors: parsed.data.preferredColors ?? undefined,
    ...(mergedFashion !== undefined
      ? { fashionProfileJson: mergedFashion }
      : {}),
    measurementsJson: measurements
      ? {
        versions: [
          {
            at: new Date().toISOString(),
            values: measurements,
          },
        ],
      }
      : undefined,
  };

  const completion = calculateProfileCompletionFromFields({
    gender: parsed.data.gender ?? null,
    skinTone: parsed.data.skinTone ?? null,
    preferredFit: parsed.data.preferredFit ?? null,
    preferredStyle: parsed.data.preferredStyle ?? null,
    preferredColors: parsed.data.preferredColors ?? null,
    measurements: measurements ?? null,
  });

  const profile = await prisma.userProfile.upsert({
    where: { userId: session.userId },
    update: { ...profileUpdateData, profileCompletion: completion },
    create: {
      userId: session.userId,
      ...profileUpdateData,
      profileCompletion: completion,
    },
  });
  return ok({ profile });
}

