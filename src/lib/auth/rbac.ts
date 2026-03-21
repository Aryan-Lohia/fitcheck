import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function requireAuth() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roles.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return session;
}
