"use client";

import { cn } from "@/lib/utils";

type FitResultCardProps = {
  fitLabel: string;
  fitConfidence: number;
  reasons: string[];
  warnings: string[];
  recommendedSize: string | null;
  alternateSize: string | null;
};

const LABEL_COLORS: Record<string, string> = {
  "Perfect Fit": "bg-brand-blue/15 text-brand-blue",
  "Good Fit": "bg-brand-warm/30 text-brand-blue",
  "Slightly Tight": "bg-brand-warm/25 text-text-primary",
  "Slightly Loose": "bg-brand-warm/25 text-text-primary",
  "Size Unclear": "bg-brand-primary/12 text-brand-primary",
  "Need More Info": "bg-border-subtle text-text-muted",
};

export function FitResultCard({
  fitLabel,
  fitConfidence,
  reasons,
  warnings,
  recommendedSize,
  alternateSize,
}: FitResultCardProps) {
  const badgeColor =
    LABEL_COLORS[fitLabel] ?? "bg-border-subtle text-text-muted";
  const confidencePct = Math.round(fitConfidence * 100);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-block rounded-full px-3 py-1 text-sm font-semibold",
            badgeColor,
          )}
        >
          {fitLabel}
        </span>
        <span className="shrink-0 text-sm text-text-muted">
          {confidencePct}% confidence
        </span>
      </div>

      {recommendedSize && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Recommended Size
          </p>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {recommendedSize}
          </p>
          {alternateSize && (
            <p className="mt-0.5 text-sm text-text-muted">
              Also consider:{" "}
              <span className="font-medium text-text-primary">{alternateSize}</span>
            </p>
          )}
        </div>
      )}

      {reasons.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {reasons.map((r) => (
            <span
              key={r}
              className="rounded-full bg-brand-blue/10 px-3 py-1 text-xs text-brand-blue"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {warnings.map((w) => (
            <span
              key={w}
              className="rounded-full bg-brand-warm/35 px-3 py-1 text-xs text-text-primary"
            >
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
