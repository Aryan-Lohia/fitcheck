import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";

const bodySchema = z.object({
  phase: z.enum(["profile", "features"]),
});

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Invalid request.";
    return fail(msg, 422);
  }

  const now = new Date();
  const { phase } = parsed.data;

  if (phase === "profile") {
    await prisma.userProfile.update({
      where: { userId: session.userId },
      data: { onboardingProfileCompletedAt: now },
    });
  } else {
    await prisma.userProfile.update({
      where: { userId: session.userId },
      data: { onboardingFeaturesSeenAt: now },
    });
  }

  return ok({ ok: true });
}
