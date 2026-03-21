import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = { userId: string; role: string };

const SESSION_OPTIONS = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: "fitcheck_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

export async function createSession(userId: string, role: string): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
  session.userId = userId;
  session.role = role;
  await session.save();
}

export async function getSession(): Promise<SessionData | null> {
  const session = await getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
  if (!session.userId) return null;
  return { userId: session.userId, role: session.role };
}

export async function destroySession(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
  session.destroy();
}
