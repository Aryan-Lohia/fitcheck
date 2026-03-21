"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

interface Stats {
  users: number;
  trials: number;
  pendingFreelancers: number;
  todayBookings: number;
}

const cards: { key: keyof Stats; label: string; href: string; color: string }[] = [
  {
    key: "users",
    label: "Total Users",
    href: "/admin/users",
    color: "border-brand-blue/30 bg-brand-blue/10 text-brand-blue",
  },
  {
    key: "trials",
    label: "Active Trials",
    href: "/admin/trials",
    color: "border-brand-warm/40 bg-brand-warm/15 text-brand-accent",
  },
  {
    key: "pendingFreelancers",
    label: "Pending Approvals",
    href: "/admin/freelancers",
    color: "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
  },
  {
    key: "todayBookings",
    label: "Today's Bookings",
    href: "/admin/bookings",
    color: "border-brand-accent/35 bg-brand-accent/12 text-brand-accent",
  },
];

export default function AdminDashboard() {
  const { data, isLoading, error } = useQuery<Stats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  if (error) {
    return (
      <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-brand-primary">
        Failed to load dashboard. You may not have admin access.
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mb-6 mt-1 text-sm text-text-muted">Admin overview and quick actions</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ key, label, href, color }) => (
          <Link
            key={key}
            href={href}
            className={`rounded-lg border p-5 transition-shadow hover:shadow-md ${color}`}
          >
            <p className="text-sm font-medium opacity-80">{label}</p>
            <p className="mt-2 text-3xl font-bold">
              {isLoading ? (
                <span className="inline-block h-9 w-16 animate-pulse rounded bg-current opacity-10" />
              ) : (
                data?.[key] ?? "—"
              )}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/admin/freelancers", label: "Review Freelancers" },
            { href: "/admin/bookings", label: "Manage Bookings" },
            { href: "/admin/logs", label: "View Audit Logs" },
            { href: "/admin/storage", label: "Check Storage" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-md border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-surface-muted"
            >
              {action.label} &rarr;
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
