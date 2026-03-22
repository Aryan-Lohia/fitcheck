"use client";

import { profileMediaImageUrl } from "@/lib/media/profile-media-image-url";

export type FitCheckThreadTurn = {
  key: string;
  at: string;
  userCaption: string;
  /** Stored for history; fit analysis also shown in the card above the thread */
  fitSnapshot: {
    fitLabel: string;
    fitConfidence: number;
    reasons: string[];
    warnings: string[];
    recommendedSize: string | null;
    alternateSize: string | null;
  } | null;
  tryOnMediaIds: {
    front: string;
    back: string;
    zoomed: string;
  };
};

type TryOnOrder = { label: keyof FitCheckThreadTurn["tryOnMediaIds"]; title: string };

const ORDER: TryOnOrder[] = [
  { label: "front", title: "Front" },
  { label: "back", title: "Back" },
  { label: "zoomed", title: "Zoomed fit" },
];

function TryOnSkeletonRow() {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      {ORDER.map(({ title }) => (
        <div key={title} className="space-y-1">
          <p className="text-[10px] font-medium uppercase text-text-muted">{title}</p>
          <div className="h-36 w-full animate-pulse rounded-xl bg-border-subtle" />
        </div>
      ))}
    </div>
  );
}

type FitCheckThreadProps = {
  turns: FitCheckThreadTurn[];
  tryOnLoading: boolean;
  onRegenerate: () => void;
  regenerateDisabled: boolean;
};

export function FitCheckThread({
  turns,
  tryOnLoading,
  onRegenerate,
  regenerateDisabled,
}: FitCheckThreadProps) {
  if (turns.length === 0 && !tryOnLoading) {
    return (
      <p className="text-xs text-text-muted">
        Run fit check to start a thread — your prompt and generated try-on views appear here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {turns.map((turn, index) => (
        <div key={turn.key} className="space-y-2">
          <div className="flex justify-end">
            <div className="max-w-[90%] rounded-2xl rounded-br-md bg-brand-blue px-3 py-2.5 text-left shadow-sm">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-white">
                {turn.userCaption}
              </p>
              <p className="mt-1 text-[10px] text-white/70">
                {new Date(turn.at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <div className="flex justify-start">
            <div className="max-w-full rounded-2xl rounded-bl-md border border-brand-warm/35 bg-surface px-3 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
                Try-on
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {ORDER.map(({ label, title }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-[10px] font-medium uppercase text-text-muted">
                      {title}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profileMediaImageUrl(turn.tryOnMediaIds[label], "tryOn")}
                      alt={`${title} try-on`}
                      className="h-36 w-full rounded-xl border border-border-subtle object-cover sm:h-40"
                    />
                  </div>
                ))}
              </div>
              {index === turns.length - 1 ? (
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={regenerateDisabled}
                  className="mt-3 w-full rounded-lg border border-brand-warm/50 bg-brand-warm/15 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-brand-warm/25 disabled:opacity-50"
                >
                  Regenerate images
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      {tryOnLoading ? (
        <div className="flex justify-start">
          <div className="max-w-full rounded-2xl rounded-bl-md border border-brand-warm/35 bg-surface px-3 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
              Try-on
            </p>
            <p className="mt-1 text-xs text-text-muted">Generating new views…</p>
            <TryOnSkeletonRow />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function buildFitCheckUserCaption(
  selectedSize: string | null,
  customPrompt: string,
): string {
  const custom = customPrompt.trim();
  const parts: string[] = [];
  if (selectedSize) parts.push(`Size: ${selectedSize}`);
  if (custom) parts.push(custom);
  if (parts.length === 0) return "Fit check — default try-on (no extra styling notes)";
  return parts.join("\n\n");
}
