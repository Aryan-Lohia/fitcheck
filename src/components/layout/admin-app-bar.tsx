"use client";

import { AppBarAuthActions } from "@/components/layout/app-bar-auth";

export function AdminAppBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-end border-b border-border-subtle bg-surface/95 pl-14 pr-4 backdrop-blur-md md:pl-6 md:pr-6">
      <AppBarAuthActions />
    </header>
  );
}
