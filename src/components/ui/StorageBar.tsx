"use client";

interface StorageBarProps {
  usedBytes: number;
  maxBytes: number;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function StorageBar({ usedBytes, maxBytes }: StorageBarProps) {
  const pct = maxBytes > 0 ? Math.min((usedBytes / maxBytes) * 100, 100) : 0;
  const color =
    pct >= 85 ? "bg-brand-primary" : pct >= 60 ? "bg-brand-accent" : "bg-brand-blue";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Storage</span>
        <span>
          {formatMB(usedBytes)} MB / {formatMB(maxBytes)} MB used
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-border-subtle">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
