"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExpertCard } from "@/components/booking/ExpertCard";
import { BookingCard } from "@/components/booking/BookingCard";
import { CalendarView } from "@/components/booking/CalendarView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Expert {
  id: string;
  bio: string | null;
  expertiseTagsJson: string[] | null;
  user: { name: string | null; email: string };
}

interface Booking {
  id: string;
  topic: string;
  status: string;
  preferredTime: string | null;
  freelancer?: { user: { name: string | null } } | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export default function BookExpertPage() {
  const queryClient = useQueryClient();

  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string>();
  const [duration, setDuration] = useState(30);

  const experts = useQuery({
    queryKey: ["experts-available"],
    queryFn: () => fetchJson<{ experts: Expert[] }>("/api/experts/available"),
  });

  const bookings = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => fetchJson<{ bookings: Booking[] }>("/api/bookings"),
  });

  const createBooking = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          notes: notes || null,
          preferredTime: selectedSlot || null,
          durationMinutes: duration,
        }),
      });
      if (!res.ok) throw new Error("Failed to create booking");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      setTopic("");
      setNotes("");
      setSelectedSlot(undefined);
      setDuration(30);
    },
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
      <h1 className="text-xl font-semibold text-text-primary">Book an Expert</h1>
      <p className="mt-1 text-sm text-text-muted">
        Schedule a session with a style expert.
      </p>

      <div className="mt-8 lg:grid lg:grid-cols-2 lg:gap-10">
        <section>
          <h2 className="text-base font-semibold text-text-primary">
            Available Experts
          </h2>
          {experts.isLoading && (
            <p className="mt-3 text-sm text-text-muted">Loading experts...</p>
          )}
          {experts.data?.experts.length === 0 && (
            <p className="mt-3 text-sm text-text-muted">
              No experts available right now.
            </p>
          )}
          <div className="mt-3 space-y-3">
            {experts.data?.experts.map((e) => (
              <ExpertCard
                key={e.id}
                name={e.user.name ?? "Expert"}
                specializations={(e.expertiseTagsJson as string[]) ?? []}
                bio={e.bio ?? ""}
              />
            ))}
          </div>
        </section>

        <section className="mt-10 lg:mt-0">
          <h2 className="text-base font-semibold text-text-primary">
            Request a Session
          </h2>
          <div className="mt-3 space-y-4">
            <div>
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Outfit review for interview"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any details for the expert..."
                className="mt-1 min-h-[5.5rem]"
              />
            </div>

            <div>
              <span className="text-sm font-medium text-text-primary">
                Preferred Time
              </span>
              <div className="mt-1">
                <CalendarView
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="duration">Duration</Label>
              <Select
                id="duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </Select>
            </div>

            <Button
              type="button"
              disabled={!topic.trim() || createBooking.isPending}
              onClick={() => createBooking.mutate()}
              className="w-full"
            >
              {createBooking.isPending ? "Submitting..." : "Request Expert"}
            </Button>

            {createBooking.isError && (
              <p className="text-sm text-brand-primary" role="alert">
                Failed to submit booking. Try again.
              </p>
            )}
            {createBooking.isSuccess && (
              <p className="text-sm font-medium text-brand-blue">
                Booking request submitted!
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-10 border-t border-border-subtle pt-8">
        <h2 className="text-base font-semibold text-text-primary">My Bookings</h2>
        {bookings.isLoading && (
          <p className="mt-3 text-sm text-text-muted">Loading bookings...</p>
        )}
        {bookings.data?.bookings.length === 0 && (
          <p className="mt-3 text-sm text-text-muted">No bookings yet.</p>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {bookings.data?.bookings.map((b) => (
            <BookingCard
              key={b.id}
              id={b.id}
              topic={b.topic}
              status={b.status}
              expertName={b.freelancer?.user.name ?? undefined}
              preferredTime={b.preferredTime ?? undefined}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
