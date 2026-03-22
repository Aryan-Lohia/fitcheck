"use client";

import type { FashionProfile } from "@/lib/profile/fashion-profile";
import { OnboardingFashionSteps } from "./onboarding-fashion-steps";

type ProfileFormState = {
  gender: string;
  skinTone: string;
  preferredFit: "slim" | "regular" | "oversized" | "tailored";
  preferredStyle: string[];
  measurements: Record<string, number | undefined>;
};

const SECTIONS: Array<{ step: number; title: string }> = [
  { step: 0, title: "The basics" },
  { step: 1, title: "Style profile" },
  { step: 2, title: "Brand & shopping habits" },
  { step: 3, title: "Body & measurements" },
  { step: 4, title: "Wardrobe audit" },
];

export function FashionProfileAccordions(props: {
  form: ProfileFormState;
  fashion: FashionProfile;
  setDraft: React.Dispatch<React.SetStateAction<Partial<ProfileFormState>>>;
  patchFashion: (p: Partial<FashionProfile>) => void;
  setMeasurement: (key: string, raw: string) => void;
}) {
  const { form, fashion, setDraft, patchFashion, setMeasurement } = props;

  return (
    <>
      {SECTIONS.map(({ step, title }) => (
        <details
          key={step}
          className="rounded-xl border border-border-subtle bg-surface shadow-sm [&_summary::-webkit-details-marker]:hidden [&[open]>summary>svg]:rotate-180"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-focus/40">
            <span>{title}</span>
            <svg
              className="h-5 w-5 shrink-0 text-text-muted transition-transform duration-200"
              aria-hidden
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </svg>
          </summary>
          <div className="border-t border-border-subtle px-4 pb-4 pt-4 [&_section]:rounded-none [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-0 [&_section]:shadow-none">
            <OnboardingFashionSteps
              step={step}
              form={form}
              fashion={fashion}
              setDraft={setDraft}
              patchFashion={patchFashion}
              setMeasurement={setMeasurement}
              photoSection={null}
            />
          </div>
        </details>
      ))}
    </>
  );
}
