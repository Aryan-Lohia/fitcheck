"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hooks/use-api";

const MAX_ATTACHMENTS = 6;

type VaultMedia = {
  id: string;
  mimeType: string;
  fileName: string;
};

export type ChatSendPayload = {
  text: string;
  attachmentIds: string[];
};

type ChatInputProps = {
  onSend: (payload: ChatSendPayload) => void;
  disabled?: boolean;
  complex?: boolean;
  onComplexChange?: (value: boolean) => void;
  /** When true, next message runs live catalog retrieval and shows suggested picks */
  suggestedPicks?: boolean;
  onSuggestedPicksChange?: (value: boolean) => void;
  /** When true, composer sits in document flow (split chat layout) instead of fixed to the viewport */
  dock?: boolean;
};

export function ChatInput({
  onSend,
  disabled,
  complex = false,
  onComplexChange,
  suggestedPicks = false,
  onSuggestedPicksChange,
  dock = false,
}: ChatInputProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const toggleVaultId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_ATTACHMENTS) return prev;
      return [...prev, id];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const uploadFromDevice = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(true);
      try {
        const presignRes = await fetch("/api/profile/media/presign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            category: "photos",
          }),
        });
        if (!presignRes.ok) {
          const body = await presignRes.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to get upload URL");
        }
        const { uploadUrl, mediaId } = (await presignRes.json()) as {
          uploadUrl: string;
          mediaId: string;
        };

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload to storage failed");

        const confirmRes = await fetch("/api/profile/media/confirm-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId }),
        });
        if (!confirmRes.ok) throw new Error("Upload confirmation failed");

        setSelectedIds((prev) => {
          if (prev.includes(mediaId)) return prev;
          if (prev.length >= MAX_ATTACHMENTS) return prev;
          return [...prev, mediaId];
        });
        await queryClient.invalidateQueries({ queryKey: ["media"] });
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [queryClient],
  );

  const handleSend = () => {
    const trimmed = value.trim();
    if ((!trimmed && selectedIds.length === 0) || disabled) return;
    onSend({ text: trimmed, attachmentIds: selectedIds });
    setValue("");
    setSelectedIds([]);
    setVaultOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend =
    (value.trim().length > 0 || selectedIds.length > 0) && !disabled;

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onSuggestedPicksChange?.(!suggestedPicks)}
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${suggestedPicks
                ? "border-brand-blue/40 bg-brand-blue/10 text-brand-blue"
                : "border-border-subtle bg-surface text-text-muted hover:bg-surface-muted"
                }`}
              aria-pressed={suggestedPicks}
              title="Always fetch live catalog items for this chat turn"
            >
              <span
                className={`h-2 w-2 rounded-full ${suggestedPicks ? "bg-brand-blue" : "bg-border-subtle"
                  }`}
              />
              Suggested picks
            </button>
            <button
              type="button"
              onClick={() => onComplexChange?.(!complex)}
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${complex
                ? "border-brand-warm/60 bg-brand-warm/25 text-text-primary"
                : "border-border-subtle bg-surface text-text-muted hover:bg-surface-muted"
                }`}
              aria-pressed={complex}
            >
              <span
                className={`h-2 w-2 rounded-full ${complex ? "bg-brand-accent" : "bg-border-subtle"
                  }`}
              />
              Complex
            </button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {selectedIds.map((aid) => (
              <div
                key={aid}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-brand-warm/40 bg-surface-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/profile/media/${aid}/view`}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(aid)}
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
                Vault — tap to add (max {MAX_ATTACHMENTS})
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
                    !on && selectedIds.length >= MAX_ATTACHMENTS;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabledPick}
                      onClick={() => toggleVaultId(item.id)}
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${on
                        ? "border-brand-accent ring-2 ring-brand-warm/50"
                        : "border-transparent opacity-90 hover:opacity-100"
                        } ${disabledPick ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/profile/media/${item.id}/view`}
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
              <button
                type="button"
                disabled={uploading || selectedIds.length >= MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-border-subtle py-2 text-xs font-medium text-text-muted hover:bg-surface-muted disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Upload new photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadFromDevice(f);
                }}
              />
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
              <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              resize();
            }}
            onKeyDown={handleKeyDown}
            placeholder="How can I help you today?"
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-warm/50 focus:bg-brand-warm/10 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
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
      </div>
    </div>
  );
}
