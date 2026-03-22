"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const FEATURES: Array<{ title: string; description: string }> = [
  {
    title: "Virtual try-on & sharing",
    description:
      "Try out your outfit online, download & share.",
  },
  {
    title: "Personalized picks",
    description:
      "Get recommendations on products customized to your type.",
  },
  {
    title: "Talk to experts live",
    description:
      "Connect instantly with freelancers for live guidance over video calls.",
  },
];

export function FeaturesIntro({
  onComplete,
}: {
  onComplete: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
          You&apos;re all set
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
          Here&apos;s what you can do with FitCheck
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          A quick overview before you jump in.
        </p>
      </div>

      <ul className="space-y-4">
        {FEATURES.map((item, i) => (
          <li
            key={item.title}
            className="flex gap-4 rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue/12 text-sm font-bold text-brand-blue"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-text-primary">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <p
          className="rounded-lg border border-brand-primary/25 bg-brand-primary/5 px-3 py-2 text-sm text-brand-primary"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="w-full min-h-11"
        disabled={pending}
        onClick={async () => {
          setError(null);
          setPending(true);
          try {
            await onComplete();
          } catch {
            setError("Something went wrong. Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Continuing…" : "Get started"}
      </Button>
    </div>
  );
}
