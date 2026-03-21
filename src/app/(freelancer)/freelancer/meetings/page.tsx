"use client";

import { useState } from "react";
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

async function fetchByStatus(status: string): Promise<{ requests: BookingRequest[] }> {
  const res = await fetch(`/api/freelancer/requests?status=${status}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function saveMeetingLink(id: string, meetingLink: string) {
  const res = await fetch(`/api/bookings/${id}/meeting-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingLink }),
  });
  if (!res.ok) throw new Error("Failed to save meeting link");
  return res.json();
}

async function markComplete(id: string) {
  const res = await fetch(`/api/bookings/${id}/complete`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to mark complete");
  return res.json();
}

function MeetingCard({ meeting }: { meeting: BookingRequest }) {
  const queryClient = useQueryClient();
  const [link, setLink] = useState("");

  const addLink = useMutation({
    mutationFn: () => saveMeetingLink(meeting.id, link),
    onSuccess: () => {
      setLink("");
      queryClient.invalidateQueries({ queryKey: ["freelancer-meetings"] });
    },
  });

  const complete = useMutation({
    mutationFn: () => markComplete(meeting.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer-meetings"] });
      queryClient.invalidateQueries({ queryKey: ["freelancer-stats"] });
    },
  });

  const preferred = meeting.preferredTime
    ? new Date(meeting.preferredTime)
    : null;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-text-primary">{meeting.topic}</h3>
          <p className="mt-0.5 text-sm text-text-muted">{meeting.user.name}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meeting.status === "meeting_link_sent"
              ? "bg-brand-blue/15 text-brand-blue"
              : "bg-brand-warm/20 text-brand-accent"
            }`}
        >
          {meeting.status === "meeting_link_sent" ? "Link Sent" : "Accepted"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {preferred && (
          <span>
            Scheduled:{" "}
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

      {meeting.meetingLink && (
        <div className="mt-3">
          <a
            href={meeting.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-sm text-brand-blue transition-colors hover:bg-brand-blue/15"
          >
            Join Meeting ↗
          </a>
        </div>
      )}

      {/* Add link form for accepted meetings without a link */}
      {meeting.status === "accepted" && !meeting.meetingLink && (
        <div className="mt-4 flex gap-2">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Paste meeting link..."
            className="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/35"
          />
          <button
            onClick={() => addLink.mutate()}
            disabled={!link || addLink.isPending}
            className="shrink-0 rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accent/92 disabled:opacity-50"
          >
            {addLink.isPending ? "Saving..." : "Add Link"}
          </button>
        </div>
      )}

      {/* Mark complete for meetings with a link */}
      {meeting.meetingLink && meeting.status !== "completed" && (
        <div className="mt-3">
          <button
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
  const accepted = useQuery({
    queryKey: ["freelancer-meetings", "accepted"],
    queryFn: () => fetchByStatus("accepted"),
  });

  const linkSent = useQuery({
    queryKey: ["freelancer-meetings", "meeting_link_sent"],
    queryFn: () => fetchByStatus("meeting_link_sent"),
  });

  const isLoading = accepted.isLoading || linkSent.isLoading;
  const meetings = [
    ...(linkSent.data?.requests ?? []),
    ...(accepted.data?.requests ?? []),
  ];

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="text-2xl font-semibold mb-6">Upcoming Meetings</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-black/[0.08]" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted">
          No upcoming meetings.
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
