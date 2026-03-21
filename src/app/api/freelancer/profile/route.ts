import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
  });

  return ok({ profile });
}

export async function POST(req: NextRequest) {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const body = await req.json();

  const profile = await prisma.freelancerProfile.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      bio: body.bio || "",
      portfolioLinksJson: body.portfolioLinks || [],
      pastWorkLinksJson: body.pastWorkLinks || [],
      expertiseTagsJson: body.specializations || [],
      verificationStatus: "submitted",
    },
    update: {
      bio: body.bio,
      portfolioLinksJson: body.portfolioLinks,
      pastWorkLinksJson: body.pastWorkLinks,
      expertiseTagsJson: body.specializations,
      verificationStatus: body.resubmit ? "submitted" : undefined,
    },
  });

  return ok({ profile });
}
