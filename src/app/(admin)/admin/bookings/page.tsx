"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface Booking {
  id: string;
  status: string;
  topic: string;
  notes: string | null;
  preferredTime: string | null;
  durationMinutes: number;
  paymentStatus: string;
  createdAt: string;
  user: { name: string; email: string };
  freelancer: { user: { name: string } } | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-black/[0.06] text-black/65",
  requested: "bg-brand-warm/20 text-brand-accent",
  accepted: "bg-brand-blue/15 text-brand-blue",
  meeting_link_sent: "bg-brand-blue/12 text-brand-blue",
  in_progress: "bg-brand-accent/12 text-brand-accent",
  completed: "bg-brand-blue/10 text-brand-blue",
  cancelled: "bg-brand-primary/12 text-brand-primary",
  refunded: "bg-brand-warm/25 text-brand-accent",
};

const allStatuses = ["all", "requested", "accepted", "in_progress", "completed", "cancelled"];

export default function AdminBookingsPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, error } = useQuery<{ bookings: Booking[] }>({
    queryKey: ["admin", "bookings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/bookings");
      if (!res.ok) throw new Error("Failed to load bookings");
      return res.json();
    },
  });

  const filtered =
    statusFilter === "all"
      ? data?.bookings
      : data?.bookings.filter((b) => b.status === statusFilter);

  if (error) {
    return <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-brand-primary">Failed to load bookings.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <p className="mb-4 mt-1 text-sm text-text-muted">
        {data ? `${data.bookings.length} total` : "Loading..."}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {allStatuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${statusFilter === s ? "bg-text-primary text-white" : "bg-black/[0.06] text-black/65 hover:bg-black/[0.08]"
              }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-black/[0.06]" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-surface-muted text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Expert</th>
                  <th className="px-4 py-3">Topic</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered?.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.user.name}</p>
                      <p className="text-xs text-text-muted">{b.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-black/65">
                      {b.freelancer?.user.name ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3">{b.topic}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[b.status] ?? "bg-black/[0.06]"}`}>
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {b.preferredTime
                        ? new Date(b.preferredTime).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered?.map((b) => (
              <div key={b.id} className="rounded-lg border bg-surface p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{b.user.name}</p>
                    <p className="text-xs text-text-muted">{b.topic}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[b.status] ?? "bg-black/[0.06]"}`}>
                    {b.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                  <span>Expert: {b.freelancer?.user.name ?? "—"}</span>
                  <span>Created: {new Date(b.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {filtered?.length === 0 && (
            <p className="mt-4 text-center text-sm text-text-muted">No bookings found.</p>
          )}
        </>
      )}
    </div>
  );
}
