import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";
import { sendEmail } from "@/lib/email/sender";
import { freelancerApproved } from "@/lib/email/templates/freelancerApproved";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await requireRole(["ADMIN"]);
  if ("status" in s) return s;

  const { id } = await params;

  const profile = await prisma.freelancerProfile.update({
    where: { id },
    data: { verificationStatus: "approved", approvedAt: new Date() },
    include: { user: { select: { name: true, email: true } } },
  });

  const tmpl = freelancerApproved({ name: profile.user.name });
  sendEmail(profile.user.email, tmpl.subject, tmpl.html, tmpl.text).catch(console.error);

  return ok({ profile });
}
