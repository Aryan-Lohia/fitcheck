"use client";

import { useMemo } from "react";

interface CalendarViewProps {
  selectedSlot?: string;
  onSelectSlot: (slot: string) => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const START_HOUR = 9;
const END_HOUR = 18;

function getWeekDates(): Date[] {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function CalendarView({ selectedSlot, onSelectSlot }: CalendarViewProps) {
  const weekDates = useMemo(() => getWeekDates(), []);
  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    [],
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border-subtle bg-surface-muted">
          <div className="p-2 text-center text-xs font-medium text-text-muted">Time</div>
          {DAYS.map((day, i) => (
            <div key={day} className="p-2 text-center text-xs font-medium text-text-primary">
              <span>{day}</span>
              <span className="ml-1 text-text-muted">{weekDates[i].getDate()}</span>
            </div>
          ))}
        </div>

        {hours.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border-subtle last:border-b-0"
          >
            <div className="flex items-center justify-center p-1 text-xs text-text-muted">
              {hour}:00
            </div>
            {weekDates.map((date, dayIdx) => {
              const slotDate = new Date(date);
              slotDate.setHours(hour, 0, 0, 0);
              const slotKey = slotDate.toISOString();
              const isSelected = selectedSlot === slotKey;
              const isPast = slotDate < new Date();

              return (
                <button
                  key={dayIdx}
                  type="button"
                  disabled={isPast}
                  onClick={() => onSelectSlot(slotKey)}
                  className={`m-0.5 min-h-9 rounded p-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40 ${isPast
                    ? "cursor-not-allowed bg-surface-muted text-text-muted/50"
                    : isSelected
                      ? "bg-brand-accent font-medium text-white"
                      : "bg-surface text-text-primary hover:bg-brand-warm/15"
                    }`}
                >
                  {isSelected ? "✓" : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
