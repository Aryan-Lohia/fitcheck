"use client";

import { cn } from "@/lib/utils";
import type { ChatMode } from "@/lib/chat/mode";
import { CHAT_MODE_SHOP, CHAT_MODE_TRYON } from "@/lib/chat/mode";

type ChatModeIntroProps = {
  activeMode: ChatMode;
  onSelectMode: (mode: ChatMode) => void;
  disabled?: boolean;
};

export function ChatModeIntro({
  activeMode,
  onSelectMode,
  disabled,
}: ChatModeIntroProps) {
  return (
    <div className="flex flex-col items-center px-4 pt-8 pb-2">
      <p className="text-sm font-medium text-text-muted">
        How do you want to start?
      </p>
      <div className="mt-4 grid w-full max-w-md gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectMode(CHAT_MODE_SHOP)}
          className={cn(
            "rounded-2xl border px-4 py-4 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40",
            activeMode === CHAT_MODE_SHOP
              ? "border-brand-blue/50 bg-brand-blue/10 shadow-sm"
              : "border-border-subtle bg-surface hover:border-brand-warm/50 hover:bg-brand-warm/10",
            disabled && "opacity-50",
          )}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
            Shop
          </span>
          <p className="mt-2 text-sm font-medium text-text-primary">
            Ask anything, share photos
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Clothing, home, and general shopping picks from live catalog search.
          </p>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectMode(CHAT_MODE_TRYON)}
          className={cn(
            "rounded-2xl border px-4 py-4 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40",
            activeMode === CHAT_MODE_TRYON
              ? "border-brand-blue/50 bg-brand-blue/10 shadow-sm"
              : "border-border-subtle bg-surface hover:border-brand-warm/50 hover:bg-brand-warm/10",
            disabled && "opacity-50",
          )}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
            Try-on
          </span>
          <p className="mt-2 text-sm font-medium text-text-primary">
            Link or product photo
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Size check plus AI try-on using your front &amp; back photos.
          </p>
        </button>
      </div>
    </div>
  );
}
