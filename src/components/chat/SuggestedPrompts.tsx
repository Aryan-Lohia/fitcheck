"use client";

import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What fits my body type?",
  "Is this dress good for a wedding?",
  "Suggest outfits for summer",
  "What colors suit my skin tone?",
  "Help me find my size in Zara",
];

type SuggestedPromptsProps = {
  onSelect: (prompt: string) => void;
};

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-col items-center px-4 pt-12">
      <p className="text-sm font-medium text-text-muted">Try asking</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            className={cn(
              "min-h-10 rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm text-text-primary transition-colors",
              "hover:border-brand-blue/40 hover:text-brand-blue",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40",
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
