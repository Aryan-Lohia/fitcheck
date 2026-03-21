"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

interface Stats {
  pending: number;
  upcoming: number;
  completed: number;
}

async function fetchStats(): Promise<Stats> {
  const res = await fetch("/api/freelancer/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

const cards: { key: keyof Stats; label: string; color: string }[] = [
  {
    key: "pending",
    label: "Pending Requests",
    color: "border-brand-warm/50 bg-brand-warm/15 text-text-primary",
  },
  {
    key: "upcoming",
    label: "Upcoming Meetings",
    color: "border-brand-blue/35 bg-brand-blue/8 text-brand-blue",
  },
  {
    key: "completed",
    label: "Completed Sessions",
    color: "border-brand-accent/35 bg-brand-accent/10 text-brand-accent",
  },
];

export default function FreelancerDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["freelancer-stats"],
    queryFn: fetchStats,
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className={`rounded-xl border p-5 shadow-sm ${c.color}`}>
            <p className="text-sm font-medium opacity-90">{c.label}</p>
            <p className="mt-1 text-3xl font-bold">
              {isLoading ? "—" : isError ? "!" : data?.[c.key] ?? 0}
            </p>
          </div>
        ))}

        <div className="rounded-xl border border-border-subtle bg-surface p-5 text-text-muted shadow-sm">
          <p className="text-sm font-medium">Total Earnings</p>
          <p className="mt-1 text-3xl font-bold text-text-primary">—</p>
          <p className="mt-1 text-xs opacity-80">Coming soon</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/freelancer/requests"
          className="min-h-11 rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-accent/92"
        >
          View Open Requests
        </Link>
        <Link
          href="/freelancer/calendar"
          className="min-h-11 rounded-lg border border-border-subtle bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-muted"
        >
          My Calendar
        </Link>
      </div>
    </main>
  );
}
