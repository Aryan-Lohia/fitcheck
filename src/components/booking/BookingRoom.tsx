"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusTimeline } from "@/components/booking/StatusTimeline";
import { ExpertCard } from "@/components/booking/ExpertCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

type BookingApi = {
  booking: {
    id: string;
    topic: string;
    notes: string | null;
    status: string;
    preferredTime: string | null;
    durationMinutes: number;
    meetingLink: string | null;
    quoteAmountMinor: number | null;
    quoteCurrency: string;
    quotedAt: string | null;
    quoteNotes: string | null;
    user: { id: string; name: string; email: string };
    freelancer: {
      id: string;
      bio: string | null;
      expertiseTagsJson: unknown;
      upiVpa: string | null;
      user: { id: string; name: string; email: string };
    } | null;
  };
  myRole: "user" | "freelancer";
  upiQrUrl: string | null;
  /** Expert has `upiQrS3Key` in DB (quote allowed); presign may still fail. */
  upiQrConfigured: boolean;
  canChat: boolean;
  canQuote: boolean;
  canSubmitProof: boolean;
  canConfirmPayment: boolean;
};

type MessageRow = {
  id: string;
  role: string;
  kind: string;
  body: string;
  metadataJson: unknown;
  createdAt: string;
  authorUserId: string | null;
};

async function fetchBooking(id: string): Promise<BookingApi> {
  const res = await fetch(`/api/bookings/${id}`);
  if (!res.ok) throw new Error("Failed to load booking");
  return res.json();
}

async function fetchMessages(id: string): Promise<{ messages: MessageRow[] }> {
  const res = await fetch(`/api/bookings/${id}/messages`);
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

async function uploadPaymentProofFile(bookingId: string, file: File): Promise<void> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/bookings/${bookingId}/payment-proof/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.error === "string" ? body.error : "Upload failed");
  }
}

function MessageBubble({ m, isMine }: { m: MessageRow; isMine: boolean }) {
  if (m.kind === "system" || m.role === "SYSTEM") {
    return (
      <div className="flex justify-center py-2">
        <p className="max-w-[90%] rounded-lg bg-black/[0.06] px-3 py-2 text-center text-xs text-text-muted">
          {m.body}
        </p>
      </div>
    );
  }

  const meta = m.metadataJson && typeof m.metadataJson === "object" ? m.metadataJson as Record<string, unknown> : null;

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} py-1`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${isMine
          ? "bg-brand-blue text-white"
          : "border border-border-subtle bg-surface text-text-primary"
          }`}
      >
        {m.kind === "quote" && meta && typeof meta.amountRupees === "number" && (
          <p className="font-semibold">₹{meta.amountRupees.toFixed(2)} INR</p>
        )}
        <p className="whitespace-pre-wrap">{m.body}</p>
        {m.kind === "photos_share" &&
          meta &&
          Array.isArray(meta.attachments) && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(meta.attachments as { url?: string; fileName?: string }[]).map((a, i) =>
                a.url ? (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.fileName ?? "photo"}
                      className="h-28 w-full rounded-lg object-cover"
                    />
                  </a>
                ) : null,
              )}
            </div>
          )}
        {m.kind === "payment_proof" &&
          meta &&
          typeof meta.imageUrl === "string" && (
            <a href={meta.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={meta.imageUrl}
                alt="Payment proof"
                className="max-h-48 rounded-lg border border-white/20"
              />
            </a>
          )}
        <p className={`mt-1 text-[10px] ${isMine ? "text-white/70" : "text-text-muted"}`}>
          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

type Props = {
  bookingId: string;
  /** When true, an assigned expert opening the user-area URL is redirected to `/freelancer/booking/:id`. */
  redirectFreelancer?: boolean;
};

export function BookingRoom({ bookingId, redirectFreelancer }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);

  const bookingQ = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => fetchBooking(bookingId),
    enabled: !!bookingId,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const d = query.state.data as BookingApi | undefined;
      const s = d?.booking?.status;
      if (s === "awaiting_payment" || s === "payment_submitted") return 45_000;
      return false;
    },
  });

  const messagesQ = useQuery({
    queryKey: ["booking-messages", bookingId],
    queryFn: () => fetchMessages(bookingId),
    enabled: !!bookingId && !!bookingQ.data,
    refetchInterval: 4000,
  });

  useEffect(() => {
    const d = bookingQ.data;
    if (!d || !user || !redirectFreelancer) return;
    if (user.role === "FREELANCE_USER" && d.myRole === "freelancer") {
      router.replace(`/freelancer/booking/${bookingId}`);
    }
  }, [bookingQ.data, user, router, bookingId, redirectFreelancer]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQ.data?.messages?.length]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Send failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["booking-messages", bookingId] });
    },
  });

  const shareProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/actions/share-profile`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-messages", bookingId] });
    },
  });

  const mediaQ = useQuery({
    queryKey: ["profile-media", "booking-share"],
    queryFn: async () => {
      const res = await fetch("/api/profile/media");
      if (!res.ok) throw new Error("Failed to load photos");
      return res.json() as Promise<{
        media: { id: string; fileName: string; mimeType: string; category: string }[];
      }>;
    },
    enabled: photoModalOpen,
  });

  const sharePhotos = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(`/api/bookings/${bookingId}/actions/share-photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMediaIds: ids }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setPhotoModalOpen(false);
      setSelectedPhotoIds([]);
      queryClient.invalidateQueries({ queryKey: ["booking-messages", bookingId] });
    },
  });

  const sendQuote = useMutation({
    mutationFn: async () => {
      const amountRupees = Number(quoteAmount);
      const res = await fetch(`/api/bookings/${bookingId}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountRupees,
          notes: quoteNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Quote failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setQuoteAmount("");
      setQuoteNotes("");
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking-messages", bookingId] });
    },
  });

  const paymentUpload = useMutation({
    mutationFn: async (file: File) => uploadPaymentProofFile(bookingId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking-messages", bookingId] });
    },
  });

  const confirmPayment = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/confirm-payment`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Confirm failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking-messages", bookingId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });

  const b = bookingQ.data?.booking;
  const caps = bookingQ.data;

  const messages = messagesQ.data?.messages ?? [];

  const sessionUserId = user?.userId;

  const canCancel = useMemo(() => {
    if (!b) return false;
    const blocked = new Set([
      "meeting_link_sent",
      "in_progress",
      "completed",
      "cancelled",
      "refunded",
    ]);
    return !blocked.has(b.status);
  }, [b]);

  if (bookingQ.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-4 md:px-6">
        <p className="text-sm text-text-muted">Loading booking…</p>
      </main>
    );
  }

  if (bookingQ.isError || !b || !caps) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-4 md:px-6">
        <p className="text-sm text-brand-primary" role="alert">
          Booking not found.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-4 md:px-6">
      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          router.push(caps.myRole === "freelancer" ? "/freelancer/requests" : "/book-expert")
        }
        className="mb-4 min-h-10 px-0 text-sm font-medium text-brand-blue hover:underline"
      >
        ← Back
      </Button>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
        <section className="flex min-h-[480px] flex-col rounded-xl border border-border-subtle bg-surface shadow-sm">
          <div className="border-b border-border-subtle px-4 py-3">
            <h1 className="text-lg font-semibold text-text-primary">{b.topic}</h1>
            <p className="text-xs text-text-muted">
              {caps.myRole === "user" ? "Chat with your expert" : "Client conversation"}
            </p>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3" style={{ maxHeight: "min(56vh, 520px)" }}>
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                m={m}
                isMine={
                  !!sessionUserId &&
                  m.authorUserId === sessionUserId &&
                  (m.role === "USER" || m.role === "FREELANCER")
                }
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {caps.myRole === "user" && caps.canChat && (
            <div className="flex flex-wrap gap-2 border-t border-border-subtle px-3 py-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs"
                disabled={shareProfile.isPending}
                onClick={() => shareProfile.mutate()}
              >
                Share profile
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setPhotoModalOpen(true)}
              >
                Share model photos
              </Button>
            </div>
          )}

          <div className="border-t border-border-subtle p-3">
            {caps.canChat ? (
              <div className="flex gap-2">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Message…"
                  rows={2}
                  className="min-h-[44px] flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (text.trim() && !sendMessage.isPending) sendMessage.mutate();
                    }
                  }}
                />
                <Button
                  type="button"
                  className="self-end"
                  disabled={!text.trim() || sendMessage.isPending}
                  onClick={() => sendMessage.mutate()}
                >
                  Send
                </Button>
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                {b.freelancer
                  ? "Messaging is closed for this booking state."
                  : "Accept this booking from your requests to start chatting."}
              </p>
            )}
            {sendMessage.isError && (
              <p className="mt-1 text-xs text-brand-primary">{(sendMessage.error as Error).message}</p>
            )}
          </div>
        </section>

        <aside className="mt-6 space-y-4 lg:mt-0">
          <StatusTimeline status={b.status} />

          {caps.myRole === "user" && b.freelancer && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-text-primary">Expert</h2>
              <ExpertCard
                name={b.freelancer.user.name ?? "Expert"}
                specializations={
                  Array.isArray(b.freelancer.expertiseTagsJson)
                    ? (b.freelancer.expertiseTagsJson as string[])
                    : []
                }
                bio={b.freelancer.bio ?? ""}
              />
            </section>
          )}

          {caps.myRole === "freelancer" && (
            <section className="rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-text-primary">Client</h2>
              <p className="mt-1 text-sm text-text-primary">{b.user.name}</p>
              <p className="text-xs text-text-muted">{b.user.email}</p>
            </section>
          )}

          {caps.upiQrUrl &&
            (b.status === "awaiting_payment" || b.status === "payment_submitted") && (
              <section className="rounded-xl border border-brand-blue/25 bg-brand-blue/8 p-4">
                <h2 className="text-sm font-semibold text-brand-blue">
                  {caps.myRole === "user" ? "Pay via UPI" : "Your UPI QR (client view)"}
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  {caps.myRole === "user"
                    ? "Scan the expert's QR code. After paying, upload a screenshot below."
                    : "This is the same QR the client sees. Update it in payout settings if needed."}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={caps.upiQrUrl}
                  alt="UPI QR"
                  className="mx-auto mt-3 max-h-52 rounded-lg border border-border-subtle bg-surface-muted p-2"
                />
                {b.freelancer?.upiVpa && (
                  <p className="mt-2 break-all text-center text-xs font-mono text-text-primary">
                    {b.freelancer.upiVpa}
                  </p>
                )}
              </section>
            )}

          {caps.upiQrConfigured &&
            !caps.upiQrUrl &&
            (b.status === "awaiting_payment" || b.status === "payment_submitted") && (
              <section className="rounded-xl border border-brand-primary/25 bg-brand-primary/8 p-4">
                <h2 className="text-sm font-semibold text-brand-primary">UPI QR unavailable</h2>
                <p className="mt-1 text-xs text-text-muted">
                  A QR is on file for this expert, but a secure download link could not be created
                  (check S3 credentials and GetObject permissions on{" "}
                  <code className="rounded bg-black/10 px-1">freelancers/*</code>).{" "}
                  {caps.myRole === "freelancer" && (
                    <>
                      Confirm the image in{" "}
                      <button
                        type="button"
                        className="font-medium text-brand-blue underline"
                        onClick={() => router.push("/freelancer/settings/upi")}
                      >
                        UPI payout
                      </button>
                      .
                    </>
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })}
                >
                  Retry load
                </Button>
              </section>
            )}

          {caps.myRole === "user" && caps.canSubmitProof && (
            <section className="rounded-xl border border-border-subtle p-4">
              <Label className="text-sm font-semibold">Payment screenshot</Label>
              <p className="mt-1 text-xs text-text-muted">
                Uploads to our servers, then S3—no browser-to-S3 step. After success, your proof
                appears in the chat below.
              </p>
              <Input
                ref={paymentFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-2"
                disabled={paymentUpload.isPending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  const input = e.target;
                  if (!f) return;
                  paymentUpload.mutate(f, {
                    onSettled: () => {
                      input.value = "";
                      if (paymentFileInputRef.current) paymentFileInputRef.current.value = "";
                    },
                  });
                }}
              />
              {paymentUpload.isPending && (
                <p className="mt-1 text-xs text-text-muted">Uploading…</p>
              )}
              {paymentUpload.isSuccess && !paymentUpload.isPending && (
                <p className="mt-1 text-xs font-medium text-brand-accent">Screenshot saved.</p>
              )}
              {paymentUpload.isError && (
                <p className="mt-1 text-xs text-brand-primary">
                  {(paymentUpload.error as Error).message}
                </p>
              )}
            </section>
          )}

          {caps.myRole === "freelancer" && caps.canQuote && (
            <section className="rounded-xl border border-border-subtle p-4">
              <h2 className="text-sm font-semibold text-text-primary">Send quote</h2>
              <p className="mt-1 text-xs text-text-muted">
                Requires UPI QR in{" "}
                <button
                  type="button"
                  className="font-medium text-brand-blue underline"
                  onClick={() => router.push("/freelancer/settings/upi")}
                >
                  payout settings
                </button>
                .
              </p>
              <Label className="mt-3 block text-xs">Amount (INR)</Label>
              <Input
                type="number"
                min={1}
                step="0.01"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
                className="mt-1"
              />
              <Label className="mt-2 block text-xs">Notes (optional)</Label>
              <Textarea
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                rows={2}
                className="mt-1"
              />
              <Button
                type="button"
                className="mt-3 w-full"
                disabled={sendQuote.isPending || !quoteAmount}
                onClick={() => sendQuote.mutate()}
              >
                {sendQuote.isPending ? "Sending…" : "Submit quote"}
              </Button>
              {sendQuote.isError && (
                <p className="mt-1 text-xs text-brand-primary">{(sendQuote.error as Error).message}</p>
              )}
            </section>
          )}

          {caps.myRole === "freelancer" && caps.canConfirmPayment && (
            <section className="rounded-xl border border-brand-accent/30 bg-brand-accent/8 p-4">
              <h2 className="text-sm font-semibold text-text-primary">Confirm payment</h2>
              <p className="mt-1 text-xs text-text-muted">
                After you verify the client&apos;s screenshot in the thread, confirm to create the Google Meet
                and email both of you.
              </p>
              <Button
                type="button"
                className="mt-3 w-full bg-brand-accent text-white hover:bg-brand-accent/92"
                disabled={confirmPayment.isPending}
                onClick={() => confirmPayment.mutate()}
              >
                {confirmPayment.isPending ? "Working…" : "Confirm payment & create Meet"}
              </Button>
              {confirmPayment.isError && (
                <p className="mt-1 text-xs text-brand-primary">
                  {(confirmPayment.error as Error).message}
                </p>
              )}
            </section>
          )}

          {b.meetingLink && (
            <section className="rounded-xl border border-brand-blue/25 bg-brand-blue/8 p-4">
              <h2 className="text-sm font-semibold text-brand-blue">Google Meet</h2>
              <a
                href={b.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all text-sm font-medium text-brand-accent underline"
              >
                {b.meetingLink}
              </a>
            </section>
          )}

          <section className="rounded-xl border border-border-subtle p-4 text-sm">
            {b.notes && (
              <p>
                <span className="font-medium text-text-muted">Notes: </span>
                {b.notes}
              </p>
            )}
            {b.preferredTime && (
              <p className="mt-2 text-text-muted">
                Preferred: {new Date(b.preferredTime).toLocaleString()}
              </p>
            )}
            <p className="mt-1 text-text-muted">Duration: {b.durationMinutes} min</p>
          </section>

          {caps.myRole === "user" && canCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
              className="w-full border-brand-primary/40 text-brand-primary"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel booking"}
            </Button>
          )}
        </aside>
      </div>

      {photoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl bg-surface p-4 shadow-lg">
            <h3 className="font-semibold text-text-primary">Select photos</h3>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {mediaQ.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
              {mediaQ.data?.media
                .filter((m) => m.mimeType.startsWith("image/"))
                .map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded border border-border-subtle px-2 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPhotoIds.includes(m.id)}
                      onChange={() => {
                        setSelectedPhotoIds((prev) =>
                          prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id],
                        );
                      }}
                    />
                    <span className="truncate">{m.fileName}</span>
                  </label>
                ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPhotoModalOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                disabled={selectedPhotoIds.length === 0 || sharePhotos.isPending}
                onClick={() => sharePhotos.mutate(selectedPhotoIds)}
              >
                Share
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
