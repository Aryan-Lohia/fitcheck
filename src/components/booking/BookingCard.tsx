"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface BookingCardProps {
  id: string;
  topic: string;
  status: string;
  expertName?: string;
  preferredTime?: string;
}

const statusStyles: Record<string, string> = {
  requested: "bg-brand-warm/30 text-text-primary",
  accepted: "bg-brand-blue/12 text-brand-blue",
  awaiting_payment: "bg-brand-warm/25 text-brand-accent",
  payment_submitted: "bg-brand-blue/10 text-brand-blue",
  payment_confirmed: "bg-brand-accent/12 text-brand-accent",
  meeting_link_sent: "bg-brand-accent/15 text-brand-accent",
  in_progress: "bg-brand-blue/12 text-brand-blue",
  completed: "bg-border-subtle text-text-muted",
  cancelled: "bg-brand-primary/12 text-brand-primary",
};

function formatStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BookingCard({ id, topic, status, expertName, preferredTime }: BookingCardProps) {
  return (
    <Link
      href={`/booking/${id}`}
      className={cn(
        "block min-h-[4.5rem] rounded-xl border border-border-subtle bg-surface p-4 shadow-sm transition-shadow",
        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-text-primary">{topic}</h3>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
            statusStyles[status] ?? "bg-border-subtle text-text-muted",
          )}
        >
          {formatStatus(status)}
        </span>
      </div>
      {expertName && (
        <p className="mt-1 text-xs text-text-muted">Expert: {expertName}</p>
      )}
      {preferredTime && (
        <p className="mt-1 text-xs text-text-muted/90">
          {new Date(preferredTime).toLocaleString()}
        </p>
      )}
    </Link>
  );
}
