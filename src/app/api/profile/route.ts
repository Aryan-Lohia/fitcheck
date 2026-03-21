import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { profileSchema, calculateProfileCompletion } from "@/lib/validators/profile";
import { ok, fail } from "@/lib/http";

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
  if (!parsed.success) return fail(parsed.error.message, 422);

  const measurements = parsed.data.measurements;
  const profileUpdateData = {
    gender: parsed.data.gender,
    skinTone: parsed.data.skinTone,
    preferredFit: parsed.data.preferredFit,
    preferredStyle: parsed.data.preferredStyle,
    preferredColors: parsed.data.preferredColors,
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

  const completion = calculateProfileCompletion({
    ...parsed.data,
    measurements: measurements ?? undefined,
  } as Record<string, unknown>);

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

