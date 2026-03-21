"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";

type ProductImage = { id: string; imageUrl: string };

type ProductImport = {
  id: string;
  title: string | null;
  brand: string | null;
  sourceUrl: string;
  fitSummaryJson: Record<string, unknown> | null;
  createdAt: string;
  images: ProductImage[];
};

type ImportResponse = { productImportId: string };
type ListResponse = { imports: ProductImport[] };
type ProfileResponse = {
  profile: { profileCompletion: number } | null;
};

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
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

function FitBadge({ summary }: { summary: Record<string, unknown> | null }) {
  if (!summary) return null;
  const label =
    typeof summary.fitLabel === "string" ? summary.fitLabel : null;
  if (!label) return null;

  const colors: Record<string, string> = {
    "Great Fit": "bg-brand-blue/12 text-brand-blue",
    "Good Fit": "bg-brand-warm/25 text-brand-blue",
    "Poor Fit": "bg-brand-primary/12 text-brand-primary",
  };

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        colors[label] ?? "bg-border-subtle text-text-muted",
      )}
    >
      {label}
    </span>
  );
}

/** Module scope: survives React Strict Mode remounts so we only auto-import once per tab load. */
let deepLinkImportStarted: string | null = null;

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importParam = searchParams.get("import");
  const { user, isLoading: authLoading } = useAuth();
  const [url, setUrl] = useState("");

  const importMutation = useMutation({
    mutationFn: (productUrl: string) =>
      api<ImportResponse>("/api/product/import", {
        method: "POST",
        body: { url: productUrl },
      }),
    onSuccess: (data) => {
      setUrl("");
      router.push(`/product/${data.productImportId}`);
    },
    onError: (_err, productUrl) => {
      if (productUrl && deepLinkImportStarted === productUrl) {
        deepLinkImportStarted = null;
      }
    },
  });

  useEffect(() => {
    if (!user || !importParam) return;
    if (deepLinkImportStarted === importParam) return;
    deepLinkImportStarted = importParam;
    importMutation.mutate(importParam);
    // importMutation is stable enough; only user + importParam should retrigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, importParam]);

  const { data: profileData } = useQuery<ProfileResponse>({
    queryKey: ["profile"],
    queryFn: () => api<ProfileResponse>("/api/profile/measurements"),
    enabled: !!user,
  });

  const { data: listData, isLoading: listLoading } = useQuery<ListResponse>({
    queryKey: ["product-list"],
    queryFn: () => api<ListResponse>("/api/product/list"),
    enabled: !!user,
  });

  const profileIncomplete =
    profileData?.profile == null ||
    (profileData.profile.profileCompletion ?? 0) < 50;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    importMutation.mutate(trimmed);
  };

  if (authLoading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-blue" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary">FitCheck</h1>
            <p className="mt-1 text-sm text-text-muted">
              Paste a product link to check your fit
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mb-6">
            <label htmlFor="dashboard-product-url" className="sr-only">
              Product URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <Input
                id="dashboard-product-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste product URL..."
                disabled={importMutation.isPending}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={importMutation.isPending || !url.trim()}
                className="shrink-0 sm:min-w-[7rem]"
              >
                {importMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4 text-white" />
                    Analyzing…
                  </span>
                ) : (
                  "Analyze"
                )}
              </Button>
            </div>
            {importMutation.isError && (
              <p className="mt-2 text-sm text-brand-primary" role="alert">
                {importMutation.error.message}
              </p>
            )}
          </form>

          {!authLoading && user && profileIncomplete && (
            <Link
              href="/profile"
              className="mb-6 flex items-center gap-3 rounded-xl border border-brand-warm/50 bg-brand-warm/15 px-4 py-3 transition-colors hover:bg-brand-warm/25"
            >
              <span className="text-lg" aria-hidden>
                📋
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">
                  Complete your profile
                </p>
                <p className="text-xs text-text-muted">
                  Better measurements = more accurate fit predictions
                </p>
              </div>
              <span className="shrink-0 text-sm text-brand-blue" aria-hidden>
                →
              </span>
            </Link>
          )}
        </div>

        <section className="mt-8 lg:col-span-7 lg:mt-0">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Recent Imports
          </h2>

          {listLoading && (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6 text-brand-blue/40" />
            </div>
          )}

          {!listLoading && (!listData?.imports || listData.imports.length === 0) && (
            <div className="rounded-xl border border-dashed border-border-subtle bg-surface py-12 text-center">
              <p className="text-sm text-text-muted">No imports yet</p>
              <p className="mt-1 text-xs text-text-muted/80">
                Paste a product URL above to get started
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {listData?.imports.map((item) => (
              <Link
                key={item.id}
                href={`/product/${item.id}`}
                className="flex gap-3 rounded-xl border border-border-subtle bg-surface p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                {item.images[0] ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.images[0].imageUrl}
                      alt={decodeHtmlEntities(item.title ?? "Product")}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted/50">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                      />
                    </svg>
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {decodeHtmlEntities(item.title || "Untitled product")}
                  </p>
                  {item.brand && (
                    <p className="text-xs text-text-muted">
                      {decodeHtmlEntities(item.brand)}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <FitBadge summary={item.fitSummaryJson} />
                    <span className="text-xs text-text-muted">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center text-text-muted/40">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[50vh] items-center justify-center">
          <Spinner className="h-8 w-8 text-brand-blue" />
        </main>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
