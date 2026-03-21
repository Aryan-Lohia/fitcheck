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
  user: { name: string; email: string };
}

type Tab = "open" | "accepted";

async function fetchRequests(status: string): Promise<{ requests: BookingRequest[] }> {
  const res = await fetch(`/api/freelancer/requests?status=${status}`);
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
}

async function acceptRequest(id: string) {
  const res = await fetch(`/api/bookings/${id}/accept`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to accept");
  return res.json();
}

async function declineRequest(id: string) {
  const res = await fetch(`/api/bookings/${id}/decline`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to decline");
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

function RequestCard({
  request,
  tab,
}: {
  request: BookingRequest;
  tab: Tab;
}) {
  const queryClient = useQueryClient();
  const [link, setLink] = useState("");

  const accept = useMutation({
    mutationFn: () => acceptRequest(request.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer-requests"] });
    },
  });

  const decline = useMutation({
    mutationFn: () => declineRequest(request.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer-requests"] });
    },
  });

  const addLink = useMutation({
    mutationFn: () => saveMeetingLink(request.id, link),
    onSuccess: () => {
      setLink("");
      queryClient.invalidateQueries({ queryKey: ["freelancer-requests"] });
    },
  });

  const preferred = request.preferredTime
    ? new Date(request.preferredTime)
    : null;
  const urgentThreshold = 24 * 60 * 60 * 1000;
  const [now] = useState(() => Date.now());
  const isUrgent =
    preferred && preferred.getTime() - now < urgentThreshold;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-text-primary">{request.topic}</h3>
          <p className="mt-0.5 text-sm text-text-muted">{request.user.name}</p>
        </div>
        {isUrgent && tab === "open" && (
          <span className="shrink-0 rounded-full bg-brand-primary/12 px-2 py-0.5 text-xs font-medium text-brand-primary">
            Urgent
          </span>
        )}
      </div>

      {request.notes && (
        <p className="mt-2 line-clamp-2 text-sm text-black/65">{request.notes}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {preferred && (
          <span>
            Preferred:{" "}
            {preferred.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
        <span>{request.durationMinutes} min</span>
      </div>

      {tab === "open" && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => accept.mutate()}
            disabled={accept.isPending || decline.isPending}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accent/92 disabled:opacity-50"
          >
            {accept.isPending ? "Accepting..." : "Accept"}
          </button>
          <button
            onClick={() => decline.mutate()}
            disabled={accept.isPending || decline.isPending}
            className="rounded-lg border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}

      {tab === "accepted" && !request.meetingLink && (
        <div className="mt-4 flex gap-2">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://meet.google.com/..."
            className="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/35"
          />
          <button
            onClick={() => addLink.mutate()}
            disabled={!link || addLink.isPending}
            className="shrink-0 rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accent/92 disabled:opacity-50"
          >
            {addLink.isPending ? "Saving..." : "Save Link"}
          </button>
        </div>
      )}

      {tab === "accepted" && request.meetingLink && (
        <p className="mt-3 text-sm text-brand-blue">
          Link sent:{" "}
          <a
            href={request.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {request.meetingLink}
          </a>
        </p>
      )}
    </div>
  );
}

export default function FreelancerRequestsPage() {
  const [tab, setTab] = useState<Tab>("open");

  const statusParam = tab === "open" ? "requested" : "accepted";

  const { data, isLoading } = useQuery({
    queryKey: ["freelancer-requests", statusParam],
    queryFn: () => fetchRequests(statusParam),
  });

  const requests = data?.requests ?? [];

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="text-2xl font-semibold mb-4">Requests</h1>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg bg-black/[0.06] p-1">
        {(["open", "accepted"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === t
              ? "bg-surface text-text-primary shadow-sm"
              : "text-black/65 hover:text-text-primary"
              }`}
          >
            {t === "open" ? "Open Requests" : "My Accepted"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-black/[0.08]" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted">
          {tab === "open"
            ? "No open requests right now."
            : "No accepted requests yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} tab={tab} />
          ))}
        </div>
      )}
    </main>
  );
}
