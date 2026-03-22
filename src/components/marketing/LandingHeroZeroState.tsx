"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { IconSpark } from "@/components/marketing/landing-graphics";
import { cn } from "@/lib/utils";

const INTENT_CHIPS = [
  { label: "Find my size", prompt: "Help me find the right size for an item I'm shopping for online." },
  { label: "Style an outfit", prompt: "Suggest an outfit using pieces I already own." },
  { label: "Compare fits", prompt: "Compare how two different cuts might fit my body type." },
  { label: "Book a stylist", prompt: "I want to book a human stylist for a session." },
] as const;

export function LandingHeroZeroState() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const goSignupWithPrompt = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      router.push(`/signup?prompt=${encodeURIComponent(t)}`);
    },
    [router],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goSignupWithPrompt(value);
  };

  return (
    <section
      className="relative flex min-h-[100dvh] flex-col border-b border-border-subtle/80 bg-surface-muted"
      aria-labelledby="landing-hero-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-1/4 top-0 h-[min(50vh,28rem)] w-[min(100vw,36rem)] rounded-full bg-brand-blue/[0.12] blur-3xl" />
        <div className="absolute -right-1/4 top-1/4 h-[min(45vh,26rem)] w-[min(90vw,32rem)] rounded-full bg-brand-accent/[0.10] blur-3xl" />
        <div className="absolute bottom-1/3 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-brand-warm/[0.14] blur-3xl" />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 pb-0 pt-6 md:px-6 md:pt-10">
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue/20 via-brand-accent/15 to-brand-warm/25 shadow-lg shadow-brand-blue/10 md:h-20 md:w-20"
          aria-hidden
        >
          <IconSpark className="h-9 w-9 text-brand-blue md:h-11 md:w-11" />
        </div>

        <h1
          id="landing-hero-heading"
          className="max-w-4xl text-center text-[clamp(1.75rem,5.2vw,3.35rem)] font-bold leading-[1.08] tracking-tight"
        >
          <span className="block bg-gradient-to-r from-brand-blue via-text-primary to-brand-accent bg-clip-text uppercase tracking-[0.08em] text-transparent">
            Fit check anything
          </span>
          <span className="mt-3 block text-[clamp(0.95rem,2.8vw,1.15rem)] font-semibold normal-case tracking-tight text-brand-blue">
            with AI &amp; Experts
          </span>
        </h1>
        <p className="mt-5 text-center text-base font-semibold tracking-wide text-text-primary md:text-lg">
          Shop, Try, Buy
        </p>

      </div>

      <div className="relative z-[1] w-full max-w-3xl shrink-0 self-center pb-4 pb-2 md:px-6">
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 md:flex-wrap md:justify-center md:overflow-visible"
          role="group"
          aria-label="Quick prompts"
        >
          {INTENT_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => goSignupWithPrompt(chip.prompt)}
              className={cn(
                "shrink-0 rounded-full border border-border-subtle bg-surface/90 px-4 py-2.5 text-sm font-medium text-text-primary shadow-sm",
                "transition-colors hover:border-brand-blue/35 hover:bg-brand-blue/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border-2 border-border-subtle bg-surface p-3 shadow-lg shadow-black/[0.04] md:p-4"
        >
          <label htmlFor="landing-prompt" className="sr-only">
            Ask FitCheck
          </label>
          <textarea
            id="landing-prompt"
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask FitCheck anything…"
            className="w-full resize-none bg-transparent text-base text-text-primary placeholder:text-text-muted/70 focus:outline-none md:min-h-[5.5rem]"
            enterKeyHint="send"
          />
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle/80 pt-3">
            <button
              type="submit"
              disabled={!value.trim()}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-accent px-5 text-sm font-semibold text-white shadow-md transition-colors",
                "hover:bg-brand-accent/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-45",
              )}
            >
              Continue with FitCheck
            </button>
          </div>
        </form>

        <p className="mt-4 px-1 text-center text-xs leading-relaxed text-text-muted">
          FitCheck uses AI and can make mistakes. Sign up to save chats, run fit checks, and book
          experts.
        </p>
      </div>

      <div className="h-6 shrink-0 md:h-8" aria-hidden />
    </section>
  );
}
