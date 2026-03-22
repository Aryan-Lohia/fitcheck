"use client";

const STEPS = [
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "awaiting_payment", label: "Quote & pay" },
  { key: "payment_submitted", label: "Payment proof" },
  { key: "meeting_link_sent", label: "Meeting" },
  { key: "completed", label: "Completed" },
];

/** Maps API status to the timeline step index (0-based). */
export function bookingStatusStepIndex(status: string): number {
  if (status === "cancelled" || status === "refunded") return -1;
  if (status === "draft") return 0;
  if (status === "requested") return 0;
  if (status === "accepted") return 1;
  if (status === "awaiting_payment") return 2;
  if (status === "payment_submitted") return 3;
  if (status === "payment_confirmed") return 4;
  if (status === "meeting_link_sent" || status === "in_progress") return 4;
  if (status === "completed") return 5;
  return 0;
}

interface StatusTimelineProps {
  status: string;
}

export function StatusTimeline({ status }: StatusTimelineProps) {
  const currentIdx = bookingStatusStepIndex(status);
  const isCancelled = status === "cancelled" || status === "refunded";

  return (
    <div className="py-4">
      {isCancelled || currentIdx < 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand-primary/25 bg-brand-primary/8 p-3">
          <div className="h-3 w-3 rounded-full bg-brand-primary" />
          <span className="text-sm font-medium text-brand-primary">
            {status === "refunded" ? "Refunded" : "Booking Cancelled"}
          </span>
        </div>
      ) : (
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const isPast = i < currentIdx;
            const isCurrent = i === currentIdx;

            return (
              <div key={step.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isPast
                      ? "bg-brand-accent text-white"
                      : isCurrent
                        ? "bg-brand-blue text-white"
                        : "bg-border-subtle text-text-muted"
                      }`}
                  >
                    {isPast ? "✓" : i + 1}
                  </div>
                  <span
                    className={`mt-1.5 text-center text-[10px] leading-tight ${isPast
                      ? "font-medium text-brand-accent"
                      : isCurrent
                        ? "font-medium text-brand-blue"
                        : "text-text-muted"
                      }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-1 h-0.5 flex-1 ${isPast ? "bg-brand-accent/60" : "bg-border-subtle"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
