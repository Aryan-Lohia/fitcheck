import { requireAuth } from "@/lib/auth/rbac";
import { ok } from "@/lib/http";

export async function POST() {
  const session = await requireAuth();
  if ("status" in session) return session;
  return ok({ success: true });
}

