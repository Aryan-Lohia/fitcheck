"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogoLink } from "@/components/brand/brand-logo";
import { AppBarAuthActions } from "@/components/layout/app-bar-auth";
import { USER_NAV_LINKS } from "@/components/layout/user-nav-config";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:gap-4 md:px-6">
        <BrandLogoLink href="/chat" priority variant="lockup" />
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main navigation"
          >
            {USER_NAV_LINKS.map((link) => {
              const active = path?.startsWith(link.href) ?? false;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "text-text-muted hover:bg-brand-warm/15 hover:text-text-primary",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <AppBarAuthActions />
        </div>
      </div>
    </header>
  );
}
