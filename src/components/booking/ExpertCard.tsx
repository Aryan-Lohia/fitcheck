"use client";

interface ExpertCardProps {
  name: string;
  specializations: string[];
  bio: string;
  rating?: number;
}

const chipColors = [
  "bg-brand-blue/12 text-brand-blue",
  "bg-brand-warm/30 text-brand-blue",
  "bg-brand-accent/12 text-brand-accent",
  "bg-brand-blue/8 text-brand-blue",
  "bg-brand-warm/20 text-text-primary",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ExpertCard({ name, specializations, bio, rating }: ExpertCardProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">
          {getInitials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-text-primary">{name}</h3>
            {rating !== undefined && (
              <span className="shrink-0 text-sm text-brand-warm">★ {rating.toFixed(1)}</span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{bio}</p>
        </div>
      </div>
      {specializations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {specializations.map((spec, i) => (
            <span
              key={spec}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chipColors[i % chipColors.length]}`}
            >
              {spec}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
