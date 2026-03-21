"use client";

import { useCallback, useRef, useState } from "react";

interface FileUploaderProps {
  onUploadComplete: () => void;
  category?: string;
}

export function FileUploader({
  onUploadComplete,
  category = "photos",
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const presignRes = await fetch("/api/profile/media/presign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            category,
          }),
        });
        if (!presignRes.ok) {
          const body = await presignRes.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to get upload URL");
        }
        const { uploadUrl, mediaId } = await presignRes.json();

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload to storage failed");

        const confirmRes = await fetch(
          "/api/profile/media/confirm-upload",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaId }),
          },
        );
        if (!confirmRes.ok) throw new Error("Upload confirmation failed");

        onUploadComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [category, onUploadComplete],
  );

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) upload(file);
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed
                    p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40 ${dragging
            ? "border-brand-blue bg-brand-blue/8"
            : "border-border-subtle hover:border-brand-blue/40"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        {uploading ? (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
        ) : (
          <svg
            className="h-8 w-8 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
            />
          </svg>
        )}
        <p className="text-sm text-text-muted">
          {uploading
            ? "Uploading…"
            : "Drag & drop or click to upload"}
        </p>
        <p className="text-xs text-text-muted/90">JPEG, PNG, WebP up to 10 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <p className="text-center text-xs text-brand-primary">{error}</p>
      )}
    </div>
  );
}
