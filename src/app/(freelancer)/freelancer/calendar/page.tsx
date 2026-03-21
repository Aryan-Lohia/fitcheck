"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  addWeeks,
  subWeeks,
} from "date-fns";
import { useState } from "react";
interface BookingRequest {
  id: string;
  topic: string;
  preferredTime: string | null;
  durationMinutes: number;
  status: string;
  meetingLink: string | null;
  user: { name: string; email: string };
}

interface BookingSlot {
  id: string;
  startAt: string;
  endAt: string;
  isBooked: boolean;
}

async function fetchBookings(): Promise<{ requests: BookingRequest[] }> {
  const res = await fetch("/api/freelancer/requests?status=accepted");
  if (!res.ok) throw new Error("Failed to fetch");
  const accepted = await res.json();

  const res2 = await fetch("/api/freelancer/requests?status=meeting_link_sent");
  if (!res2.ok) throw new Error("Failed to fetch");
  const linked = await res2.json();

  return {
    requests: [...accepted.requests, ...linked.requests],
  };
}

async function fetchSlots(): Promise<{ slots: BookingSlot[] }> {
  const res = await fetch("/api/freelancer/slots");
  if (!res.ok) throw new Error("Failed to fetch slots");
  return res.json();
}

const _HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
void _HOURS;

const STATUS_COLORS: Record<string, string> = {
  accepted: "border-brand-warm/40 bg-brand-warm/15 text-brand-accent",
  meeting_link_sent: "border-brand-blue/35 bg-brand-blue/12 text-brand-blue",
};

export default function FreelancerCalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const baseDate = useMemo(() => {
    let d = new Date();
    if (weekOffset > 0) d = addWeeks(d, weekOffset);
    if (weekOffset < 0) d = subWeeks(d, Math.abs(weekOffset));
    return d;
  }, [weekOffset]);

  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const bookings = useQuery({
    queryKey: ["freelancer-calendar-bookings"],
    queryFn: fetchBookings,
  });

  const slots = useQuery({
    queryKey: ["freelancer-calendar-slots"],
    queryFn: fetchSlots,
  });

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, BookingRequest[]>();
    for (const b of bookings.data?.requests ?? []) {
      if (!b.preferredTime) continue;
      const key = format(new Date(b.preferredTime), "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(b);
      map.set(key, list);
    }
    return map;
  }, [bookings.data]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, BookingSlot[]>();
    for (const s of slots.data?.slots ?? []) {
      const key = format(new Date(s.startAt), "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [slots.data]);

  const isLoading = bookings.isLoading || slots.isLoading;

  return (
    <main className="mx-auto max-w-5xl p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-muted"
          >
            ← Prev
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-muted"
          >
            Today
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-muted"
          >
            Next →
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm text-text-muted">
        {format(weekStart, "MMM d")} — {format(weekEnd, "MMM d, yyyy")}
      </p>

      {isLoading ? (
        <div className="h-96 animate-pulse rounded-lg bg-black/[0.08]" />
      ) : (
        <>
          {/* Desktop: grid */}
          <div className="hidden gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle md:grid md:grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDay.get(key) || [];
              const daySlots = slotsByDay.get(key) || [];
              const isToday = isSameDay(day, new Date());

              return (
                <div key={key} className="min-h-[200px] bg-surface">
                  <div
                    className={`sticky top-0 border-b px-2 py-2 text-center text-xs font-medium ${isToday
                      ? "bg-text-primary text-surface"
                      : "bg-surface-muted text-text-primary"
                      }`}
                  >
                    <div>{format(day, "EEE")}</div>
                    <div className="text-lg">{format(day, "d")}</div>
                  </div>
                  <div className="p-1.5 space-y-1">
                    {daySlots
                      .filter((s) => !s.isBooked)
                      .map((s) => (
                        <div
                          key={s.id}
                          className="rounded border border-brand-blue/30 bg-brand-blue/10 px-1.5 py-1 text-xs text-brand-blue"
                        >
                          {format(new Date(s.startAt), "h:mm a")} — Available
                        </div>
                      ))}
                    {dayBookings.map((b) => (
                      <div
                        key={b.id}
                        className={`rounded border px-1.5 py-1 text-xs ${STATUS_COLORS[b.status] || STATUS_COLORS.accepted
                          }`}
                      >
                        <div className="font-medium truncate">{b.topic}</div>
                        <div className="opacity-70">
                          {b.preferredTime &&
                            format(new Date(b.preferredTime), "h:mm a")}
                          {" · "}
                          {b.durationMinutes}m
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: stacked list */}
          <div className="md:hidden space-y-3">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDay.get(key) || [];
              const daySlots = slotsByDay.get(key) || [];
              const isToday = isSameDay(day, new Date());

              if (dayBookings.length === 0 && daySlots.length === 0) return null;

              return (
                <div key={key} className="overflow-hidden rounded-lg border border-border-subtle">
                  <div
                    className={`px-3 py-2 text-sm font-medium ${isToday ? "bg-text-primary text-surface" : "bg-surface-muted text-text-primary"
                      }`}
                  >
                    {format(day, "EEEE, MMM d")}
                  </div>
                  <div className="p-2 space-y-1.5">
                    {daySlots
                      .filter((s) => !s.isBooked)
                      .map((s) => (
                        <div
                          key={s.id}
                          className="rounded border border-brand-blue/30 bg-brand-blue/10 px-2.5 py-1.5 text-xs text-brand-blue"
                        >
                          {format(new Date(s.startAt), "h:mm a")} –{" "}
                          {format(new Date(s.endAt), "h:mm a")} · Available
                        </div>
                      ))}
                    {dayBookings.map((b) => (
                      <div
                        key={b.id}
                        className={`rounded border px-2.5 py-1.5 text-xs ${STATUS_COLORS[b.status] || STATUS_COLORS.accepted
                          }`}
                      >
                        <div className="font-medium">{b.topic}</div>
                        <div className="opacity-70">
                          {b.preferredTime &&
                            format(new Date(b.preferredTime), "h:mm a")}
                          {" · "}
                          {b.durationMinutes}m · {b.user.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-brand-blue/40 bg-brand-blue/10" />
              Available Slot
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-brand-warm/50 bg-brand-warm/25" />
              Accepted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-brand-blue/40 bg-brand-blue/15" />
              Link Sent
            </span>
          </div>
        </>
      )}
    </main>
  );
}
