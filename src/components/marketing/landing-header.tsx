"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "#what", label: "What we do" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-brand-blue transition-colors hover:bg-brand-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2";

const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-accent px-4 text-sm font-semibold text-white shadow-md shadow-brand-accent/20 transition-colors hover:bg-brand-accent/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2";

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle/60 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <a
          href="#top"
          className="text-xl font-bold tracking-tight text-brand-accent"
          onClick={() => setOpen(false)}
        >
          FitCheck
        </a>

        <nav
          className={cn(
            "absolute left-0 right-0 top-full flex flex-col gap-1 border-b border-border-subtle bg-surface px-4 py-3 shadow-lg md:static md:flex md:flex-row md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none",
            open ? "flex" : "hidden md:flex",
          )}
          aria-label="Page sections"
        >
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-brand-warm/15 hover:text-text-primary"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className={cn(btnGhost, "hidden sm:inline-flex")}>
            Log in
          </Link>
          <Link href="/signup" className={cn(btnPrimary, "hidden sm:inline-flex")}>
            Sign up
          </Link>
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-subtle text-text-primary md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="flex flex-col gap-2 border-t border-border-subtle bg-surface px-4 py-3 sm:hidden">
          <Link
            href="/login"
            className={cn(btnGhost, "w-full justify-center")}
            onClick={() => setOpen(false)}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={cn(btnPrimary, "w-full justify-center")}
            onClick={() => setOpen(false)}
          >
            Sign up
          </Link>
        </div>
      ) : null}
    </header>
  );
}
