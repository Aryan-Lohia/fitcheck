/** Decorative fashion-themed SVG — brand palette only, no network assets */

export function FashionHeroIllustration({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <svg
        className={className}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle cx="40" cy="40" r="38" className="stroke-brand-warm/40" strokeWidth="1.5" />
        <path
          d="M28 32c4-8 20-8 24 0l8 4v8H20v-8l8-4Z"
          className="fill-brand-blue/15 stroke-brand-blue/50"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M40 22v12"
          className="stroke-brand-accent"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 420 340"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="auth-hanger" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF4400" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#134E8E" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <ellipse
        cx="210"
        cy="280"
        rx="140"
        ry="12"
        className="fill-black/[0.04]"
      />
      <path
        d="M210 48c-12 0-22 10-22 22 0 6 2 11 6 15l-48 28c-8 4-14 12-14 22v98h156v-98c0-10-6-18-14-22l-48-28c4-4 6-9 6-15 0-12-10-22-22-22Z"
        className="fill-brand-blue/12 stroke-brand-blue/35"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M210 32v28"
        className="stroke-brand-accent"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M186 118c16 20 44 20 48 0"
        className="stroke-brand-warm/70"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="118" cy="92" r="6" className="fill-brand-warm/50" />
      <circle cx="302" cy="120" r="4" className="fill-brand-accent/60" />
      <path
        d="M72 200c24-32 56-48 92-52M348 188c-20-28-52-44-86-48"
        className="stroke-brand-warm/30"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M140 240h140"
        stroke="url(#auth-hanger)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
