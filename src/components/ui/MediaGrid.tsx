"use client";

import { useState } from "react";

interface MediaItem {
  id: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  /** When set, grid shows a thumbnail via the authenticated /view route */
  mimeType?: string;
}

function isDisplayableImageMime(mimeType: string | undefined, fileName: string): boolean {
  if (mimeType && mimeType.startsWith("image/")) return true;
  const ext = fileName.split(".").pop()?.toLowerCase();
  return (
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "png" ||
    ext === "gif" ||
    ext === "webp" ||
    ext === "avif"
  );
}

interface MediaGridProps {
  items: MediaItem[];
  onDelete?: (ids: string[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MediaGrid({ items, onDelete }: MediaGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewLoadState, setPreviewLoadState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  const multiSelect = selected.size > 0;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  function openPreview(item: MediaItem) {
    setPreviewId(item.id);
    setPreviewLoadState("loading");
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-text-muted">
        <svg className="mb-2 h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">No media uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {onDelete && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-brand-blue hover:underline"
          >
            {selected.size === items.length ? "Deselect all" : "Select all"}
          </button>
          {multiSelect && (
            <button
              type="button"
              onClick={() => {
                onDelete(Array.from(selected));
                setSelected(new Set());
              }}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white
                         transition-colors hover:bg-brand-primary/90"
            >
              Delete selected ({selected.size})
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          const showImageThumb = isDisplayableImageMime(item.mimeType, item.fileName);
          const thumbSrc = `/api/profile/media/${item.id}/view`;
          return (
            <div
              key={item.id}
              className={`group relative overflow-hidden rounded-xl border bg-surface shadow-sm
                         transition-all ${isSelected
                  ? "border-brand-blue ring-2 ring-brand-blue/25"
                  : "border-border-subtle hover:shadow-md"
                }`}
            >
              {/* Checkbox overlay */}
              {onDelete && (
                <label className="absolute left-2 top-2 z-10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    className="h-4 w-4 rounded border-border-subtle accent-brand-blue"
                  />
                </label>
              )}

              {/* Thumbnail */}
              <button
                type="button"
                onClick={() => openPreview(item)}
                className="block aspect-square w-full bg-surface-muted"
              >
                {showImageThumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumbSrc}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-muted/50">
                    <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
              </button>

              {/* Info */}
              <div className="p-2">
                <p className="truncate text-xs font-medium text-text-primary">
                  {item.fileName}
                </p>
                <p className="mt-0.5 text-[10px] text-text-muted">
                  {formatSize(item.fileSize)} &middot; {formatDate(item.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      {previewId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            setPreviewId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setPreviewId(null);
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex min-h-[16rem] min-w-[12rem] max-h-[80vh] max-w-lg flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {previewLoadState === "loading" && (
              <div className="absolute inset-0 z-[1] flex items-center justify-center bg-surface">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
              </div>
            )}
            {previewLoadState === "error" && (
              <div className="flex h-64 min-w-[16rem] flex-1 items-center justify-center px-6 text-center text-sm text-text-muted">
                Unable to load preview
              </div>
            )}
            {previewId && previewLoadState !== "error" && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={previewId}
                src={`/api/profile/media/${previewId}/view`}
                alt={items.find((i) => i.id === previewId)?.fileName ?? ""}
                className={`max-h-[70vh] w-full object-contain transition-opacity duration-150 ${previewLoadState === "loaded" ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setPreviewLoadState("loaded")}
                onError={() => setPreviewLoadState("error")}
              />
            )}
            <button
              type="button"
              onClick={() => {
                setPreviewId(null);
              }}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-white
                         transition-colors hover:bg-black/60"
              aria-label="Close preview"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
