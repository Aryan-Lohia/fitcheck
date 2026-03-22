import Link from "next/link";

const links = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "mailto:support@fitcheck.app", label: "Contact" },
] as const;

export function LandingSlimFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border-subtle bg-surface-muted py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-text-muted md:flex-row md:px-6">
        <nav aria-label="Legal">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="font-medium text-text-muted transition-colors hover:text-brand-blue"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-center text-xs text-text-muted md:text-right">
          © {year} FitCheck. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
