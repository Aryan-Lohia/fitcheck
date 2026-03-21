"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/freelancers", label: "Freelancers" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/storage", label: "Storage" },
  { href: "/admin/api-usage", label: "API Usage" },
  { href: "/admin/trials", label: "Trials" },
  { href: "/admin/logs", label: "Audit Logs" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const navLinks = links.map(({ href, label }) => (
    <Link
      key={href}
      href={href}
      onClick={() => setOpen(false)}
      className={cn(
        "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        isActive(href)
          ? "bg-brand-blue text-white"
          : "text-text-primary hover:bg-brand-warm/15",
      )}
    >
      {label}
    </Link>
  ));

  return (
    <>
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-md border border-border-subtle bg-surface p-2 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40"
          aria-label="Toggle admin menu"
        >
          {open ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-surface p-6 shadow-xl">
            <h2 className="mb-6 text-lg font-bold text-brand-accent">Admin</h2>
            <nav className="space-y-1">{navLinks}</nav>
          </aside>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 border-r border-border-subtle bg-surface p-6 md:block">
        <h2 className="mb-6 text-lg font-bold text-brand-accent">Admin</h2>
        <nav className="space-y-1">{navLinks}</nav>
      </aside>
    </>
  );
}
