/** Inline SVGs — brand palette, no external assets */

export function LandingHeroGraphic({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 520 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="lg-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFB33F" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#FF4400" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#134E8E" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="lg-grad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C00707" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#134E8E" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect
        x="40"
        y="40"
        width="440"
        height="320"
        rx="32"
        className="fill-surface stroke-border-subtle"
        strokeWidth="1"
      />
      <rect x="60" y="60" width="400" height="200" rx="24" fill="url(#lg-grad1)" />
      <ellipse cx="260" cy="320" rx="160" ry="14" fill="url(#lg-grad2)" />
      <path
        d="M260 100c-18 0-32 14-32 32 0 8 3 16 8 22l-72 42c-12 7-20 20-20 35v118h232V231c0-15-8-28-20-35l-72-42c5-6 8-14 8-22 0-18-14-32-32-32Z"
        fill="#134E8E"
        fillOpacity="0.12"
        stroke="#134E8E"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M260 78v36"
        stroke="#FF4400"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="140" cy="140" r="10" fill="#FFB33F" fillOpacity="0.85" />
      <circle cx="380" cy="180" r="8" fill="#C00707" fillOpacity="0.5" />
      <path
        d="M320 260l40 48M200 268l-36 40"
        stroke="#134E8E"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
      <rect
        x="180"
        y="288"
        width="160"
        height="44"
        rx="12"
        fill="#FF4400"
        fillOpacity="0.15"
        stroke="#FF4400"
        strokeWidth="1.5"
        strokeOpacity="0.4"
      />
    </svg>
  );
}

export function IconHanger({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M16 6a4 4 0 0 0-4 4 4 4 0 0 0 1.2 2.8L6 18h20l-7.2-5.2A4 4 0 0 0 20 10a4 4 0 0 0-4-4Z"
        stroke="#134E8E"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="#134E8E"
        fillOpacity="0.1"
      />
      <path d="M16 4v4" stroke="#FF4400" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconShoe({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M6 22c4-6 14-8 20-4l2 4H4l2-4Z"
        fill="#FFB33F"
        fillOpacity="0.35"
        stroke="#FF4400"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 22v4h16v-4" stroke="#134E8E" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconBag({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M10 14h12v12H10V14Z"
        fill="#134E8E"
        fillOpacity="0.12"
        stroke="#134E8E"
        strokeWidth="1.5"
      />
      <path
        d="M12 14v-3a4 4 0 0 1 8 0v3"
        stroke="#FF4400"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M14 20h4" stroke="#C00707" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconSunnies({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="11" cy="16" r="5" stroke="#134E8E" strokeWidth="1.5" fill="#134E8E" fillOpacity="0.08" />
      <circle cx="21" cy="16" r="5" stroke="#134E8E" strokeWidth="1.5" fill="#134E8E" fillOpacity="0.08" />
      <path d="M16 16h0M6 16h2M24 16h2" stroke="#FF4400" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconSpark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M16 4l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8Z"
        fill="#FFB33F"
        fillOpacity="0.6"
        stroke="#FF4400"
        strokeWidth="1"
      />
    </svg>
  );
}

export function IconChat({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M6 10a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-5 4v-4H9a3 3 0 0 1-3-3v-8Z"
        fill="#134E8E"
        fillOpacity="0.1"
        stroke="#134E8E"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
