"use client";

const STYLE_TAGS = [
  "Casual",
  "Formal",
  "Streetwear",
  "Minimalist",
  "Bohemian",
  "Athletic",
  "Vintage",
  "Preppy",
  "Business",
  "Party",
];

interface StyleTagPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function StyleTagPicker({ selected, onChange }: StyleTagPickerProps) {
  function toggle(tag: string) {
    onChange(
      selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag],
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-primary">
        Pick your style preferences
      </p>
      <div className="flex flex-wrap gap-2">
        {STYLE_TAGS.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(tag)}
              className={`min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40 ${active
                  ? "bg-brand-accent text-white shadow-sm"
                  : "bg-surface-muted text-text-primary hover:bg-brand-warm/20"
                }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
