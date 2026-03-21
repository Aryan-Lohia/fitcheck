"use client";
import { Fragment, ReactNode, useMemo } from "react";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import {
  formatProductTitleForDisplay,
  retailerLabelFromUrl,
} from "@/lib/text/format-product-title";
import { sanitizeAssistantMessageText } from "@/lib/text/sanitize-assistant-message";

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
    /\(\s*url:\s*(https?:\/\/[^)\s]+)\s*\)|(https?:\/\/[^\s<>"'[\]]+)/gi;
  const out: TextOrUrl[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ kind: "text", value: text.slice(last, m.index) });
    }
    const raw = (m[1] || m[2] || "").trim();
    out.push({ kind: "url", value: stripUrlTrailingJunk(raw) });
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

function UrlChip({ href }: { href: string }) {
  const label = shortUrlChipLabel(href);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={href}
      className="mx-0.5 inline-flex max-w-[11rem] items-baseline gap-0.5 overflow-hidden rounded-full border border-brand-warm/70 bg-brand-warm/15 px-2 py-0.5 align-baseline text-[11px] font-semibold leading-snug text-text-primary no-underline transition-colors hover:border-brand-accent hover:bg-brand-warm/25"
    >
      <span className="truncate">{label}</span>
      <span aria-hidden className="shrink-0 text-brand-blue">
        ↗
      </span>
    </a>
  );
}

function renderBoldSegments(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter(Boolean)
    .map((part, idx) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${keyBase}-b-${idx}`}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={`${keyBase}-t-${idx}`}>{part}</Fragment>
      ),
    );
}

/** Bold + URL chips (assistant body). */
function renderInlineRich(text: string, keyBase: string): ReactNode[] {
  const normalized = decodeHtmlEntities(text);
  const tokens = tokenizeUrlsInText(normalized);
  const nodes: ReactNode[] = [];
  let i = 0;
  for (const tok of tokens) {
    if (tok.kind === "url") {
      nodes.push(<UrlChip key={`${keyBase}-u-${i++}`} href={tok.value} />);
    } else {
      nodes.push(...renderBoldSegments(tok.value, `${keyBase}-${i++}`));
    }
  }
  return nodes;
}

type ProductItem = {
  id: string;
  title: string;
  brand: string;
  price: string;
  imageUrl: string;
  sourceUrl: string;
};

type MessageBubbleProps = {
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
  /** User message — vault / chat uploads */
  attachmentIds?: string[];
  actionButtons?: string[];
  products?: ProductItem[];
  onActionClick?: (action: string) => void;
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

function renderAssistantText(text: string): ReactNode {
  const cleaned = sanitizeAssistantMessageText(text);
  const lines = cleaned.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul
        key={`list-${blocks.length}`}
        className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-text-primary"
      >
        {listItems.map((item, idx) => (
          <li key={`${item}-${idx}`}>
            {renderInlineRich(item, `li-${blocks.length}-${idx}`)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((raw: string, idx: number) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }

    if (line.startsWith("* ") || line.startsWith("- ")) {
      listItems.push(line.slice(2).trim());
      return;
    }

    flushList();
    blocks.push(
      <p key={`p-${idx}`} className="text-sm leading-relaxed text-text-primary">
        {renderInlineRich(line, `p-${idx}`)}
      </p>,
    );
  });

  flushList();

  if (blocks.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-text-primary">
        {renderInlineRich(cleaned, "fallback")}
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

export function MessageBubble({
  role,
  text,
  timestamp,
  attachmentIds,
  actionButtons,
  products,
  onActionClick,
  thinking,
  showThinking = false,
}: MessageBubbleProps) {
  const isUser = role === "user";

  const uniqueProducts = useMemo(
    () => (products?.length ? dedupeProducts(products) : []),
    [products],
  );

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
    >
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
                {attachmentIds.map((aid) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={aid}
                    src={`/api/profile/media/${aid}/view`}
                    alt=""
                    className="h-20 max-w-[7rem] rounded-lg object-cover ring-1 ring-white/20"
                  />
                ))}
              </div>
            ) : null}
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
          </div>
        ) : (
          renderAssistantText(text)
        )}
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
                <p>Suggested picks: forced ON (user toggle)</p>
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
          <div className="mt-4 border-t border-brand-warm/30 pt-3">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-brand-warm/60 to-transparent" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Suggested picks
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-brand-warm/60 to-transparent" />
            </div>
            <div className="-mx-0.5 flex gap-3 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
              {uniqueProducts.map((product) => {
                const retailer = retailerLabelFromUrl(product.sourceUrl);
                const displayTitle = formatProductTitleForDisplay(product.title);

                return (
                  <a
                    key={product.sourceUrl}
                    href={product.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group w-[11.25rem] shrink-0 overflow-hidden rounded-[14px] border border-border-subtle bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-border-subtle transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-warm/50"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-surface-muted to-surface">
                      {!product.imageUrl ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-text-muted">
                          No image
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      )}
                      {retailer && (
                        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
                          {retailer}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 px-2.5 pb-2.5 pt-2">
                      <p
                        className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-text-primary"
                        title={decodeHtmlEntities(product.title)}
                      >
                        {displayTitle}
                      </p>
                      {product.brand && (
                        <p className="truncate text-[11px] text-text-muted">
                          {decodeHtmlEntities(product.brand)}
                        </p>
                      )}
                      {product.price && (
                        <p className="text-[13px] font-semibold tabular-nums text-brand-accent">
                          {decodeHtmlEntities(product.price)}
                        </p>
                      )}
                      <p className="text-[11px] font-medium text-brand-blue group-hover:text-brand-accent">
                        View on {retailer || "store"} →
                      </p>
                    </div>
                  </a>
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
