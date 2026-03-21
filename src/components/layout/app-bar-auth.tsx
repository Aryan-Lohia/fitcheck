"use client";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppBarAuthActions({ className }: { className?: string }) {
  const { user, isLoading, logout, isLoggingOut } = useAuth();

  return (
    <div
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2 sm:gap-3",
        className,
      )}
    >
      {isLoading ? (
        <span className="h-4 w-32 animate-pulse rounded bg-black/[0.08] sm:w-40" />
      ) : user?.email ? (
        <span
          className="hidden max-w-[min(100%,14rem)] truncate text-xs text-text-muted sm:inline md:max-w-[16rem] md:text-sm"
          title={user.email}
        >
          {user.email}
        </span>
      ) : null}
      {user ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-9 shrink-0 px-3 text-xs sm:min-h-10 sm:px-4 sm:text-sm"
          disabled={isLoggingOut}
          onClick={() => logout()}
        >
          {isLoggingOut ? "Signing out…" : "Log out"}
        </Button>
      ) : null}
    </div>
  );
}
