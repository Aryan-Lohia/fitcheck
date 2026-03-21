import { NextRequest } from "next/server";
import { signupSchema } from "@/lib/validators/auth";
import { prisma } from "@/lib/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { activateTrial } from "@/lib/billing/trial";
import { ok, fail } from "@/lib/http";
import { sendEmail } from "@/lib/email/sender";
import { signupConfirmation } from "@/lib/email/templates/signupConfirmation";

export async function POST(req: NextRequest) {
  const parsed = signupSchema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message, 422);
  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return fail("Email already exists", 409);
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      profile: { create: {} },
      freelancer: parsed.data.role === "FREELANCE_USER" ? { create: {} } : undefined,
    },
  });
  await activateTrial(user.id);
  await createSession(user.id, user.role);

  const tmpl = signupConfirmation({ name: user.name, email: user.email });
  sendEmail(user.email, tmpl.subject, tmpl.html, tmpl.text).catch(console.error);

  return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 201);
}

