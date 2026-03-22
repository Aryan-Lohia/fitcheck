"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BookingRequest {
  id: string;
  topic: string;
  notes: string | null;
  preferredTime: string | null;
  durationMinutes: number;
  status: string;
  meetingLink: string | null;
  createdAt: string;
  acceptedAt: string | null;
  user: { name: string; email: string };
}

async function fetchActive(): Promise<{ requests: BookingRequest[] }> {
  const res = await fetch("/api/freelancer/requests?status=active");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function markComplete(id: string) {
  const res = await fetch(`/api/bookings/${id}/complete`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to mark complete");
  return res.json();
}

function MeetingCard({ meeting }: { meeting: BookingRequest }) {
  const queryClient = useQueryClient();

  const complete = useMutation({
    mutationFn: () => markComplete(meeting.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer-meetings-active"] });
      queryClient.invalidateQueries({ queryKey: ["freelancer-stats"] });
    },
  });

  const preferred = meeting.preferredTime ? new Date(meeting.preferredTime) : null;

  const statusLabel =
    meeting.status === "meeting_link_sent" || meeting.status === "in_progress"
      ? "Meet ready"
      : meeting.status.replace(/_/g, " ");

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-text-primary">{meeting.topic}</h3>
          <p className="mt-0.5 text-sm text-text-muted">{meeting.user.name}</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-blue/12 px-2 py-0.5 text-xs font-medium capitalize text-brand-blue">
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {preferred && (
          <span>
            Preferred:{" "}
            {preferred.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
        <span>{meeting.durationMinutes} min</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/freelancer/booking/${meeting.id}`}
          className="inline-flex rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-accent/92"
        >
          Booking room
        </Link>
        {meeting.meetingLink && (
          <a
            href={meeting.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-sm text-brand-blue transition-colors hover:bg-brand-blue/15"
          >
            Join Meet ↗
          </a>
        )}
      </div>

      {meeting.meetingLink && meeting.status !== "completed" && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => complete.mutate()}
            disabled={complete.isPending}
            className="rounded-lg border border-brand-blue/35 bg-brand-blue/10 px-4 py-2 text-sm font-medium text-brand-blue transition-colors hover:bg-brand-blue/15 disabled:opacity-50"
          >
            {complete.isPending ? "Completing..." : "Mark Complete"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function FreelancerMeetingsPage() {
  const active = useQuery({
    queryKey: ["freelancer-meetings-active"],
    queryFn: fetchActive,
  });

  const meetings = (active.data?.requests ?? []).filter(
    (m) =>
      m.meetingLink ||
      m.status === "meeting_link_sent" ||
      m.status === "in_progress" ||
      m.status === "accepted",
  );

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="mb-6 text-2xl font-semibold">Upcoming Meetings</h1>

      {active.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-black/[0.08]" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted">
          No meetings yet. Accept a booking and complete payment in the booking room to get a Meet
          link.
        </p>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </main>
  );
}
