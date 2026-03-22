"use client";
import { Fragment, ReactNode, useMemo, useState } from "react";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import {
  formatProductTitleForDisplay,
  retailerLabelFromUrl,
} from "@/lib/text/format-product-title";
import { sanitizeAssistantMessageText } from "@/lib/text/sanitize-assistant-message";
import { cn } from "@/lib/utils";
import { ClickableImage, ImageLightbox } from "@/components/chat/ImageLightbox";
import { profileMediaImageUrl } from "@/lib/media/profile-media-image-url";

/** Strip trailing punctuation often glued to URLs in prose. */
function stripUrlTrailingJunk(url: string): string {
  return url.replace(/[.,;:!?'")\]]+$/g, "");
}

type TextOrUrl = { kind: "text"; value: string } | { kind: "url"; value: string };

/**
 * Splits `(url: https://…)` (model habit) and bare https URLs into link chips vs text.
 */
function tokenizeUrlsInText(text: string): TextOrUrl[] {
  const re =
    /\(\s*url:\s*(https?:\/\/[^)\s]+)\s*\)|(https?:\/\/[^\s<>"'[\]]+)|(www\.[^\s<>"'[\]]+)/gi;
  const out: TextOrUrl[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ kind: "text", value: text.slice(last, m.index) });
    }
    const raw = (m[1] || m[2] || m[3] || "").trim();
    const normalized = raw.startsWith("www.")
      ? `https://${raw}`
      : raw;
    out.push({ kind: "url", value: stripUrlTrailingJunk(normalized) });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push({ kind: "text", value: text.slice(last) });
  }
  return out.length > 0 ? out : [{ kind: "text", value: text }];
}

/** Short label for chip: retailer + best path slug (longest text segment). */
function shortUrlChipLabel(url: string): string {
  try {
    const u = new URL(url);
    const retailer = retailerLabelFromUrl(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const slugCandidates = parts.filter(
      (seg) => /^[a-z0-9_-]+$/i.test(seg) && seg.replace(/[-_]/g, "").length > 6,
    );
    const rawSlug =
      slugCandidates.sort((a, b) => b.length - a.length)[0] ||
      parts[parts.length - 1] ||
      "";
    const slug = rawSlug.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
    const words = slug.split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
    const compact =
      words.length > 26 ? `${words.slice(0, 24).trimEnd()}…` : words;
    if (retailer && compact) return `${retailer} · ${compact}`;
    if (retailer) return retailer;
    const host = u.hostname.replace(/^www\./, "");
    return host.length > 18 ? `${host.slice(0, 16)}…` : host;
  } catch {
    return "Link";
  }
}

function UrlChip({
  href,
  variant = "surface",
}: {
  href: string;
  variant?: "surface" | "inverse";
}) {
  const label = shortUrlChipLabel(href);
  const inverse =
    variant === "inverse"
      ? "border-white/45 bg-white/14 text-white hover:border-white/60 hover:bg-white/22 [&_span.text-brand-blue]:text-white/90"
      : "border-brand-warm/70 bg-brand-warm/15 text-text-primary hover:border-brand-accent hover:bg-brand-warm/25";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={href}
      className={cn(
        "mx-0.5 inline-flex max-w-[11rem] items-baseline gap-0.5 overflow-hidden rounded-full border px-2 py-0.5 align-baseline text-[11px] font-semibold leading-snug no-underline transition-colors",
        inverse,
      )}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden className="shrink-0 text-brand-blue">
        ↗
      </span>
    </a>
  );
}

function renderBoldItalicSegments(text: string, keyBase: string): ReactNode[] {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.filter(Boolean).flatMap((part, bi) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return [
        <strong key={`${keyBase}-b-${bi}`}>{part.slice(2, -2)}</strong>,
      ];
    }
    const italicParts = part.split(/(\*[^*\n]+\*)/g);
    return italicParts.filter(Boolean).map((seg, ii) => {
      if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
        return (
          <em key={`${keyBase}-i-${bi}-${ii}`}>{seg.slice(1, -1)}</em>
        );
      }
      return <Fragment key={`${keyBase}-t-${bi}-${ii}`}>{seg}</Fragment>;
    });
  });
}

/** Bold, italic, URL chips. */
function renderMarkdownInline(
  text: string,
  keyBase: string,
  chipVariant: "surface" | "inverse",
): ReactNode[] {
  const normalized = decodeHtmlEntities(text);
  const tokens = tokenizeUrlsInText(normalized);
  const nodes: ReactNode[] = [];
  let i = 0;
  for (const tok of tokens) {
    if (tok.kind === "url") {
      nodes.push(
        <UrlChip
          key={`${keyBase}-u-${i++}`}
          href={tok.value}
          variant={chipVariant}
        />,
      );
    } else {
      nodes.push(
        ...renderBoldItalicSegments(tok.value, `${keyBase}-m-${i++}`),
      );
    }
  }
  return nodes;
}

type BubbleTextOpts = {
  chipVariant: "surface" | "inverse";
  paragraphClass: string;
  listDiscClass: string;
  listDecimalClass: string;
};

type ProductItem = {
  id: string;
  title: string;
  brand: string;
  price: string;
  imageUrl: string;
  sourceUrl: string;
  rating?: string;
  reviewCount?: string;
  sizes?: string;
  colors?: string;
  material?: string;
  fitType?: string;
  category?: string;
  genderTarget?: string;
};

export type TryOnBubblePayload = {
  productImportId: string;
  fit: Record<string, unknown>;
  tryOnMediaIds: { front: string; back: string; zoomed: string };
  runId: string;
  /** Vision phase summary (markdown); also duplicated in message text */
  analysisSummary?: string;
};

const TRY_ON_ORDER = [
  { key: "front" as const, title: "Front" },
  { key: "back" as const, title: "Back" },
  { key: "zoomed" as const, title: "Detail" },
];

type MessageBubbleProps = {
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
  /** User message — vault / chat uploads */
  attachmentIds?: string[];
  actionButtons?: string[];
  products?: ProductItem[];
  tryOn?: TryOnBubblePayload | null;
  onActionClick?: (action: string) => void;
  /** Shop picks: start a try-on chat prefilled with this product */
  onTryOnProduct?: (product: ProductItem) => void;
  /** Disables Try on while a new session + image import is in flight */
  productTryOnBusy?: boolean;
  thinking?: {
    mode: "complex" | "normal";
    retrievalEnabled: boolean;
    retrievalQuery: string;
    importedMatches: number;
    liveMatches: number;
    finalProducts: number;
    usedCache: boolean;
    confidence: number;
    suggestedPicksRequested?: boolean;
    attachmentCount?: number;
    visionEnabled?: boolean;
  };
  showThinking?: boolean;
};

function renderFormattedBubbleText(
  text: string,
  opts: BubbleTextOpts,
  sanitizeAssistantJson = true,
): ReactNode {
  const cleaned = sanitizeAssistantJson
    ? sanitizeAssistantMessageText(text)
    : text;
  const lines = cleaned.split("\n");
  const blocks: ReactNode[] = [];
  type ListKind = "ul" | "ol";
  let listKind: ListKind | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      listKind = null;
      return;
    }
    const k = listKind ?? "ul";
    const ListTag = k === "ol" ? "ol" : "ul";
    const listClass =
      k === "ol" ? opts.listDecimalClass : opts.listDiscClass;
    blocks.push(
      <ListTag
        key={`list-${blocks.length}`}
        className={cn("space-y-1.5 pl-5 text-sm leading-relaxed", listClass)}
      >
        {listItems.map((item, idx) => (
          <li key={`${item}-${idx}`}>
            {renderMarkdownInline(
              item,
              `li-${blocks.length}-${idx}`,
              opts.chipVariant,
            )}
          </li>
        ))}
      </ListTag>,
    );
    listItems = [];
    listKind = null;
  };

  const pushListItem = (kind: ListKind, item: string) => {
    if (listKind !== kind) {
      flushList();
      listKind = kind;
    }
    listItems.push(item);
  };

  lines.forEach((raw: string, idx: number) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      pushListItem("ol", ol[1]!.trim());
      return;
    }

    if (line.startsWith("* ") || line.startsWith("- ")) {
      pushListItem("ul", line.slice(2).trim());
      return;
    }

    flushList();
    blocks.push(
      <p key={`p-${idx}`} className={opts.paragraphClass}>
        {renderMarkdownInline(line, `p-${idx}`, opts.chipVariant)}
      </p>,
    );
  });

  flushList();

  if (blocks.length === 0) {
    return (
      <p className={opts.paragraphClass}>
        {renderMarkdownInline(cleaned, "fallback", opts.chipVariant)}
      </p>
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}

function dedupeProducts(products: ProductItem[]): ProductItem[] {
  const seen = new Set<string>();
  const out: ProductItem[] = [];
  for (const p of products) {
    const key = p.sourceUrl.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function TryOnResultBlock({
  tryOn,
  onOpenImage,
}: {
  tryOn: TryOnBubblePayload;
  onOpenImage: (src: string, alt?: string) => void;
}) {
  return (
    <div className="mt-4 border-t border-brand-warm/30 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
        Generated try-on
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {TRY_ON_ORDER.map(({ key, title }) => {
          const id = tryOn.tryOnMediaIds[key];
          if (!id) return null;
          const src = profileMediaImageUrl(id, "tryOn");
          const fullSrc = profileMediaImageUrl(id, "lightbox");
          return (
            <div key={key} className="space-y-1">
              <p className="text-[10px] font-medium uppercase text-text-muted">
                {title}
              </p>
              <ClickableImage
                src={src}
                lightboxSrc={fullSrc}
                alt={`${title} try-on`}
                onOpen={onOpenImage}
                className="block w-full overflow-hidden rounded-xl ring-1 ring-border-subtle"
                imgClassName="h-36 w-full object-cover transition-transform duration-300 hover:scale-[1.02] sm:h-40"
              />
            </div>
          );
        })}
      </div>
      <a
        href={`/product/${tryOn.productImportId}`}
        className="mt-3 inline-block text-xs font-medium text-brand-blue hover:text-brand-accent"
      >
        Open product page →
      </a>
    </div>
  );
}

function ProductDetailRow({ label, value }: { label: string; value?: string }) {
  const v = value?.trim();
  if (!v) return null;
  return (
    <p className="text-[11px] leading-snug text-text-muted">
      <span className="font-semibold text-text-primary/90">{label}</span>{" "}
      {decodeHtmlEntities(v)}
    </p>
  );
}

const ASSISTANT_TEXT_OPTS: BubbleTextOpts = {
  chipVariant: "surface",
  paragraphClass: "text-sm leading-relaxed text-text-primary",
  listDiscClass: "list-disc text-text-primary marker:text-brand-blue/55",
  listDecimalClass: "list-decimal text-text-primary marker:text-brand-blue/55",
};

const USER_TEXT_OPTS: BubbleTextOpts = {
  chipVariant: "inverse",
  paragraphClass: "text-sm leading-relaxed text-white",
  listDiscClass: "list-disc text-white marker:text-white/55",
  listDecimalClass: "list-decimal text-white marker:text-white/55",
};

export function MessageBubble({
  role,
  text,
  timestamp,
  attachmentIds,
  actionButtons,
  products,
  tryOn,
  onActionClick,
  onTryOnProduct,
  productTryOnBusy,
  thinking,
  showThinking = false,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const openLightbox = (src: string, alt?: string) => {
    setLightbox({ src, alt: alt ?? "" });
  };

  const uniqueProducts = useMemo(
    () => (products?.length ? dedupeProducts(products) : []),
    [products],
  );

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
    >
      <ImageLightbox
        src={lightbox?.src ?? null}
        alt={lightbox?.alt}
        onClose={() => setLightbox(null)}
      />
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${isUser
          ? "rounded-br-md bg-brand-blue text-white"
          : "rounded-bl-md border border-brand-warm/35 bg-surface text-text-primary"
          }`}
      >
        {isUser ? (
          <div className="space-y-2">
            {attachmentIds && attachmentIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {attachmentIds.map((aid) => {
                  const src = profileMediaImageUrl(aid, "chatChip");
                  const fullSrc = profileMediaImageUrl(aid, "lightbox");
                  return (
                    <ClickableImage
                      key={aid}
                      src={src}
                      lightboxSrc={fullSrc}
                      alt="Attached photo"
                      onOpen={openLightbox}
                      className="block overflow-hidden rounded-lg ring-1 ring-white/25"
                      imgClassName="h-20 max-w-[7rem] object-cover"
                    />
                  );
                })}
              </div>
            ) : null}
            {text.trim()
              ? renderFormattedBubbleText(text, USER_TEXT_OPTS, false)
              : null}
          </div>
        ) : (
          renderFormattedBubbleText(text, ASSISTANT_TEXT_OPTS)
        )}
        {!isUser && tryOn ? (
          <TryOnResultBlock tryOn={tryOn} onOpenImage={openLightbox} />
        ) : null}
        {!isUser && showThinking && thinking && (
          <details className="mt-3 rounded-xl border border-brand-warm/40 bg-brand-warm/10 p-2.5">
            <summary className="cursor-pointer text-xs font-medium text-brand-blue">
              Thinking
            </summary>
            <div className="mt-2 space-y-1 text-[11px] text-text-muted">
              <p>Mode: {thinking.mode}</p>
              {(thinking.attachmentCount ?? 0) > 0 ? (
                <p>
                  Images: {thinking.attachmentCount} attached
                  {thinking.visionEnabled ? " (vision on)" : ""}
                </p>
              ) : null}
              <p>Cache: {thinking.usedCache ? "hit" : "miss"}</p>
              <p>
                Retrieval: {thinking.retrievalEnabled ? "on" : "off"} (
                {thinking.importedMatches} imported / {thinking.liveMatches}{" "}
                live)
              </p>
              <p>Products merged: {thinking.finalProducts}</p>
              {thinking.suggestedPicksRequested ? (
                <p>Suggested picks: catalog retrieval enabled</p>
              ) : null}
              <p>Query: {decodeHtmlEntities(thinking.retrievalQuery)}</p>
              <p>Confidence: {(thinking.confidence * 100).toFixed(0)}%</p>
            </div>
          </details>
        )}
        {!isUser && actionButtons && actionButtons.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-brand-warm/30 pt-3">
            {actionButtons.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => onActionClick?.(action)}
                className="rounded-full border border-brand-warm/50 bg-brand-warm/15 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-brand-warm/25"
              >
                {action}
              </button>
            ))}
          </div>
        )}
        {!isUser && uniqueProducts.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-brand-warm/30 pt-4">
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-brand-warm/60 to-transparent" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue">
                Product details (from site)
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-brand-warm/60 to-transparent" />
            </div>
            <div className="space-y-4">
              {uniqueProducts.map((product) => {
                const retailer = retailerLabelFromUrl(product.sourceUrl);
                const displayTitle = formatProductTitleForDisplay(product.title);
                const ratingLine =
                  [product.rating, product.reviewCount]
                    .filter(Boolean)
                    .join(product.rating && product.reviewCount ? " · " : "") ||
                  undefined;

                return (
                  <div
                    key={product.sourceUrl}
                    className="flex gap-3 rounded-[14px] border border-border-subtle bg-gradient-to-b from-surface-muted/80 to-surface p-3 shadow-sm ring-1 ring-border-subtle/80"
                  >
                    <div className="relative shrink-0">
                      {product.imageUrl ? (
                        <ClickableImage
                          src={product.imageUrl}
                          alt={decodeHtmlEntities(displayTitle)}
                          onOpen={openLightbox}
                          className="block h-28 w-28 overflow-hidden rounded-xl ring-1 ring-border-subtle sm:h-32 sm:w-32"
                          imgClassName="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-border-subtle bg-surface text-[10px] text-text-muted sm:h-32 sm:w-32">
                          No photo
                        </div>
                      )}
                      {retailer ? (
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                          {retailer}
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p
                        className="text-[13px] font-semibold leading-snug text-text-primary"
                        title={decodeHtmlEntities(product.title)}
                      >
                        {displayTitle}
                      </p>
                      <ProductDetailRow label="Brand" value={product.brand} />
                      <ProductDetailRow label="Price" value={product.price} />
                      <ProductDetailRow label="Rating" value={ratingLine} />
                      <ProductDetailRow label="Sizes" value={product.sizes} />
                      <ProductDetailRow label="Colors" value={product.colors} />
                      <ProductDetailRow label="Material" value={product.material} />
                      <ProductDetailRow label="Fit" value={product.fitType} />
                      <ProductDetailRow label="Category" value={product.category} />
                      <ProductDetailRow
                        label="Section"
                        value={product.genderTarget}
                      />
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <UrlChip href={product.sourceUrl} variant="surface" />
                        <a
                          href={product.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-medium text-brand-blue hover:text-brand-accent"
                        >
                          Open product page ↗
                        </a>
                      </div>
                      {onTryOnProduct ? (
                        <button
                          type="button"
                          disabled={productTryOnBusy}
                          onClick={() => onTryOnProduct(product)}
                          className="mt-1 w-full max-w-[14rem] rounded-lg border border-brand-warm/50 bg-brand-warm/15 py-2 text-center text-[11px] font-semibold text-text-primary transition-colors hover:bg-brand-warm/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {productTryOnBusy ? "Preparing…" : "Try on"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {timestamp && (
          <p
            className={`mt-2 text-[10px] ${isUser ? "text-white/75" : "text-text-muted"
              }`}
          >
            {timestamp}
          </p>
        )}
      </div>
    </div>
  );
}
