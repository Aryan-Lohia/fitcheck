"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export function RoleGuard({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !roles.includes(user.role)) {
      router.replace("/chat");
    }
  }, [isLoading, user, roles, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (!user || !roles.includes(user.role)) return null;
  return <>{children}</>;
}
