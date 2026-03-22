import { NextRequest } from "next/server";
import { loginSchema } from "@/lib/validators/auth";
import { prisma } from "@/lib/prisma/client";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit/simple";
import { ok, fail } from "@/lib/http";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!checkRateLimit(`login:${ip}`, 10, 60_000)) return fail("Too many requests", 429);
  const parsed = loginSchema.safeParse(await req.json());
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Please check your email and password.";
    return fail(msg, 422);
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return fail("Invalid credentials", 401);
  const okPwd = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!okPwd) return fail("Invalid credentials", 401);
  await createSession(user.id, user.role);
  return ok({ user: { id: user.id, name: user.name, role: user.role } });
}

