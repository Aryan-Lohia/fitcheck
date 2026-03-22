"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogoLink } from "@/components/brand/brand-logo";
import { AppBarAuthActions } from "@/components/layout/app-bar-auth";
import { FREELANCER_NAV_LINKS } from "@/components/layout/freelancer-nav-config";
import { cn } from "@/lib/utils";

export function FreelancerHeader() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogoLink
              href="/freelancer/dashboard"
              variant="wordmark"
              wordmarkClassName="max-w-[min(100%,10rem)] sm:max-w-none"
            />
            <span className="shrink-0 text-sm font-semibold text-brand-blue">
              Expert
            </span>
          </div>
          <AppBarAuthActions />
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="Freelancer navigation">
          {FREELANCER_NAV_LINKS.map((link) => {
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
      </div>
    </header>
  );
}
