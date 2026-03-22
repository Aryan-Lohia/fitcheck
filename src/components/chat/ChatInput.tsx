"use client";

import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/lib/chat/mode";
import { CHAT_MODE_SHOP, CHAT_MODE_TRYON } from "@/lib/chat/mode";
import { uploadUserMediaPhoto } from "@/lib/media/client-upload-photo";
import { profileMediaImageUrl } from "@/lib/media/profile-media-image-url";

const MAX_SHOP_ATTACHMENTS = 6;
const TRY_ON_MODEL_MAX = 2;

type VaultMedia = {
  id: string;
  mimeType: string;
  fileName: string;
};

export type ChatSendPayload = {
  text: string;
  attachmentIds: string[];
};

export type TryOnSendPayload = {
  prompt: string;
  productUrl?: string;
  productImageMediaId?: string;
  modelMediaIds: string[];
};

type TryOnVaultTarget = "product" | "modelIdx";

type ChatInputProps = {
  chatMode: ChatMode;
  modeLocked: boolean;
  onChatModeChange: (mode: ChatMode) => void;
  onSendShop: (payload: ChatSendPayload, detailedAnalysis: boolean) => void;
  onSendTryOn: (payload: TryOnSendPayload) => void;
  disabled?: boolean;
  dock?: boolean;
  /** One-shot product URL when opening a try-on chat from a recommendation */
  prefillProductUrl?: string | null;
  /** One-shot vault image id after server-importing a shop product thumbnail */
  prefillProductImageMediaId?: string | null;
  prefillProductTitle?: string | null;
  onPrefillConsumed?: () => void;
};

function ModelPhotoThumb({
  label,
  mediaId,
  onOpenVault,
  onClear,
  disabled,
  compact,
}: {
  label: string;
  mediaId: string | null;
  onOpenVault: () => void;
  onClear: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", compact && "max-w-[4.25rem]")}>
      <div className="flex items-center justify-between gap-0.5">
        <span
          className={cn(
            "font-semibold uppercase tracking-wide text-text-muted",
            compact ? "text-[9px] leading-tight" : "text-[10px]",
          )}
        >
          {label}
        </span>
        {mediaId ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[9px] text-brand-primary hover:underline"
          >
            ×
          </button>
        ) : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onOpenVault}
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors",
          compact
            ? "h-12 w-12"
            : "aspect-square w-full rounded-xl",
          mediaId
            ? "border-brand-warm/50 bg-surface-muted"
            : "border-border-subtle bg-surface hover:border-brand-blue/40",
          disabled && "opacity-50",
        )}
      >
        {mediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profileMediaImageUrl(mediaId, "thumb")}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className={cn(
              "text-center text-text-muted",
              compact ? "px-0.5 text-[8px] leading-tight" : "px-1 text-[10px]",
            )}
          >
            +{compact ? "" : " add"}
          </span>
        )}
      </button>
    </div>
  );
}

export function ChatInput({
  chatMode,
  modeLocked,
  onChatModeChange,
  onSendShop,
  onSendTryOn,
  disabled,
  dock = false,
  prefillProductUrl,
  prefillProductImageMediaId,
  prefillProductTitle,
  onPrefillConsumed,
}: ChatInputProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detailedAnalysis, setDetailedAnalysis] = useState(false);

  const [productUrl, setProductUrl] = useState("");
  const [tryOnProductImageId, setTryOnProductImageId] = useState<string | null>(
    null,
  );
  /** Exactly one of link vs photo is active — toggled with the switch, never both. */
  const [tryOnProductKind, setTryOnProductKind] = useState<"link" | "photo">(
    "link",
  );
  const [tryOnPrompt, setTryOnPrompt] = useState("");
  const [modelSlot, setModelSlot] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [tryOnVaultSlot, setTryOnVaultSlot] = useState<TryOnVaultTarget | null>(
    null,
  );
  const [modelPickIndex, setModelPickIndex] = useState<0 | 1>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tryOnProductUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefillProductImageMediaId?.trim()) {
      setTryOnProductKind("photo");
      setTryOnProductImageId(prefillProductImageMediaId.trim());
      setProductUrl("");
      const t = prefillProductTitle?.trim();
      if (t) {
        setTryOnPrompt((prev) => (prev.trim() ? prev : t));
      }
      onPrefillConsumed?.();
      return;
    }
    if (prefillProductUrl?.trim()) {
      setTryOnProductKind("link");
      setProductUrl(prefillProductUrl.trim());
      setTryOnProductImageId(null);
      onPrefillConsumed?.();
    }
  }, [
    prefillProductImageMediaId,
    prefillProductTitle,
    prefillProductUrl,
    onPrefillConsumed,
  ]);

  const { data: vaultData } = useQuery({
    queryKey: ["media", "chat-picker"],
    queryFn: () => api<{ media: VaultMedia[] }>("/api/profile/media"),
  });

  const imageVaultItems = useMemo(
    () =>
      (vaultData?.media ?? []).filter((m) => m.mimeType.startsWith("image/")),
    [vaultData],
  );

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const toggleShopVaultId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SHOP_ATTACHMENTS) return prev;
      return [...prev, id];
    });
  }, []);

  const removeShopAttachment = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const uploadFromDevice = useCallback(
    async (
      file: File,
      slot: "shop" | "product" | `model-${0 | 1}`,
    ) => {
      setUploadError(null);
      setUploading(true);
      try {
        const { mediaId } = await uploadUserMediaPhoto(file, {
          category: "photos",
        });

        if (slot === "shop") {
          setSelectedIds((prev) => {
            if (prev.includes(mediaId)) return prev;
            if (prev.length >= MAX_SHOP_ATTACHMENTS) return prev;
            return [...prev, mediaId];
          });
        } else if (slot === "product") {
          setTryOnProductImageId(mediaId);
          setProductUrl("");
        } else if (slot === "model-0") {
          setModelSlot(([_, b]) => [mediaId, b]);
        } else if (slot === "model-1") {
          setModelSlot(([a, _]) => [a, mediaId]);
        }
        await queryClient.invalidateQueries({ queryKey: ["media"] });
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [queryClient],
  );

  const pickTryOnVault = useCallback(
    (mediaId: string) => {
      if (tryOnVaultSlot === "product") {
        setTryOnProductImageId(mediaId);
        setProductUrl("");
      } else if (tryOnVaultSlot === "modelIdx") {
        setModelSlot((prev) => {
          const next: [string | null, string | null] = [...prev];
          next[modelPickIndex] = mediaId;
          return next;
        });
      }
      setTryOnVaultSlot(null);
    },
    [tryOnVaultSlot, modelPickIndex],
  );

  const handleSendShop = () => {
    const trimmed = value.trim();
    if ((!trimmed && selectedIds.length === 0) || disabled) return;
    onSendShop({ text: trimmed, attachmentIds: selectedIds }, detailedAnalysis);
    setValue("");
    setSelectedIds([]);
    setVaultOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleSendTryOn = () => {
    const url = tryOnProductKind === "link" ? productUrl.trim() : "";
    const hasUrl = url.length > 0;
    const hasImg =
      tryOnProductKind === "photo" && Boolean(tryOnProductImageId);
    if (disabled || (!hasUrl && !hasImg) || (hasUrl && hasImg)) {
      return;
    }
    const models = modelSlot.filter((x): x is string => Boolean(x));
    if (models.length < 1) return;

    onSendTryOn({
      prompt: tryOnPrompt.trim(),
      productUrl: hasUrl ? url : undefined,
      productImageMediaId: hasImg ? tryOnProductImageId! : undefined,
      modelMediaIds: models.slice(0, TRY_ON_MODEL_MAX),
    });
    setProductUrl("");
    setTryOnProductImageId(null);
    setTryOnPrompt("");
    setModelSlot([null, null]);
    setTryOnVaultSlot(null);
  };

  const handleKeyDownShop = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendShop();
    }
  };

  const canSendShop =
    (value.trim().length > 0 || selectedIds.length > 0) && !disabled;

  const hasProductUrl =
    tryOnProductKind === "link" && productUrl.trim().length > 0;
  const hasProductImg =
    tryOnProductKind === "photo" && Boolean(tryOnProductImageId);
  const productSourceOk = hasProductUrl || hasProductImg;
  const modelIds = modelSlot.filter((x): x is string => Boolean(x));
  const canSendTryOn =
    productSourceOk &&
    modelIds.length >= 1 &&
    modelIds.length <= TRY_ON_MODEL_MAX &&
    !disabled;

  const tryOnVaultOpen = tryOnVaultSlot !== null;

  return (
    <div
      className={
        dock
          ? "relative z-30 w-full border-t border-brand-warm/30 bg-surface-muted/95 px-3 py-3 backdrop-blur"
          : "fixed inset-x-0 bottom-14 z-40 border-t border-brand-warm/30 bg-surface-muted/95 px-3 py-3 backdrop-blur md:bottom-0"
      }
    >
      <div className={dock ? "mx-auto w-full max-w-3xl" : "mx-auto max-w-3xl"}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-xs text-text-muted">FitCheck Assistant</p>
          {!modeLocked ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onChatModeChange(CHAT_MODE_SHOP)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  chatMode === CHAT_MODE_SHOP
                    ? "border-brand-blue/40 bg-brand-blue/10 text-brand-blue"
                    : "border-border-subtle bg-surface text-text-muted hover:bg-surface-muted",
                )}
                aria-pressed={chatMode === CHAT_MODE_SHOP}
              >
                Shop
              </button>
              <button
                type="button"
                onClick={() => onChatModeChange(CHAT_MODE_TRYON)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  chatMode === CHAT_MODE_TRYON
                    ? "border-brand-blue/40 bg-brand-blue/10 text-brand-blue"
                    : "border-border-subtle bg-surface text-text-muted hover:bg-surface-muted",
                )}
                aria-pressed={chatMode === CHAT_MODE_TRYON}
              >
                Try-on
              </button>
              {chatMode === CHAT_MODE_SHOP ? (
                <button
                  type="button"
                  onClick={() => setDetailedAnalysis((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    detailedAnalysis
                      ? "border-brand-warm/60 bg-brand-warm/25 text-text-primary"
                      : "border-border-subtle bg-surface text-text-muted hover:bg-surface-muted",
                  )}
                  aria-pressed={detailedAnalysis}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      detailedAnalysis ? "bg-brand-accent" : "bg-border-subtle",
                    )}
                  />
                  Detailed
                </button>
              ) : null}
            </div>
          ) : (
            <span className="rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-text-muted">
              {chatMode === CHAT_MODE_TRYON ? "Try-on chat" : "Shop chat"}
            </span>
          )}
        </div>

        {chatMode === CHAT_MODE_SHOP ? (
          <>
            {selectedIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 px-1">
                {selectedIds.map((aid) => (
                  <div
                    key={aid}
                    className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-brand-warm/40 bg-surface-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profileMediaImageUrl(aid, "thumb")}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeShopAttachment(aid)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-[10px] text-white"
                      aria-label="Remove attachment"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {vaultOpen && (
              <div className="mb-2 max-h-48 overflow-y-auto rounded-xl border border-brand-warm/30 bg-surface p-2 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-text-primary">
                    Vault — tap to add (max {MAX_SHOP_ATTACHMENTS})
                  </p>
                  <button
                    type="button"
                    onClick={() => setVaultOpen(false)}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Close
                  </button>
                </div>
                {imageVaultItems.length === 0 ? (
                  <p className="py-4 text-center text-xs text-text-muted">
                    No photos in vault yet. Upload below.
                  </p>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
                    {imageVaultItems.map((item) => {
                      const on = selectedIds.includes(item.id);
                      const disabledPick =
                        !on && selectedIds.length >= MAX_SHOP_ATTACHMENTS;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={disabledPick}
                          onClick={() => toggleShopVaultId(item.id)}
                          className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${on
                            ? "border-brand-accent ring-2 ring-brand-warm/50"
                            : "border-transparent opacity-90 hover:opacity-100"
                            } ${disabledPick ? "cursor-not-allowed opacity-40" : ""}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={profileMediaImageUrl(item.id, "thumb")}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          {on ? (
                            <span className="absolute bottom-0.5 right-0.5 rounded bg-brand-blue px-1 text-[9px] font-bold text-white">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-2 border-t border-border-subtle pt-2">
                  {/*
                    iOS Safari blocks programmatic .click() on file inputs with display:none.
                    Overlay a real file input on the label so the tap is a direct user gesture.
                  */}
                  <label
                    className={cn(
                      "relative flex min-h-11 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-subtle py-2 text-xs font-medium text-text-muted hover:bg-surface-muted",
                      (uploading ||
                        selectedIds.length >= MAX_SHOP_ATTACHMENTS) &&
                      "pointer-events-none cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="pointer-events-none select-none">
                      {uploading ? "Uploading…" : "Upload new photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                      className="absolute inset-0 z-10 block h-full w-full min-h-11 cursor-pointer opacity-0"
                      disabled={
                        uploading ||
                        selectedIds.length >= MAX_SHOP_ATTACHMENTS
                      }
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void uploadFromDevice(f, "shop");
                      }}
                    />
                  </label>
                  {uploadError ? (
                    <p className="mt-1 text-center text-[11px] text-brand-primary">
                      {uploadError}
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-brand-warm/30 bg-surface/90 p-2 shadow-sm">
              <button
                type="button"
                onClick={() => setVaultOpen((o) => !o)}
                disabled={disabled}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${vaultOpen
                  ? "border-brand-accent bg-brand-warm/20 text-text-primary"
                  : "border-border-subtle bg-surface text-text-muted hover:bg-surface-muted"
                  }`}
                aria-label="Add photos from vault or upload"
                title="Vault & upload"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  resize();
                }}
                onKeyDown={handleKeyDownShop}
                placeholder="How can I help you today?"
                rows={1}
                disabled={disabled}
                className="flex-1 resize-none rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-warm/50 focus:bg-brand-warm/10 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSendShop}
                disabled={!canSendShop}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent text-white transition-all hover:-translate-y-0.5 hover:bg-brand-accent/90 disabled:opacity-40"
                aria-label="Send message"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95l14.095-5.637a.75.75 0 0 0 0-1.4L3.105 2.289Z" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 px-1 text-[11px] text-text-muted">
              Use the switch for{" "}
              <span className="font-medium text-text-primary">link</span> or{" "}
              <span className="font-medium text-text-primary">photo</span>. Then add
              1–2 model photos and optional notes.
            </p>

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-muted/80 px-2.5 py-2">
              <div
                className="flex rounded-lg border border-border-subtle bg-surface p-0.5 shadow-sm"
                role="group"
                aria-label="Product source"
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setTryOnProductKind("link");
                    setTryOnProductImageId(null);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    tryOnProductKind === "link"
                      ? "bg-brand-blue/15 text-brand-blue shadow-sm"
                      : "text-text-muted hover:text-text-primary",
                  )}
                >
                  Link
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setTryOnProductKind("photo");
                    setProductUrl("");
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    tryOnProductKind === "photo"
                      ? "bg-brand-blue/15 text-brand-blue shadow-sm"
                      : "text-text-muted hover:text-text-primary",
                  )}
                >
                  Photo
                </button>
              </div>
              {tryOnProductKind === "link" ? (
                <div className="mb-2 w-full">
                  <input
                    ref={tryOnProductUrlRef}
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    disabled={disabled}
                    placeholder="Product page URL (https://…)"
                    className="w-full rounded-xl border border-brand-warm/30 bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-accent disabled:opacity-50"
                  />
                </div>
              ) : (
                <div className="mb-2 flex max-w-[5.5rem] flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase text-text-muted">
                    Product photo
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setTryOnVaultSlot("product")}
                    className={cn(
                      "flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border-subtle bg-surface transition-colors hover:border-brand-blue/40",
                      tryOnProductImageId && "border-brand-warm/50",
                    )}
                  >
                    {tryOnProductImageId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profileMediaImageUrl(tryOnProductImageId, "thumb")}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="px-1 text-center text-[9px] text-text-muted">
                        Choose
                      </span>
                    )}
                  </button>
                  {tryOnProductImageId ? (
                    <button
                      type="button"
                      onClick={() => setTryOnProductImageId(null)}
                      className="text-left text-[10px] text-brand-primary hover:underline"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              )}

            </div>


            <p className="mb-1 px-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Model photos (1–2)
            </p>
            <div className="mb-2 flex max-w-[9.5rem] flex-wrap items-start gap-2 px-0.5">
              <ModelPhotoThumb
                label="1"
                compact
                mediaId={modelSlot[0]}
                disabled={disabled}
                onOpenVault={() => {
                  setModelPickIndex(0);
                  setTryOnVaultSlot("modelIdx");
                }}
                onClear={() => setModelSlot(([, b]) => [null, b])}
              />
              <ModelPhotoThumb
                label="2 opt"
                compact
                mediaId={modelSlot[1]}
                disabled={disabled}
                onOpenVault={() => {
                  setModelPickIndex(1);
                  setTryOnVaultSlot("modelIdx");
                }}
                onClear={() => setModelSlot(([a]) => [a, null])}
              />
            </div>
            {tryOnVaultOpen && (
              <div className="mb-2 max-h-48 overflow-y-auto rounded-xl border border-brand-warm/30 bg-surface p-2 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-text-primary">
                    {tryOnVaultSlot === "product"
                      ? "Product photo"
                      : `Model photo ${modelPickIndex + 1}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTryOnVaultSlot(null)}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Close
                  </button>
                </div>
                {imageVaultItems.length === 0 ? (
                  <p className="py-4 text-center text-xs text-text-muted">
                    No photos in vault yet. Upload below.
                  </p>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
                    {imageVaultItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => pickTryOnVault(item.id)}
                        className="relative aspect-square overflow-hidden rounded-lg border-2 border-transparent opacity-90 transition-colors hover:border-brand-accent hover:opacity-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profileMediaImageUrl(item.id, "thumb")}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 border-t border-border-subtle pt-2">
                  <label
                    className={cn(
                      "relative flex min-h-11 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-subtle py-2 text-xs font-medium text-text-muted hover:bg-surface-muted",
                      uploading && "pointer-events-none cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="pointer-events-none select-none">
                      {uploading ? "Uploading…" : "Upload to this slot"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                      className="absolute inset-0 z-10 block h-full w-full min-h-11 cursor-pointer opacity-0"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f || !tryOnVaultSlot) return;
                        const slot =
                          tryOnVaultSlot === "product"
                            ? "product"
                            : modelPickIndex === 0
                              ? "model-0"
                              : "model-1";
                        void uploadFromDevice(f, slot);
                      }}
                    />
                  </label>
                  {uploadError ? (
                    <p className="mt-1 text-center text-[11px] text-brand-primary">
                      {uploadError}
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            <textarea
              value={tryOnPrompt}
              onChange={(e) => setTryOnPrompt(e.target.value)}
              disabled={disabled}
              placeholder="Optional prompt — styling notes or context"
              rows={2}
              className="mb-2 w-full resize-none rounded-xl border border-brand-warm/30 bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-accent disabled:opacity-50"
            />


            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSendTryOn}
                disabled={!canSendTryOn}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 text-sm font-medium text-white transition-all hover:bg-brand-accent/90 disabled:opacity-40"
              >
                Run try-on
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
