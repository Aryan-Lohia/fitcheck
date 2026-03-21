"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { USER_NAV_LINKS } from "@/components/layout/user-nav-config";
import { cn } from "@/lib/utils";

export function UserBottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 grid h-14 grid-cols-5 border-t border-border-subtle bg-surface/98 backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      {USER_NAV_LINKS.map((link) => {
        const active = path?.startsWith(link.href) ?? false;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex min-h-11 items-center justify-center px-1 py-2 text-center text-xs font-medium leading-tight transition-colors",
              active
                ? "font-semibold text-brand-blue"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
