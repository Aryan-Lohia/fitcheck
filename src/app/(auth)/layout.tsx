import { redirect } from "next/navigation";
import { postLoginPathForRole } from "@/lib/auth/post-login-path";
import { getSession } from "@/lib/auth/session";

export default async function AuthRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) {
    redirect(postLoginPathForRole(session.role));
  }
  return <>{children}</>;
}
