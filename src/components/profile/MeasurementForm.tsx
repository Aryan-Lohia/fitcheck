"use client";

const FIELDS = [
  { key: "height", label: "Height" },
  { key: "weight", label: "Weight" },
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "shoulder", label: "Shoulder" },
  { key: "sleeve", label: "Sleeve" },
  { key: "inseam", label: "Inseam" },
] as const;

interface MeasurementFormProps {
  values: Record<string, number | undefined>;
  onChange: (key: string, value: number) => void;
  unit: "cm" | "inch";
  onUnitChange: (u: "cm" | "inch") => void;
}

export function MeasurementForm({
  values,
  onChange,
  unit,
  onUnitChange,
}: MeasurementFormProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">Body measurements</p>
        <div className="flex overflow-hidden rounded-lg border border-border-subtle text-sm">
          <button
            type="button"
            onClick={() => onUnitChange("cm")}
            className={`min-h-9 px-3 py-1.5 transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40 ${unit === "cm"
                ? "bg-brand-accent text-white"
                : "bg-surface text-text-muted hover:bg-surface-muted"
              }`}
          >
            cm
          </button>
          <button
            type="button"
            onClick={() => onUnitChange("inch")}
            className={`min-h-9 px-3 py-1.5 transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40 ${unit === "inch"
                ? "bg-brand-accent text-white"
                : "bg-surface text-text-muted hover:bg-surface-muted"
              }`}
          >
            inch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label
              htmlFor={`m-${key}`}
              className="mb-1 block text-xs font-medium text-text-muted"
            >
              {label} ({unit})
            </label>
            <input
              id={`m-${key}`}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={values[key] ?? ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) onChange(key, v);
              }}
              placeholder="—"
              className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-[box-shadow,border-color] placeholder:text-text-muted/70 focus:border-brand-blue focus:ring-2 focus:ring-ring-focus/35"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
