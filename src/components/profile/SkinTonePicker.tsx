"use client";

const SKIN_TONES = [
  "#FDDBB4",
  "#F1C27D",
  "#E0AC69",
  "#C68642",
  "#8D5524",
  "#6B3A20",
  "#3C1F0E",
  "#2C1507",
];

interface SkinTonePickerProps {
  value: string;
  onChange: (tone: string) => void;
}

export function SkinTonePicker({ value, onChange }: SkinTonePickerProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-primary">Select your skin tone</p>
      <div className="flex flex-wrap gap-3 justify-center">
        {SKIN_TONES.map((tone) => {
          const selected = value === tone;
          return (
            <button
              key={tone}
              type="button"
              aria-label={`Skin tone ${tone}`}
              aria-pressed={selected}
              onClick={() => onChange(tone)}
              className={`h-12 w-12 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 ${selected
                  ? "scale-110 border-brand-blue ring-2 ring-brand-blue ring-offset-2"
                  : "border-border-subtle hover:scale-105 hover:border-brand-blue/50"
                }`}
              style={{ backgroundColor: tone }}
            />
          );
        })}
      </div>
    </div>
  );
}
