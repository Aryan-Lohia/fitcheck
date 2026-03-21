import { destroySession } from "@/lib/auth/session";
import { ok } from "@/lib/http";

export async function POST() {
  await destroySession();
  return ok({ success: true });
}

