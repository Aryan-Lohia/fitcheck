"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/hooks/use-api";
import { FitResultCard } from "@/components/product/FitResultCard";
import {
  FitCheckThread,
  buildFitCheckUserCaption,
  type FitCheckThreadTurn,
} from "@/components/product/FitCheckThread";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";

const THREAD_STORAGE_KEY = (productId: string) =>
  `fitcheck-fit-thread-v1:${productId}`;

function parseStoredThread(raw: string | null): FitCheckThreadTurn[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter((row): row is FitCheckThreadTurn => {
      if (!row || typeof row !== "object") return false;
      const t = row as FitCheckThreadTurn;
      const m = t.tryOnMediaIds;
      return (
        typeof t.key === "string" &&
        typeof t.at === "string" &&
        typeof t.userCaption === "string" &&
        m &&
        typeof m.front === "string" &&
        typeof m.back === "string" &&
        typeof m.zoomed === "string"
      );
    });
  } catch {
    return [];
  }
}

function appendThreadTurn(
  fit: FitResult | null,
  variations: TryOnVariation[],
  caption: string,
): FitCheckThreadTurn | null {
  if (variations.length !== 3) return null;
  const byLabel = Object.fromEntries(
    variations.map((v) => [v.label, v.id]),
  ) as Record<string, string>;
  if (!byLabel.front || !byLabel.back || !byLabel.zoomed) return null;
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `turn-${Date.now()}`,
    at: new Date().toISOString(),
    userCaption: caption,
    fitSnapshot: fit
      ? {
        fitLabel: fit.fitLabel,
        fitConfidence: fit.fitConfidence,
        reasons: fit.reasons,
        warnings: fit.warnings,
        recommendedSize: fit.recommendedSize,
        alternateSize: fit.alternateSize,
      }
      : null,
    tryOnMediaIds: {
      front: byLabel.front,
      back: byLabel.back,
      zoomed: byLabel.zoomed,
    },
  };
}

function seedTurnFromBundle(
  bundle: TryOnBundle,
): FitCheckThreadTurn | null {
  if (!bundle.runId || bundle.variations.length !== 3) return null;
  return appendThreadTurn(
    null,
    bundle.variations,
    "Saved try-on (from last visit)",
  );
}

type ProductImage = {
  id: string;
  imageUrl: string;
  sourceType: string;
};

type NormalizedData = {
  variants?: { size?: string[]; color?: string[] };
  material?: string;
  category?: string;
  measurements?: Record<string, number>;
};

type Product = {
  id: string;
  title: string | null;
  brand: string | null;
  price: string | null;
  normalizedJson: NormalizedData | null;
  fitSummaryJson: FitResult | null;
  images: ProductImage[];
};

type FitResult = {
  fitLabel: string;
  fitConfidence: number;
  reasons: string[];
  warnings: string[];
  recommendedSize: string | null;
  alternateSize: string | null;
};

type UserMedia = {
  id: string;
  fileName: string;
  createdAt: string;
};

type TryOnVariation = {
  id: string;
  label: "front" | "back" | "zoomed";
  s3Key: string;
  downloadUrl: string;
};

type TryOnBundle = {
  runId: string | null;
  variations: TryOnVariation[];
};

function FitCheckFitSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border-subtle bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-full bg-border-subtle" />
        <div className="h-5 w-16 rounded bg-border-subtle" />
      </div>
      <div className="mt-6 h-10 w-28 rounded bg-border-subtle" />
      <div className="mt-4 flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 w-28 rounded-full bg-border-subtle" />
        ))}
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-64 rounded-xl bg-border-subtle" />
      <div className="h-6 w-3/4 rounded bg-border-subtle" />
      <div className="h-4 w-1/2 rounded bg-border-subtle" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-14 rounded-lg bg-border-subtle" />
        ))}
      </div>
      <div className="h-12 rounded-xl bg-border-subtle" />
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [runInFlight, setRunInFlight] = useState(false);
  const [fitRefreshing, setFitRefreshing] = useState(false);
  const [tryOnRefreshing, setTryOnRefreshing] = useState(false);
  const [liveFit, setLiveFit] = useState<FitResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [tryOnCustomPrompt, setTryOnCustomPrompt] = useState("");
  const [fitThread, setFitThread] = useState<FitCheckThreadTurn[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<{ product: Product }>(`/api/product/${id}`),
    enabled: !!id,
  });

  const { data: mediaData } = useQuery({
    queryKey: ["media", "photos"],
    queryFn: () => api<{ media: UserMedia[] }>("/api/profile/media?category=photos"),
  });

  const product = data?.product;
  const photos = useMemo(() => mediaData?.media ?? [], [mediaData?.media]);
  const hasMandatoryPhotos = photos.length >= 2;

  const { data: tryOnBundle } = useQuery({
    queryKey: ["productTryOn", id],
    queryFn: () => api<TryOnBundle>(`/api/product/${id}/try-on`),
    enabled: !!id && hasMandatoryPhotos,
  });

  /* Reset product-scoped UI when navigating to another product. */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional reset on route param change */
    setLiveFit(null);
    setRunError(null);
    setTryOnCustomPrompt("");
    setFitThread(id ? parseStoredThread(localStorage.getItem(THREAD_STORAGE_KEY(id))) : []);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id]);

  useEffect(() => {
    if (!id || !tryOnBundle?.runId || tryOnBundle.variations.length !== 3) return;
    /* eslint-disable react-hooks/set-state-in-effect -- seed thread once when try-on bundle loads */
    setFitThread((prev) => {
      if (prev.length > 0) return prev;
      const seeded = seedTurnFromBundle(tryOnBundle);
      return seeded ? [seeded] : prev;
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, tryOnBundle]);

  useEffect(() => {
    if (!id || fitThread.length === 0) return;
    try {
      localStorage.setItem(THREAD_STORAGE_KEY(id), JSON.stringify(fitThread));
    } catch {
      // ignore quota
    }
  }, [id, fitThread]);

  const normalized = product?.normalizedJson;
  const sizes = normalized?.variants?.size ?? [];
  const fitResult = liveFit ?? product?.fitSummaryJson;
  const profileIncomplete = fitResult?.fitLabel === "Need More Info";

  const runFitCheck = useCallback(async () => {
    if (!id || !product || !hasMandatoryPhotos) return;
    setRunInFlight(true);
    setRunError(null);
    setFitRefreshing(true);
    setTryOnRefreshing(true);

    let resolvedFit: FitResult | null = null;
    let resolvedVars: TryOnVariation[] = [];

    const caption = buildFitCheckUserCaption(
      selectedSize,
      tryOnCustomPrompt,
    );

    const fitReq = api<{ fit: FitResult }>("/api/product/check-fit", {
      method: "POST",
      body: { productImportId: id, selectedSize },
    })
      .then((r) => {
        resolvedFit = r.fit;
        setLiveFit(r.fit);
      })
      .finally(() => {
        setFitRefreshing(false);
      });

    const tryOnReq = api<TryOnBundle & { runId: string }>(
      `/api/product/${id}/try-on`,
      {
        method: "POST",
        body: {
          frontMediaId: photos[0]?.id,
          backMediaId: photos[1]?.id,
          selectedProductImageUrl: product.images[0]?.imageUrl,
          customPrompt: tryOnCustomPrompt.trim() || undefined,
        },
      },
    )
      .then((r) => {
        resolvedVars = r.variations;
        queryClient.setQueryData(["productTryOn", id], {
          runId: r.runId,
          variations: r.variations,
        });
      })
      .finally(() => {
        setTryOnRefreshing(false);
      });

    const results = await Promise.allSettled([fitReq, tryOnReq]);
    setRunInFlight(false);

    const messages: string[] = [];
    if (results[0].status === "rejected") {
      messages.push(
        results[0].reason instanceof Error
          ? results[0].reason.message
          : "Fit analysis failed.",
      );
    }
    if (results[1].status === "rejected") {
      messages.push(
        results[1].reason instanceof Error
          ? results[1].reason.message
          : "Try-on generation failed.",
      );
    }
    if (messages.length) setRunError(messages.join(" "));

    if (results[1].status === "fulfilled" && resolvedVars.length === 3) {
      const turn = appendThreadTurn(resolvedFit, resolvedVars, caption);
      if (turn) setFitThread((prev) => [...prev, turn]);
    }
  }, [
    id,
    product,
    hasMandatoryPhotos,
    photos,
    selectedSize,
    queryClient,
    tryOnCustomPrompt,
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-36 pt-4 md:px-6">
      {isLoading && <ProductSkeleton />}

      {error && (
        <div
          className="rounded-xl border border-brand-primary/25 bg-brand-primary/8 p-4 text-sm text-brand-primary"
          role="alert"
        >
          Failed to load product. Please try again.
        </div>
      )}

      {product && (
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          <div>
            {product.images.length > 0 && (
              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:px-0">
                {product.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.id}
                    src={img.imageUrl}
                    alt={decodeHtmlEntities(product.title ?? "Product image")}
                    className="h-72 w-auto shrink-0 snap-center rounded-xl bg-surface-muted object-cover"
                  />
                ))}
              </div>
            )}

            <div className="mt-4 space-y-1">
              {product.brand && (
                <p className="text-sm font-medium uppercase tracking-wide text-text-muted">
                  {decodeHtmlEntities(product.brand)}
                </p>
              )}
              <h1 className="text-xl font-semibold text-text-primary">
                {decodeHtmlEntities(product.title ?? "Untitled Product")}
              </h1>
              {product.price && (
                <p className="text-lg font-bold text-text-primary">
                  {decodeHtmlEntities(product.price)}
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {normalized?.material && (
                <span className="rounded-full bg-brand-warm/20 px-3 py-1 text-xs text-brand-blue">
                  {decodeHtmlEntities(normalized.material)}
                </span>
              )}
              {normalized?.category && (
                <span className="rounded-full bg-brand-warm/20 px-3 py-1 text-xs text-brand-blue">
                  {decodeHtmlEntities(normalized.category)}
                </span>
              )}
            </div>

            {sizes.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-text-primary">
                  Select Size
                </p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={cn(
                        "min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40",
                        selectedSize === size
                          ? "border-brand-accent bg-brand-accent text-white"
                          : "border-border-subtle bg-surface text-text-primary hover:border-brand-blue/40",
                      )}
                    >
                      {decodeHtmlEntities(size)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {profileIncomplete && (
              <div className="mt-4 rounded-xl border border-brand-warm/50 bg-brand-warm/15 p-4 text-sm text-text-primary">
                Complete your body measurements in{" "}
                <a
                  href="/profile"
                  className="font-semibold text-brand-blue underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                >
                  Profile
                </a>{" "}
                for more accurate fit recommendations.
              </div>
            )}

            {!hasMandatoryPhotos && (
              <div className="mt-6 rounded-xl border border-brand-primary/30 bg-brand-primary/8 p-4 text-sm text-text-primary">
                Front and back photos are mandatory for fit check and try-on.
                Please upload at least 2 photos in{" "}
                <a
                  href="/profile"
                  className="font-semibold text-brand-blue underline"
                >
                  Profile
                </a>{" "}
                or{" "}
                <a href="/vault" className="font-semibold text-brand-blue underline">
                  Vault
                </a>
                .
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm lg:mt-0">
            <h2 className="text-sm font-semibold text-text-primary">Fit check</h2>
            <p className="mt-1 text-xs text-text-muted">
              Size analysis and three try-on views (front, back, zoomed) run together.
              Garment artwork and logos are matched to the product photo.
            </p>

            <label htmlFor="tryon-custom-prompt" className="mt-3 block">
              <span className="text-xs font-medium text-text-primary">
                Custom try-on instructions (optional)
              </span>
              <Textarea
                id="tryon-custom-prompt"
                value={tryOnCustomPrompt}
                onChange={(e) => setTryOnCustomPrompt(e.target.value.slice(0, 600))}
                rows={2}
                placeholder='e.g. "Also add a plain white crew-neck t-shirt; keep the listed shorts as the hero product."'
                className="mt-1 min-h-[4.5rem] text-xs"
              />
              <span className="mt-0.5 block text-[11px] text-text-muted">
                {tryOnCustomPrompt.length}/600 — only the titled product is worn unless you add
                layering notes here.
              </span>
            </label>

            <div className="mt-4">
              {fitRefreshing && !fitResult ? <FitCheckFitSkeleton /> : null}
              {fitRefreshing && fitResult ? (
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-xl bg-surface/40" />
                  <FitResultCard
                    fitLabel={fitResult.fitLabel}
                    fitConfidence={fitResult.fitConfidence}
                    reasons={fitResult.reasons}
                    warnings={fitResult.warnings}
                    recommendedSize={fitResult.recommendedSize}
                    alternateSize={fitResult.alternateSize}
                  />
                </div>
              ) : null}
              {!fitRefreshing && fitResult ? (
                <FitResultCard
                  fitLabel={fitResult.fitLabel}
                  fitConfidence={fitResult.fitConfidence}
                  reasons={fitResult.reasons}
                  warnings={fitResult.warnings}
                  recommendedSize={fitResult.recommendedSize}
                  alternateSize={fitResult.alternateSize}
                />
              ) : null}
              {!fitRefreshing && !fitResult ? (
                <p className="text-xs text-text-muted">
                  Run fit check to see your size analysis and AI try-on for this item.
                </p>
              ) : null}
            </div>

            <div className="mt-4 border-t border-border-subtle pt-4">
              <p className="text-xs font-medium text-text-primary">Try-on thread</p>
              <FitCheckThread
                turns={fitThread}
                tryOnLoading={tryOnRefreshing}
                onRegenerate={() => void runFitCheck()}
                regenerateDisabled={runInFlight || !hasMandatoryPhotos}
              />
            </div>

            {runError ? (
              <p className="mt-3 text-xs text-brand-primary" role="alert">
                {runError}
              </p>
            ) : null}

            <div className="mt-6 hidden lg:block">
              <Button
                type="button"
                onClick={() => void runFitCheck()}
                disabled={runInFlight || !hasMandatoryPhotos}
                className="w-full py-3"
              >
                {runInFlight
                  ? "Running fit check…"
                  : fitThread.length > 0
                    ? "Regenerate fit check"
                    : "Run fit check"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {product && (
        <div className="fixed inset-x-0 bottom-14 z-40 border-t border-border-subtle bg-surface/98 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md lg:hidden">
          <div className="mx-auto max-w-6xl">
            <Button
              type="button"
              onClick={() => void runFitCheck()}
              disabled={runInFlight || !hasMandatoryPhotos}
              className="w-full py-3"
            >
              {runInFlight
                ? "Running fit check…"
                : fitThread.length > 0
                  ? "Regenerate fit check"
                  : "Run fit check"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
