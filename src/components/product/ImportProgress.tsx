"use client";

const STEPS = ["Fetching page", "Extracting data", "Normalizing", "Analyzing fit"];

type ImportProgressProps = {
  currentStep: number;
};

export function ImportProgress({ currentStep }: ImportProgressProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5">
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${done
                      ? "bg-blue-600 text-white"
                      : active
                        ? "border-2 border-blue-600 text-blue-600"
                        : "border border-slate-300 text-slate-400"
                    }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  className={`text-center text-[10px] leading-tight ${done || active ? "font-medium text-slate-800" : "text-slate-400"
                    }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 ${done ? "bg-brand-blue" : "bg-border-subtle"
                    }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
