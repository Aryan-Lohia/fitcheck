"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface TrialRow {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  status: string;
  proEnabled: boolean;
  user: { name: string; email: string };
}

function daysRemaining(endAt: string) {
  const diff = new Date(endAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function isExpired(endAt: string) {
  return new Date(endAt).getTime() < Date.now();
}

const tabs = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Expired", value: "expired" },
];

export default function AdminTrialsPage() {
  const [tab, setTab] = useState("all");

  const { data, isLoading, error } = useQuery<{ trials: TrialRow[] }>({
    queryKey: ["admin", "trials"],
    queryFn: async () => {
      const res = await fetch("/api/admin/trials");
      if (!res.ok) throw new Error("Failed to load trials");
      return res.json();
    },
  });

  const filtered = data?.trials.filter((t) => {
    if (tab === "active") return !isExpired(t.endAt);
    if (tab === "expired") return isExpired(t.endAt);
    return true;
  });

  if (error) {
    return <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-brand-primary">Failed to load trials.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Trials</h1>
      <p className="mb-4 mt-1 text-sm text-text-muted">
        {data ? `${data.trials.length} total` : "Loading..."}
      </p>

      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.value ? "bg-text-primary text-white" : "bg-text-primary/10 text-text-muted hover:bg-text-primary/[0.14]"
              }`}
          >
            {t.label}
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
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Days Left</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered?.map((t) => {
                  const expired = isExpired(t.endAt);
                  const days = daysRemaining(t.endAt);
                  return (
                    <tr key={t.id} className={`hover:bg-surface-muted ${expired ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{t.user.name}</p>
                        <p className="text-xs text-text-muted">{t.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {new Date(t.startAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {new Date(t.endAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {expired ? (
                          <span className="rounded-full bg-brand-primary/12 px-2 py-0.5 text-xs font-medium text-brand-primary">
                            Expired
                          </span>
                        ) : (
                          <span
                            className={`font-medium ${days <= 3 ? "text-brand-accent" : "text-brand-blue"}`}
                          >
                            {days} days
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.proEnabled ? "bg-brand-blue/15 text-brand-blue" : "bg-text-primary/10 text-text-muted"}`}
                        >
                          {t.proEnabled ? "Pro" : "Basic"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs font-medium capitalize text-text-muted">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered?.map((t) => {
              const expired = isExpired(t.endAt);
              const days = daysRemaining(t.endAt);
              return (
                <div key={t.id} className={`rounded-lg border bg-surface p-4 ${expired ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{t.user.name}</p>
                      <p className="text-xs text-text-muted">{t.user.email}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.proEnabled ? "bg-brand-blue/15 text-brand-blue" : "bg-text-primary/10 text-text-muted"}`}
                    >
                      {t.proEnabled ? "Pro" : "Basic"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
                    <span>{new Date(t.startAt).toLocaleDateString()} – {new Date(t.endAt).toLocaleDateString()}</span>
                    {expired ? (
                      <span className="font-medium text-brand-primary">Expired</span>
                    ) : (
                      <span
                        className={`font-medium ${days <= 3 ? "text-brand-accent" : "text-brand-blue"}`}
                      >
                        {days} days left
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered?.length === 0 && (
            <p className="mt-4 text-center text-sm text-text-muted">No trials found.</p>
          )}
        </>
      )}
    </div>
  );
}
