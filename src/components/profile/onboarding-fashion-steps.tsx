"use client";

import type { FashionProfile } from "@/lib/profile/fashion-profile";
import {
  ANNUAL_SPEND_OPTIONS,
  BODY_SHAPE_OPTIONS,
  cmToLinearIn,
  FAST_FASHION_BRANDS,
  linearInToCm,
  LUXURY_BRANDS,
  ONBOARDING_STYLE_OPTIONS,
  PREMIUM_BRANDS,
} from "@/lib/profile/fashion-profile";
import { SkinTonePicker } from "./SkinTonePicker";

type ProfileFormState = {
  gender: string;
  skinTone: string;
  preferredFit: "slim" | "regular" | "oversized" | "tailored";
  preferredStyle: string[];
  measurements: Record<string, number | undefined>;
};

const AGE_OPTIONS = [
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const;

const chipBase =
  "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40";
const chipOff = "border-border-subtle bg-surface text-text-primary hover:border-brand-blue/40";
const chipOn = "border-brand-blue bg-brand-blue/10 text-brand-blue";

export function OnboardingFashionSteps(props: {
  step: number;
  form: ProfileFormState;
  fashion: FashionProfile;
  setDraft: React.Dispatch<React.SetStateAction<Partial<ProfileFormState>>>;
  patchFashion: (p: Partial<FashionProfile>) => void;
  setMeasurement: (key: string, raw: string) => void;
  photoSection: React.ReactNode | null;
}) {
  const {
    step,
    form,
    fashion,
    setDraft,
    patchFashion,
    setMeasurement,
    photoSection,
  } = props;

  const unit = fashion.heightDisplayUnit ?? "cm";

  const toggleBrand = (name: string) => {
    const cur = fashion.preferredBrands ?? [];
    const next = cur.includes(name)
      ? cur.filter((b) => b !== name)
      : [...cur, name];
    patchFashion({
      preferredBrands: next,
      brandMixDesignerAndFast: false,
    });
  };

  if (step === 0) {
    return (
      <section className="space-y-6 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">The basics</h3>
          <p className="mt-1 text-xs text-text-muted">
            We use this to tailor catalogs and fit defaults.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">What is your age?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AGE_OPTIONS.map((a) => {
              const on = fashion.ageRange === a;
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={on}
                  onClick={() => patchFashion({ ageRange: a })}
                  className={`${chipBase} ${on ? chipOn : chipOff}`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">
            Which department do you browse?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-pressed={fashion.browseDepartment === "women"}
              onClick={() => {
                patchFashion({ browseDepartment: "women" });
                setDraft((d) => ({ ...d, gender: "Female" }));
              }}
              className={`flex min-h-[120px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-3 py-6 text-center ${fashion.browseDepartment === "women"
                ? "border-brand-blue bg-brand-blue/8"
                : "border-border-subtle bg-surface-muted hover:border-brand-blue/35"
                }`}
            >
              <span className="text-3xl" aria-hidden>
                👗
              </span>
              <span className="mt-2 text-sm font-semibold text-text-primary">
                Women
              </span>
            </button>
            <button
              type="button"
              aria-pressed={fashion.browseDepartment === "men"}
              onClick={() => {
                patchFashion({ browseDepartment: "men" });
                setDraft((d) => ({ ...d, gender: "Male" }));
              }}
              className={`flex min-h-[120px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-3 py-6 text-center ${fashion.browseDepartment === "men"
                ? "border-brand-blue bg-brand-blue/8"
                : "border-border-subtle bg-surface-muted hover:border-brand-blue/35"
                }`}
            >
              <span className="text-3xl" aria-hidden>
                👔
              </span>
              <span className="mt-2 text-sm font-semibold text-text-primary">Men</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (step === 1) {
    return (
      <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Style profile</h3>
          <p className="mt-1 text-xs text-text-muted">
            Choose any that feel like you — tap again to remove.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ONBOARDING_STYLE_OPTIONS.map((style) => {
            const active = form.preferredStyle.includes(style);
            return (
              <button
                key={style}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setDraft((d) => {
                    const cur = d.preferredStyle ?? form.preferredStyle;
                    const next = cur.includes(style)
                      ? cur.filter((s) => s !== style)
                      : [...cur, style];
                    return { ...d, preferredStyle: next };
                  })
                }
                className={`min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40 ${active
                  ? "bg-brand-accent text-white shadow-sm"
                  : "bg-surface-muted text-text-primary hover:bg-brand-warm/20"
                  }`}
              >
                {style}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (step === 2) {
    return (
      <section className="space-y-6 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Brand & shopping habits
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Select brands you actually shop — or choose the mix option.
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Fast fashion
          </p>
          <div className="flex flex-wrap gap-2">
            {FAST_FASHION_BRANDS.map((b) => {
              const active = (fashion.preferredBrands ?? []).includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleBrand(b)}
                  className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold ${active ? chipOn : chipOff}`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Premium
          </p>
          <div className="flex flex-wrap gap-2">
            {PREMIUM_BRANDS.map((b) => {
              const active = (fashion.preferredBrands ?? []).includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleBrand(b)}
                  className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold ${active ? chipOn : chipOff}`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Luxury
          </p>
          <div className="flex flex-wrap gap-2">
            {LUXURY_BRANDS.map((b) => {
              const active = (fashion.preferredBrands ?? []).includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleBrand(b)}
                  className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold ${active ? chipOn : chipOff}`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          aria-pressed={fashion.brandMixDesignerAndFast === true}
          onClick={() =>
            patchFashion({
              brandMixDesignerAndFast: true,
              preferredBrands: [],
            })
          }
          className={`w-full ${chipBase} ${fashion.brandMixDesignerAndFast ? chipOn : chipOff}`}
        >
          Mix of fast fashion & designer brands
        </button>
        <div>
          <label
            htmlFor="onb-spend"
            className="text-xs font-medium text-text-muted"
          >
            Roughly how much do you spend on clothes per year?
          </label>
          <select
            id="onb-spend"
            value={fashion.annualClothingSpend ?? ""}
            onChange={(e) =>
              patchFashion({
                annualClothingSpend: e.target.value || undefined,
              })
            }
            className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-sm text-text-primary focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/35"
          >
            <option value="">Select a range</option>
            {ANNUAL_SPEND_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">
            How often do you regret what you buy?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["rarely", "Rarely"],
                ["sometimes", "Sometimes"],
                ["often", "Often"],
                ["too_often", "Too often"],
              ] as const
            ).map(([key, label]) => {
              const on = fashion.purchaseRegret === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => patchFashion({ purchaseRegret: key })}
                  className={`${chipBase} ${on ? chipOn : chipOff}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (step === 3) {
    return (
      <section className="space-y-6 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Body & measurements
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Shape and height power virtual try-on and size suggestions.
          </p>
        </div>
        <div>
          <label
            htmlFor="onb-body-shape"
            className="text-xs font-medium text-text-muted"
          >
            Which body shape describes you?
          </label>
          <select
            id="onb-body-shape"
            value={fashion.bodyShape ?? ""}
            onChange={(e) =>
              patchFashion({ bodyShape: e.target.value || undefined })
            }
            className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/35"
          >
            <option value="">Select</option>
            {BODY_SHAPE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">
            Measurement units (height &amp; body)
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Values are saved in centimeters; switch to type in inches everywhere below.
          </p>
          <div className="mt-2 inline-flex rounded-lg border border-border-subtle p-0.5">
            <button
              type="button"
              aria-pressed={unit === "cm"}
              onClick={() => patchFashion({ heightDisplayUnit: "cm" })}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${unit === "cm" ? "bg-brand-blue text-white" : "text-text-muted"
                }`}
            >
              cm
            </button>
            <button
              type="button"
              aria-pressed={unit === "inch"}
              onClick={() => patchFashion({ heightDisplayUnit: "inch" })}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${unit === "inch" ? "bg-brand-blue text-white" : "text-text-muted"
                }`}
            >
              in
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">Height</p>
          {unit === "cm" ? (
            <div className="mt-3">
              <label htmlFor="onb-h-cm" className="sr-only">
                Height cm
              </label>
              <input
                id="onb-h-cm"
                type="number"
                min={100}
                max={250}
                step={0.1}
                placeholder="e.g. 170"
                value={form.measurements.heightCm ?? ""}
                onChange={(e) => setMeasurement("heightCm", e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/35"
              />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="onb-h-ft" className="mb-1 block text-xs text-text-muted">
                  Feet
                </label>
                <input
                  id="onb-h-ft"
                  type="number"
                  min={3}
                  max={8}
                  step={1}
                  value={
                    fashion.heightFeet != null ? String(fashion.heightFeet) : ""
                  }
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    patchFashion({
                      heightFeet: Number.isFinite(n) ? n : undefined,
                    });
                  }}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="onb-h-in" className="mb-1 block text-xs text-text-muted">
                  Inches
                </label>
                <input
                  id="onb-h-in"
                  type="number"
                  min={0}
                  max={11.99}
                  step={0.1}
                  value={
                    fashion.heightInchesRemainder != null
                      ? String(fashion.heightInchesRemainder)
                      : ""
                  }
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    patchFashion({
                      heightInchesRemainder: Number.isFinite(n)
                        ? n
                        : undefined,
                    });
                  }}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">
            Other measurements (optional but helpful)
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["chestCm", "Chest"],
                ["waistCm", "Waist"],
                ["hipCm", "Hip"],
                ["shoulderCm", "Shoulder"],
                ["sleeveCm", "Sleeve"],
                ["inseamCm", "Inseam"],
              ] as const
            ).map(([key, labelBase]) => {
              const cmVal = form.measurements[key];
              const display =
                unit === "inch" &&
                  typeof cmVal === "number" &&
                  Number.isFinite(cmVal) &&
                  cmVal > 0
                  ? cmToLinearIn(cmVal)
                  : cmVal ?? "";
              const suffix = unit === "inch" ? " (in)" : " (cm)";
              return (
                <div key={key}>
                  <label
                    htmlFor={`onb-m2-${key}`}
                    className="mb-1 block text-xs font-medium text-text-muted"
                  >
                    {labelBase}
                    {suffix}
                  </label>
                  <input
                    id={`onb-m2-${key}`}
                    type="number"
                    min={unit === "inch" ? 0.5 : 1}
                    max={unit === "inch" ? 120 : 300}
                    step={0.1}
                    value={display === "" ? "" : display}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const num = Number(raw);
                      if (!Number.isFinite(num) || num <= 0) {
                        setMeasurement(key, "");
                        return;
                      }
                      if (unit === "inch") {
                        setMeasurement(key, String(linearInToCm(num)));
                      } else {
                        setMeasurement(key, raw);
                      }
                    }}
                    className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (step === 4) {
    return (
      <section className="space-y-6 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Wardrobe audit</h3>
          <p className="mt-1 text-xs text-text-muted">
            Honest answers help us give better outfit advice.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">
            How would you describe your wardrobe?
          </p>
          <div className="mt-2 space-y-2">
            {(
              [
                ["works_want_ideas", "It works, but I want fresh ideas."],
                ["nothing_to_wear", "Full of clothes, nothing to wear."],
                ["not_me_anymore", `Some items don't feel "me" anymore.`],
                ["nothing_fits", "Nothing fits the way it used to."],
              ] as const
            ).map(([key, label]) => {
              const on = fashion.wardrobeDescription === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => patchFashion({ wardrobeDescription: key })}
                  className={`w-full text-left ${chipBase} ${on ? chipOn : chipOff}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">
            Do you have unworn items waiting for the &quot;right moment&quot;?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              aria-pressed={fashion.unwornItemsWaiting === true}
              onClick={() => patchFashion({ unwornItemsWaiting: true })}
              className={`${chipBase} flex-1 ${fashion.unwornItemsWaiting === true ? chipOn : chipOff}`}
            >
              Yes
            </button>
            <button
              type="button"
              aria-pressed={fashion.unwornItemsWaiting === false}
              onClick={() => patchFashion({ unwornItemsWaiting: false })}
              className={`${chipBase} flex-1 ${fashion.unwornItemsWaiting === false ? chipOn : chipOff}`}
            >
              No
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">
            How much of your wardrobe do you actually wear?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["lt_25", "Less than 25%"],
                ["around_50", "Around 50%"],
                ["gt_75", "More than 75%"],
                ["idk", "IDK"],
              ] as const
            ).map(([key, label]) => {
              const on = fashion.wardrobeWearPercent === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => patchFashion({ wardrobeWearPercent: key })}
                  className={`${chipBase} ${on ? chipOn : chipOff}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (step === 5) {
    return (
      <section className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Skin tone & fit
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Used for color recommendations and default garment ease.
          </p>
        </div>
        <SkinTonePicker
          value={form.skinTone}
          onChange={(value) => setDraft((p) => ({ ...p, skinTone: value }))}
        />
        <div>
          <label
            htmlFor="onb-fit2"
            className="mb-1 block text-xs font-medium text-text-muted"
          >
            Fit preference
          </label>
          <select
            id="onb-fit2"
            value={form.preferredFit}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                preferredFit: e.target.value as ProfileFormState["preferredFit"],
              }))
            }
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/35"
          >
            <option value="slim">Slim</option>
            <option value="regular">Regular</option>
            <option value="oversized">Oversized</option>
            <option value="tailored">Tailored</option>
          </select>
        </div>
      </section>
    );
  }

  if (step === 6) {
    if (!photoSection) return null;
    return (
      <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-text-primary">
          Front & back photos
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          Optional — add now or later from your profile for virtual try-on.
        </p>
        <div className="mt-4">{photoSection}</div>
      </section>
    );
  }

  return null;
}
