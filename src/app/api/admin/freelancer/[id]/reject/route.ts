import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";
import { sendEmail } from "@/lib/email/sender";
import { freelancerRejected } from "@/lib/email/templates/freelancerRejected";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await requireRole(["ADMIN"]);
  if ("status" in s) return s;

  const body = await req.json();
  const { id } = await params;

  const profile = await prisma.freelancerProfile.update({
    where: { id },
    data: { verificationStatus: "rejected", verificationNotes: body.notes || "" },
    include: { user: { select: { name: true, email: true } } },
  });

  const tmpl = freelancerRejected({ name: profile.user.name, notes: body.notes || "" });
  sendEmail(profile.user.email, tmpl.subject, tmpl.html, tmpl.text).catch(console.error);

  return ok({ profile });
}
