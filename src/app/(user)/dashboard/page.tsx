"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectSpinner() {
  return (
    <svg
      className="h-8 w-8 animate-spin text-brand-blue"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function DashboardRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/chat?${q}` : "/chat");
  }, [router, searchParams]);

  return (
    <main className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4">
      <RedirectSpinner />
      <p className="text-sm text-text-muted">Opening AI Chat…</p>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[40vh] items-center justify-center">
          <RedirectSpinner />
        </main>
      }
    >
      <DashboardRedirectInner />
    </Suspense>
  );
}
