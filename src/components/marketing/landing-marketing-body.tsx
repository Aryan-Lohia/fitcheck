import Link from "next/link";
import {
  IconBag,
  IconChat,
  IconHanger,
  IconShoe,
  IconSpark,
  IconSunnies,
} from "@/components/marketing/landing-graphics";
import { cn } from "@/lib/utils";

const btnPrimary =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-accent px-8 text-sm font-semibold text-white shadow-lg shadow-brand-accent/25 transition-all hover:bg-brand-accent/92 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2";

const btnOutline =
  "inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-brand-blue bg-surface px-8 text-sm font-semibold text-brand-blue transition-colors hover:bg-brand-blue/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2";

export function LandingMarketingBody() {
  return (
    <>
      {/* What FitCheck does */}
      <section
        id="what"
        className="scroll-mt-20 border-y border-border-subtle bg-gradient-to-b from-surface to-brand-warm/[0.07] py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              What FitCheck does
            </h2>
            <p className="mt-3 text-text-muted">
              We connect what you see online to how it will feel on you—without
              the guesswork.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Fit from any link",
                body: "Paste a product URL and get structured size guidance tuned to your profile and photos.",
                stripe: "from-brand-blue/20 to-brand-blue/5",
                border: "border-brand-blue/25",
              },
              {
                title: "Visual try-on context",
                body: "Pair vault photos with items so you can preview looks and compare options side by side.",
                stripe: "from-brand-accent/25 to-brand-warm/15",
                border: "border-brand-accent/30",
              },
              {
                title: "AI stylist chat",
                body: "Ask follow-ups, explore outfits, and get suggestions in a thread that remembers your taste.",
                stripe: "from-brand-warm/40 to-brand-warm/10",
                border: "border-brand-warm/50",
              },
            ].map((card) => (
              <div
                key={card.title}
                className={cn(
                  "rounded-2xl border bg-surface p-6 shadow-sm",
                  card.border,
                )}
              >
                <div
                  className={cn(
                    "mb-4 h-1.5 w-12 rounded-full bg-gradient-to-r",
                    card.stripe,
                  )}
                />
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="scroll-mt-20 bg-surface-muted py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                App features
              </h2>
              <p className="mt-2 max-w-xl text-text-muted">
                Everything you need to shop smarter—from import to expert help.
              </p>
            </div>
            <Link
              href="/signup"
              className="text-sm font-semibold text-brand-blue underline-offset-4 hover:underline"
            >
              Create your account →
            </Link>
          </div>
          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <IconHanger className="h-9 w-9" />,
                title: "Product import",
                text: "Save items from the web and keep fit summaries in one place.",
              },
              {
                icon: <IconSpark className="h-9 w-9" />,
                title: "Fit check engine",
                text: "Confidence, reasons, and size picks grounded in your data.",
              },
              {
                icon: <IconChat className="h-9 w-9" />,
                title: "AI chat sessions",
                text: "Dedicated threads with context from your closet and picks.",
              },
              {
                icon: <IconShoe className="h-9 w-9" />,
                title: "Photo vault",
                text: "Organize full-body shots and references for accurate results.",
              },
              {
                icon: <IconBag className="h-9 w-9" />,
                title: "Book experts",
                text: "Schedule freelance stylists when you want a human eye.",
              },
              {
                icon: <IconSunnies className="h-9 w-9" />,
                title: "Profile wizard",
                text: "Measurements, style tags, and skin tone for personalized output.",
              },
            ].map((f) => (
              <li
                key={f.title}
                className="flex gap-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-warm/15">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="scroll-mt-20 relative overflow-hidden py-20 md:py-28"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-primary/[0.06] via-brand-warm/10 to-brand-blue/10"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-lg text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Simple pricing
            </h2>
            <p className="mt-3 text-text-muted">
              One plan with everything. Try it free for a week.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-md">
            <div className="rounded-3xl border-2 border-brand-blue/35 bg-surface p-8 shadow-xl shadow-brand-blue/10 md:p-10">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-sm font-semibold text-text-muted">US</span>
                <span className="text-5xl font-bold tracking-tight text-brand-blue">
                  $1,000
                </span>
                <span className="text-lg font-medium text-text-muted">/ month</span>
              </div>
              <p className="mt-2 text-center text-sm font-medium text-brand-accent">
                7-day free trial included
              </p>
              <ul className="mt-8 space-y-3 text-sm text-text-muted">
                {[
                  "Full FitCheck platform access",
                  "AI fit checks & product import",
                  "Vault, chat, and profile tools",
                  "Expert booking workflow",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-brand-accent" aria-hidden>
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-3">
                <Link href="/signup" className={cn(btnPrimary, "w-full justify-center")}>
                  Start your free trial
                </Link>
                <Link
                  href="/login"
                  className={cn(btnOutline, "w-full justify-center border-brand-blue/40")}
                >
                  I already have an account
                </Link>
              </div>
              <p className="mt-6 text-center text-xs text-text-muted">
                Trial unlocks core features. Billing details may be required after
                the trial period per your workspace settings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section
        id="contact"
        className="scroll-mt-20 border-t border-border-subtle bg-surface py-20 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Contact
            </h2>
            <p className="mt-3 text-text-muted">
              Questions about FitCheck, partnerships, or enterprise? We read
              every message.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border-subtle bg-surface-muted/80 p-8 text-center shadow-inner">
            <p className="text-sm font-medium text-text-primary">Email us</p>
            <a
              href="mailto:hello@fitcheck.com"
              className="mt-2 inline-block text-lg font-semibold text-brand-blue underline-offset-4 hover:underline"
            >
              hello@fitcheck.com
            </a>
            <p className="mt-4 text-xs text-text-muted">
              Typical reply within 1–2 business days.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-text-primary py-12 text-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 md:flex-row md:items-start md:justify-between md:px-6">
          <div>
            <p className="text-xl font-bold text-brand-warm">FitCheck</p>
            <p className="mt-2 max-w-xs text-sm text-white/70">
              AI-powered fit, wardrobe context, and stylist chat—in your brand
              colors, on your time.
            </p>
          </div>
          <div className="flex flex-wrap gap-10 text-sm">
            <div>
              <p className="font-semibold text-brand-warm">Product</p>
              <ul className="mt-3 space-y-2 text-white/75">
                <li>
                  <a href="#what" className="hover:text-surface">
                    What we do
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-surface">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-surface">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-brand-warm">Account</p>
              <ul className="mt-3 space-y-2 text-white/75">
                <li>
                  <Link href="/login" className="hover:text-surface">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-surface">
                    Sign up
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-brand-warm">Reach us</p>
              <ul className="mt-3 space-y-2 text-white/75">
                <li>
                  <a href="#contact" className="hover:text-surface">
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:hello@fitcheck.com"
                    className="hover:text-surface"
                  >
                    hello@fitcheck.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 px-4 pt-8 text-center text-xs text-white/50 md:px-6">
          © {new Date().getFullYear()} FitCheck. All rights reserved.
        </div>
      </footer>
    </>
  );
}
