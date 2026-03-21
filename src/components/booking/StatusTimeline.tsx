"use client";

interface StatusTimelineProps {
  status: string;
}

const STEPS = [
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "meeting_link_sent", label: "Meeting Link Sent" },
  { key: "completed", label: "Completed" },
];

export function StatusTimeline({ status }: StatusTimelineProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const isCancelled = status === "cancelled";

  return (
    <div className="py-4">
      {isCancelled ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand-primary/25 bg-brand-primary/8 p-3">
          <div className="h-3 w-3 rounded-full bg-brand-primary" />
          <span className="text-sm font-medium text-brand-primary">
            Booking Cancelled
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
