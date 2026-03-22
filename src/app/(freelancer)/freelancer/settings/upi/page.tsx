"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function fetchUpi(): Promise<{
  upiVpa: string | null;
  hasQr: boolean;
  previewUrl: string | null;
}> {
  const res = await fetch("/api/freelancer/upi-qr");
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

export default function FreelancerUpiSettingsPage() {
  const qc = useQueryClient();
  const qrFileInputRef = useRef<HTMLInputElement>(null);
  const [vpa, setVpa] = useState("");
  const [vpaDirty, setVpaDirty] = useState(false);

  const q = useQuery({
    queryKey: ["freelancer-upi"],
    queryFn: fetchUpi,
    refetchOnWindowFocus: true,
  });

  const saveVpa = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/freelancer/upi-qr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upiVpa: vpa.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancer-upi"] });
      qc.invalidateQueries({ queryKey: ["booking"] });
      setVpaDirty(false);
    },
  });

  const uploadQr = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      if (vpa.trim()) fd.append("upiVpa", vpa.trim());

      const res = await fetch("/api/freelancer/upi-qr/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancer-upi"] });
      qc.invalidateQueries({ queryKey: ["booking"] });
    },
  });

  const initialVpa = q.data?.upiVpa ?? "";
  const displayVpa = vpaDirty ? vpa : initialVpa;

  return (
    <main className="mx-auto max-w-lg p-4">
      <h1 className="text-2xl font-semibold text-text-primary">UPI payout</h1>
      <p className="mt-1 text-sm text-text-muted">
        Upload the QR your clients will scan when you send a quote. Optional: add your UPI ID for
        copy-paste.
      </p>

      {q.isLoading && <p className="mt-6 text-sm text-text-muted">Loading…</p>}
      {q.isError && (
        <p className="mt-6 text-sm text-brand-primary">Could not load settings.</p>
      )}

      {q.data && (
        <div className="mt-6 space-y-6">
          <div>
            <Label htmlFor="upi-vpa">UPI ID (optional)</Label>
            <Input
              id="upi-vpa"
              className="mt-1"
              placeholder="you@paytm"
              value={displayVpa}
              onChange={(e) => {
                setVpaDirty(true);
                setVpa(e.target.value);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-2 h-8 text-xs"
              disabled={saveVpa.isPending || !vpaDirty}
              onClick={() => saveVpa.mutate()}
            >
              Save UPI ID
            </Button>
            {saveVpa.isError && (
              <p className="mt-1 text-xs text-brand-primary">
                {(saveVpa.error as Error).message}
              </p>
            )}
          </div>

          <div>
            <Label>QR code image</Label>
            <p className="mt-1 text-xs text-text-muted">
              File name clears after upload finishes; your QR preview below confirms it is stored.
            </p>
            {q.data.hasQr && !q.data.previewUrl && (
              <p className="mt-2 rounded-lg border border-brand-primary/25 bg-brand-primary/8 p-2 text-xs text-text-muted">
                QR is saved, but preview could not be loaded (S3 GetObject / presign). Bookings may
                still work if permissions differ per request—use Retry or re-upload after fixing IAM.
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-8 text-xs"
                  onClick={() => qc.invalidateQueries({ queryKey: ["freelancer-upi"] })}
                >
                  Retry preview
                </Button>
              </p>
            )}
            {q.data.previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={q.data.previewUrl}
                alt="Current UPI QR"
                className="mt-2 max-h-48 rounded-lg border border-border-subtle bg-surface-muted p-2"
              />
            )}
            <Input
              ref={qrFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2"
              disabled={uploadQr.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                const input = e.target;
                if (!f) return;
                uploadQr.mutate(f, {
                  onSettled: () => {
                    input.value = "";
                    if (qrFileInputRef.current) qrFileInputRef.current.value = "";
                  },
                });
              }}
            />
            {uploadQr.isPending && (
              <p className="mt-1 text-xs text-text-muted">Uploading…</p>
            )}
            {uploadQr.isSuccess && !uploadQr.isPending && (
              <p className="mt-1 text-xs font-medium text-brand-accent">QR saved.</p>
            )}
            {uploadQr.isError && (
              <p className="mt-1 text-xs text-brand-primary">
                {(uploadQr.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
