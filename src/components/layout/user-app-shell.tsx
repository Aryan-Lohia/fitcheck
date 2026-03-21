"use client";

import { AppHeader } from "@/components/layout/app-header";
import { UserBottomNav } from "@/components/layout/user-bottom-nav";

export function UserAppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <UserBottomNav />
    </div>
  );
}
