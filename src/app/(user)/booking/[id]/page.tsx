"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StatusTimeline } from "@/components/booking/StatusTimeline";
import { ExpertCard } from "@/components/booking/ExpertCard";
import { Button } from "@/components/ui/button";

interface BookingDetail {
  id: string;
  topic: string;
  notes: string | null;
  status: string;
  preferredTime: string | null;
  durationMinutes: number;
  meetingLink: string | null;
  createdAt: string;
  freelancer?: {
    bio: string | null;
    expertiseTagsJson: string[] | null;
    user: { name: string | null; email: string };
  } | null;
}

async function fetchBooking(id: string): Promise<{ booking: BookingDetail }> {
  const res = await fetch(`/api/bookings/${id}`);
  if (!res.ok) throw new Error("Failed to load booking");
  return res.json();
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => fetchBooking(id),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-4 md:px-6">
        <p className="text-sm text-text-muted">Loading booking...</p>
      </main>
    );
  }

  if (isError || !data?.booking) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-4 md:px-6">
        <p className="text-sm text-brand-primary" role="alert">
          Booking not found.
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/book-expert")}
          className="mt-2 min-h-10 px-0 underline"
        >
          Back to bookings
        </Button>
      </main>
    );
  }

  const b = data.booking;
  const canCancel = b.status === "requested" || b.status === "accepted";

  return (
    <main className="mx-auto max-w-3xl px-4 py-4 md:px-6">
      <Button
        type="button"
        variant="ghost"
        onClick={() => router.push("/book-expert")}
        className="mb-4 min-h-10 px-0 text-sm font-medium text-brand-blue hover:underline"
      >
        ← Back to bookings
      </Button>

      <h1 className="text-xl font-semibold text-text-primary">{b.topic}</h1>

      <StatusTimeline status={b.status} />

      {b.freelancer && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">
            Assigned Expert
          </h2>
          <ExpertCard
            name={b.freelancer.user.name ?? "Expert"}
            specializations={(b.freelancer.expertiseTagsJson as string[]) ?? []}
            bio={b.freelancer.bio ?? ""}
          />
        </section>
      )}

      {b.meetingLink && (
        <section className="mt-4 rounded-xl border border-brand-blue/25 bg-brand-blue/8 p-4">
          <h2 className="text-sm font-semibold text-brand-blue">Meeting Link</h2>
          <a
            href={b.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all text-sm font-medium text-brand-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
          >
            {b.meetingLink}
          </a>
        </section>
      )}

      <section className="mt-4 space-y-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-text-primary">Booking Details</h2>

        {b.notes && (
          <div>
            <span className="text-xs font-medium text-text-muted">Notes</span>
            <p className="text-sm text-text-primary">{b.notes}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-6">
          {b.preferredTime && (
            <div>
              <span className="text-xs font-medium text-text-muted">
                Preferred Time
              </span>
              <p className="text-sm text-text-primary">
                {new Date(b.preferredTime).toLocaleString()}
              </p>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-text-muted">Duration</span>
            <p className="text-sm text-text-primary">{b.durationMinutes} min</p>
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-text-muted">Created</span>
          <p className="text-sm text-text-primary">
            {new Date(b.createdAt).toLocaleString()}
          </p>
        </div>
      </section>

      {canCancel && (
        <Button
          type="button"
          variant="outline"
          disabled={cancelMutation.isPending}
          onClick={() => cancelMutation.mutate()}
          className="mt-6 w-full border-brand-primary/40 text-brand-primary hover:bg-brand-primary/8"
        >
          {cancelMutation.isPending ? "Cancelling..." : "Cancel Booking"}
        </Button>
      )}
      {cancelMutation.isError && (
        <p className="mt-2 text-sm text-brand-primary" role="alert">
          Failed to cancel. Try again.
        </p>
      )}
    </main>
  );
}
