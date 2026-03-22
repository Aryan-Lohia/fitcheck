"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type ImageLightboxProps = {
  src: string | null;
  alt?: string;
  onClose: () => void;
};

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  if (!mounted || !src) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-[1] rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-sm font-medium text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/22"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        Close
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? "Enlarged attachment"}
        className="max-h-[min(92vh,920px)] max-w-full cursor-default rounded-xl object-contain shadow-2xl ring-1 ring-white/15"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

type ClickableImageProps = {
  src: string;
  /** Larger URL for modal (defaults to `src`). */
  lightboxSrc?: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  onOpen: (src: string, alt?: string) => void;
};

export function ClickableImage({
  src,
  lightboxSrc,
  alt = "",
  className,
  imgClassName,
  onOpen,
}: ClickableImageProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(lightboxSrc ?? src, alt)}
      className={cn(
        "m-0 inline-block cursor-zoom-in border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/50",
        className,
      )}
      aria-label="View larger image"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={imgClassName}
      />
    </button>
  );
}
