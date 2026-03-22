"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cmToLinearIn,
  DEFAULT_FASHION_PROFILE,
  type FashionProfile,
  fashionProfileSchema,
  inchesTotalToCm,
  linearInToCm,
} from "@/lib/profile/fashion-profile";
import { calculateProfileCompletionFromFields } from "@/lib/validators/profile";
import { FashionProfileAccordions } from "./FashionProfileAccordions";
import { OnboardingFashionSteps } from "./onboarding-fashion-steps";
import { SkinTonePicker } from "./SkinTonePicker";
import { StyleTagPicker } from "./StyleTagPicker";
import { cn } from "@/lib/utils";
import { uploadUserMediaPhoto } from "@/lib/media/client-upload-photo";
import { profileMediaImageUrl } from "@/lib/media/profile-media-image-url";
import { parseTryOnReferenceMediaIds } from "@/lib/profile/try-on-reference-media";

type ProfileResponse = {
  profile: {
    gender?: string | null;
    skinTone?: string | null;
    preferredFit?: string | null;
    preferredStyle?: string[] | null;
    preferredColors?: unknown;
    measurements?: Record<string, number | undefined> | null;
    measurementsJson?: {
      versions?: Array<{ values?: Record<string, number | undefined> }>;
    } | null;
    profileCompletion?: number | null;
    onboardingProfileCompletedAt?: string | null;
    onboardingFeaturesSeenAt?: string | null;
    fashionProfileJson?: unknown;
  } | null;
  user?: {
    name: string;
    email: string;
    createdAt: string;
  } | null;
};

type MediaItem = {
  id: string;
  fileName: string;
  createdAt: string;
  category: string;
  mimeType?: string;
};

type ProfileFormState = {
  gender: string;
  skinTone: string;
  preferredFit: "slim" | "regular" | "oversized" | "tailored";
  preferredStyle: string[];
  measurements: Record<string, number | undefined>;
};

const DEFAULT_FORM: ProfileFormState = {
  gender: "",
  skinTone: "",
  preferredFit: "regular",
  preferredStyle: [],
  measurements: {},
};

const MEASUREMENT_FIELDS: Array<{ key: string; label: string }> = [
  { key: "heightCm", label: "Height" },
  { key: "chestCm", label: "Chest" },
  { key: "waistCm", label: "Waist" },
  { key: "hipCm", label: "Hip" },
  { key: "shoulderCm", label: "Shoulder" },
  { key: "sleeveCm", label: "Sleeve" },
  { key: "inseamCm", label: "Inseam" },
];

const BODY_LINEAR_FIELDS = MEASUREMENT_FIELDS.filter((f) => f.key !== "heightCm");

function parseFashionFromDb(raw: unknown): FashionProfile {
  const r = fashionProfileSchema.safeParse(raw);
  return r.success
    ? { ...DEFAULT_FASHION_PROFILE, ...r.data }
    : { ...DEFAULT_FASHION_PROFILE };
}

function validateOnboardingStep(
  step: number,
  form: ProfileFormState,
  fashion: FashionProfile,
): string | null {
  if (step === 0) {
    if (!fashion.ageRange) return "Select your age range.";
    if (!fashion.browseDepartment) return "Choose Women or Men.";
    return null;
  }
  if (step === 1) {
    if (!form.preferredStyle.length) return "Pick at least one style.";
    return null;
  }
  if (step === 2) {
    const hasBrands =
      fashion.brandMixDesignerAndFast === true ||
      (fashion.preferredBrands?.length ?? 0) > 0;
    if (!hasBrands) return "Select brands or the mix option.";
    if (!fashion.annualClothingSpend?.trim())
      return "Select how much you spend on clothes per year.";
    if (!fashion.purchaseRegret) return "Tell us how often you regret purchases.";
    return null;
  }
  if (step === 3) {
    if (!fashion.bodyShape?.trim()) return "Select a body shape.";
    const unit = fashion.heightDisplayUnit ?? "cm";
    if (unit === "cm") {
      const h = form.measurements.heightCm;
      if (!(typeof h === "number" && h >= 100 && h <= 250)) {
        return "Enter your height in cm (100–250).";
      }
    } else {
      const f = fashion.heightFeet;
      const inch = fashion.heightInchesRemainder;
      if (!(typeof f === "number" && f >= 3 && f <= 8)) {
        return "Enter feet (3–8).";
      }
      if (!(typeof inch === "number" && inch >= 0 && inch < 12)) {
        return "Enter inches (0–11.99).";
      }
    }
    return null;
  }
  if (step === 4) {
    if (!fashion.wardrobeDescription) return "How would you describe your wardrobe?";
    if (fashion.unwornItemsWaiting === undefined) {
      return "Let us know about unworn pieces.";
    }
    if (!fashion.wardrobeWearPercent) return "Pick how much of your wardrobe you wear.";
    return null;
  }
  if (step === 5) {
    if (!form.skinTone) return "Choose a skin tone to continue.";
    return null;
  }
  return null;
}

function displayInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

export function ProfileWizard(props?: {
  onboarding?: boolean;
  onProfileOnboardingComplete?: () => void;
}) {
  const onboarding = props?.onboarding ?? false;
  const onProfileOnboardingComplete = props?.onProfileOnboardingComplete;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<ProfileFormState>>({});
  const [fashionDraft, setFashionDraft] = useState<Partial<FashionProfile>>({});
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const lastSavedPayloadRef = useRef<string>("");
  const [refSlots, setRefSlots] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [refsHydrated, setRefsHydrated] = useState(false);
  const [refVaultOpen, setRefVaultOpen] = useState(false);
  const [refActivePick, setRefActivePick] = useState<0 | 1>(0);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  const { data: profileRes, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return (await res.json()) as ProfileResponse;
    },
  });

  const baseFashion = useMemo(
    () => parseFashionFromDb(profileRes?.profile?.fashionProfileJson),
    [profileRes?.profile?.fashionProfileJson],
  );

  const patchFashion = useCallback((p: Partial<FashionProfile>) => {
    setFashionDraft((prev) => ({ ...prev, ...p }));
  }, []);

  const { data: mediaRes } = useQuery({
    queryKey: ["profile-media-photos"],
    queryFn: async () => {
      const res = await fetch("/api/profile/media?category=photos");
      if (!res.ok) throw new Error("Failed to load photos");
      return (await res.json()) as { media: MediaItem[] };
    },
    enabled: !onboarding || onboardingStep === 6,
  });

  useEffect(() => {
    if (!mediaRes?.media || !profileRes || refsHydrated) return;
    const fromFashion = parseTryOnReferenceMediaIds(
      profileRes.profile?.fashionProfileJson,
    );
    if (fromFashion.length) {
      setRefSlots([fromFashion[0] ?? null, fromFashion[1] ?? null]);
    } else {
      const photos = mediaRes.media;
      const f = photos.find((p) =>
        p.fileName.toLowerCase().startsWith("front-"),
      );
      const b = photos.find((p) =>
        p.fileName.toLowerCase().startsWith("back-"),
      );
      setRefSlots([f?.id ?? null, b?.id ?? null]);
    }
    setRefsHydrated(true);
  }, [mediaRes, profileRes, refsHydrated]);

  const fashion = useMemo(() => {
    const base = {
      ...DEFAULT_FASHION_PROFILE,
      ...baseFashion,
      ...fashionDraft,
    };
    if (!refsHydrated) return base;
    const ids = [refSlots[0], refSlots[1]].filter((x): x is string =>
      Boolean(x),
    );
    return { ...base, tryOnReferenceMediaIds: ids };
  }, [baseFashion, fashionDraft, refSlots, refsHydrated]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      form: ProfileFormState;
      fashion: FashionProfile;
    }) => {
      const cleaned: Record<string, number> = {};
      for (const [k, v] of Object.entries(payload.form.measurements)) {
        if (typeof v === "number" && Number.isFinite(v) && v > 0) {
          cleaned[k] = v;
        }
      }
      const unit = payload.fashion.heightDisplayUnit ?? "cm";
      if (
        unit === "inch" &&
        payload.fashion.heightFeet != null &&
        payload.fashion.heightInchesRemainder != null
      ) {
        const h = inchesTotalToCm(
          payload.fashion.heightFeet,
          payload.fashion.heightInchesRemainder,
        );
        if (Number.isFinite(h) && h > 0) cleaned.heightCm = h;
      }
      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: payload.form.gender || undefined,
          skinTone: payload.form.skinTone || undefined,
          preferredFit: payload.form.preferredFit,
          preferredStyle: payload.form.preferredStyle,
          fashionProfile: payload.fashion,
          ...(Object.keys(cleaned).length > 0 ? { measurements: cleaned } : {}),
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          typeof errBody?.error === "string" && errBody.error.trim()
            ? errBody.error
            : `Save failed (${res.status})`,
        );
      }
      return res.json();
    },
    onSuccess: (data) => {
      const next = data as ProfileResponse;
      qc.setQueryData<ProfileResponse>(["profile"], (prev) => ({
        ...prev,
        ...next,
        user: prev?.user ?? next.user,
      }));
      setDraft({});
      setFashionDraft({});
    },
  });

  const uploadRefPhoto = useCallback(
    async (file: File, slot: 0 | 1) => {
      setPhotoUploadError(null);
      setPhotoUploading(true);
      try {
        const { mediaId } = await uploadUserMediaPhoto(file, {
          category: "photos",
        });
        setRefSlots((prev) => {
          const next: [string | null, string | null] = [...prev];
          next[slot] = mediaId;
          return next;
        });
        await qc.invalidateQueries({ queryKey: ["profile-media-photos"] });
        await qc.invalidateQueries({ queryKey: ["media"] });
      } catch (e) {
        setPhotoUploadError(
          e instanceof Error ? e.message : "Upload failed",
        );
      } finally {
        setPhotoUploading(false);
      }
    },
    [qc],
  );

  const baseForm = useMemo<ProfileFormState>(() => {
    const p = profileRes?.profile;
    if (!p) return DEFAULT_FORM;
    const latestFromVersions = p.measurementsJson?.versions?.at(-1)?.values ?? {};
    const measurements = (p.measurements ?? latestFromVersions ?? {}) as Record<
      string,
      number | undefined
    >;
    return {
      gender: p.gender ?? "",
      skinTone: p.skinTone ?? "",
      preferredFit:
        (p.preferredFit as ProfileFormState["preferredFit"] | undefined) ??
        "regular",
      preferredStyle: Array.isArray(p.preferredStyle) ? p.preferredStyle : [],
      measurements,
    };
  }, [profileRes?.profile]);

  const form = useMemo<ProfileFormState>(() => {
    const mergedMeasurements = {
      ...baseForm.measurements,
      ...(draft.measurements ?? {}),
    };
    return {
      gender: draft.gender ?? baseForm.gender,
      skinTone: draft.skinTone ?? baseForm.skinTone,
      preferredFit: draft.preferredFit ?? baseForm.preferredFit,
      preferredStyle: draft.preferredStyle ?? baseForm.preferredStyle,
      measurements: mergedMeasurements,
    };
  }, [baseForm, draft]);
  const saveBundle = useMemo(() => ({ form, fashion }), [form, fashion]);
  const serializedSave = useMemo(() => JSON.stringify(saveBundle), [saveBundle]);

  useEffect(() => {
    if (onboarding) return;
    if (
      Object.keys(draft).length === 0 &&
      Object.keys(fashionDraft).length === 0
    ) {
      return;
    }
    if (saveMutation.isPending) return;
    if (serializedSave === lastSavedPayloadRef.current) return;
    const timer = setTimeout(() => {
      lastSavedPayloadRef.current = serializedSave;
      saveMutation.mutate(saveBundle);
    }, 450);
    return () => clearTimeout(timer);
  }, [
    onboarding,
    draft,
    fashionDraft,
    saveBundle,
    serializedSave,
    saveMutation,
  ]);

  const completion = useMemo(() => {
    const p = profileRes?.profile;
    const preferredColors = Array.isArray(p?.preferredColors)
      ? (p.preferredColors as string[])
      : null;
    return calculateProfileCompletionFromFields({
      gender: form.gender,
      skinTone: form.skinTone,
      preferredFit: form.preferredFit,
      preferredStyle: form.preferredStyle,
      preferredColors,
      measurements: form.measurements,
    });
  }, [profileRes?.profile, form]);

  const accountUser = profileRes?.user;
  const displayName = accountUser?.name?.trim() || "Your profile";
  const memberSince = accountUser?.createdAt
    ? new Date(accountUser.createdAt).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    })
    : null;

  const vaultImageItems = useMemo(() => {
    const items = mediaRes?.media ?? [];
    return items.filter((m) => {
      const mt = (m.mimeType ?? "").toLowerCase();
      if (mt.startsWith("image/")) return true;
      const ext = m.fileName.split(".").pop()?.toLowerCase();
      return (
        ext === "jpg" ||
        ext === "jpeg" ||
        ext === "png" ||
        ext === "webp" ||
        ext === "gif"
      );
    });
  }, [mediaRes?.media]);

  const tryOnRefSection = (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Choose one or two full-body photos from any angle (front, back, side, or
        three-quarter). They power fit checks and try-on — no fixed front/back
        labels.
      </p>
      <div className="flex flex-wrap gap-3">
        {([0, 1] as const).map((idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {idx === 0 ? "Reference 1" : "Reference 2 (opt.)"}
              </span>
              {refSlots[idx] ? (
                <button
                  type="button"
                  className="text-[9px] text-brand-primary hover:underline"
                  onClick={() =>
                    setRefSlots((prev) => {
                      const next: [string | null, string | null] = [...prev];
                      next[idx] = null;
                      return next;
                    })
                  }
                >
                  Clear
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setRefActivePick(idx);
                setRefVaultOpen(true);
              }}
              className={cn(
                "flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border-subtle bg-surface transition-colors hover:border-brand-blue/40",
                refSlots[idx] && "border-brand-warm/50",
              )}
            >
              {refSlots[idx] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileMediaImageUrl(refSlots[idx]!, "thumb")}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-1 text-center text-[10px] text-text-muted">
                  Choose
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRefVaultOpen((o) => !o)}
        className="text-xs font-medium text-brand-blue hover:underline"
      >
        {refVaultOpen ? "Hide vault" : "Browse vault"}
      </button>

      {refVaultOpen ? (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-brand-warm/30 bg-surface p-2 shadow-sm">
          <p className="mb-2 text-[10px] font-medium text-text-muted">
            Assigning to reference {refActivePick + 1} — tap a thumbnail or
            upload.
          </p>
          {vaultImageItems.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">
              No photos in vault yet. Upload below.
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
              {vaultImageItems.map((item) => {
                const active = refSlots.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRefSlots((prev) => {
                        const next: [string | null, string | null] = [...prev];
                        next[refActivePick] = item.id;
                        return next;
                      });
                    }}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-lg border-2 opacity-90 transition-colors hover:border-brand-accent hover:opacity-100",
                      active
                        ? "border-brand-accent ring-2 ring-brand-warm/40"
                        : "border-transparent",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profileMediaImageUrl(item.id, "thumb")}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-2 border-t border-border-subtle pt-2">
            <label
              className={cn(
                "relative flex min-h-11 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-subtle py-2 text-xs font-medium text-text-muted hover:bg-surface-muted",
                photoUploading &&
                "pointer-events-none cursor-not-allowed opacity-50",
              )}
            >
              <span className="pointer-events-none select-none">
                {photoUploading
                  ? "Uploading…"
                  : `Upload to reference ${refActivePick + 1}`}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                className="absolute inset-0 z-10 block h-full w-full min-h-11 cursor-pointer opacity-0"
                disabled={photoUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadRefPhoto(f, refActivePick);
                }}
              />
            </label>
          </div>
        </div>
      ) : null}

      {photoUploadError ? (
        <p className="text-xs text-brand-primary">{photoUploadError}</p>
      ) : null}
    </div>
  );

  const setMeasurement = (key: string, raw: string) => {
    const num = Number(raw);
    setDraft((prev) => ({
      ...prev,
      measurements: {
        ...(prev.measurements ?? {}),
        [key]: Number.isFinite(num) && num > 0 ? num : undefined,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  const ONBOARDING_STEPS = 7;

  if (onboarding) {
    const handleOnboardingContinue = async () => {
      setStepError(null);
      const err = validateOnboardingStep(onboardingStep, form, fashion);
      if (err) {
        setStepError(err);
        return;
      }
      try {
        await saveMutation.mutateAsync({ form, fashion });
      } catch (e) {
        setStepError(
          e instanceof Error
            ? e.message
            : "Could not save. Please try again.",
        );
        return;
      }
      if (onboardingStep < ONBOARDING_STEPS - 1) {
        setOnboardingStep((s) => s + 1);
        return;
      }
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "profile" }),
      });
      if (!res.ok) {
        setStepError("Could not finish this step. Please try again.");
        return;
      }
      await qc.refetchQueries({ queryKey: ["profile"] });
      onProfileOnboardingComplete?.();
    };

    const photoSection = tryOnRefSection;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-text-primary">
            Step {onboardingStep + 1} of {ONBOARDING_STEPS}
          </p>
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-5 rounded-full sm:w-6 ${i <= onboardingStep ? "bg-brand-blue" : "bg-border-subtle"
                  }`}
              />
            ))}
          </div>
        </div>

        {stepError ? (
          <p
            className="rounded-lg border border-brand-primary/25 bg-brand-primary/5 px-3 py-2 text-sm text-brand-primary"
            role="alert"
          >
            {stepError}
          </p>
        ) : null}

        <OnboardingFashionSteps
          step={onboardingStep}
          form={form}
          fashion={fashion}
          setDraft={setDraft}
          patchFashion={patchFashion}
          setMeasurement={setMeasurement}
          photoSection={photoSection}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setStepError(null);
              setOnboardingStep((s) => Math.max(0, s - 1));
            }}
            disabled={onboardingStep === 0 || saveMutation.isPending}
            className="rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-muted disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void handleOnboardingContinue()}
            disabled={
              saveMutation.isPending ||
              (onboardingStep === 6 && photoUploading)
            }
            className="min-h-11 rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-60"
          >
            {saveMutation.isPending
              ? "Saving…"
              : onboardingStep === ONBOARDING_STEPS - 1
                ? "Continue"
                : "Next"}
          </button>
        </div>
        <p className="text-center text-xs text-text-muted">
          {saveMutation.isPending
            ? "Saving…"
            : "Tap Next to save this step and continue."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="border-b border-border-subtle bg-gradient-to-br from-brand-warm/8 to-surface px-5 pb-5 pt-6">
          <div className="flex gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-blue text-lg font-semibold text-white"
              aria-hidden
            >
              {displayInitials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight text-text-primary">
                    {displayName}
                  </h2>
                  {accountUser?.email && (
                    <p className="mt-0.5 truncate text-sm text-text-muted">{accountUser.email}</p>
                  )}
                  {memberSince && (
                    <p className="mt-1 text-xs text-text-muted">Member since {memberSince}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-brand-blue/12 px-2.5 py-1 text-xs font-medium text-brand-blue">
                  {completion}% complete
                </span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border-subtle">
                <div
                  className="h-full rounded-full bg-brand-accent transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Personal details
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-gender" className="mb-1 block text-xs font-medium text-text-muted">
                Gender
              </label>
              <select
                id="profile-gender"
                value={form.gender}
                onChange={(e) => setDraft((p) => ({ ...p, gender: e.target.value }))}
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/35"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
              </select>
            </div>

            <div>
              <label htmlFor="profile-fit-pref" className="mb-1 block text-xs font-medium text-text-muted">
                Fit preference
              </label>
              <select
                id="profile-fit-pref"
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
          </div>
          <p className="mt-4 text-xs text-text-muted">
            {saveMutation.isPending ? "Saving changes…" : "Changes to preferences save automatically."}
          </p>
        </div>
      </section>

      <FashionProfileAccordions
        form={form}
        fashion={fashion}
        setDraft={setDraft}
        patchFashion={patchFashion}
        setMeasurement={setMeasurement}
      />

      <details className="rounded-xl border border-border-subtle bg-surface shadow-sm [&_summary::-webkit-details-marker]:hidden [&[open]>summary>svg]:rotate-180">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-focus/40">
          <span>Skin tone & style</span>
          <svg
            className="h-5 w-5 shrink-0 text-text-muted transition-transform duration-200"
            aria-hidden
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>
        <div className="space-y-4 border-t border-border-subtle px-4 pb-4 pt-4">
          <SkinTonePicker
            value={form.skinTone}
            onChange={(value) => setDraft((p) => ({ ...p, skinTone: value }))}
          />
          <StyleTagPicker
            selected={form.preferredStyle}
            onChange={(tags) => setDraft((p) => ({ ...p, preferredStyle: tags }))}
          />
        </div>
      </details>

      <details className="rounded-xl border border-border-subtle bg-surface shadow-sm [&_summary::-webkit-details-marker]:hidden [&[open]>summary>svg]:rotate-180">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-focus/40">
          <span>Measurements</span>
          <svg
            className="h-5 w-5 shrink-0 text-text-muted transition-transform duration-200"
            aria-hidden
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>
        <div className="space-y-4 border-t border-border-subtle px-4 pb-4 pt-4">
          {(() => {
            const bodyUnit = fashion.heightDisplayUnit ?? "cm";
            return (
              <>
                <div>
                  <p className="text-xs font-medium text-text-muted">
                    Units (height &amp; body)
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    Saved as centimeters; switch to type inches for every field below.
                  </p>
                  <div className="mt-2 inline-flex rounded-lg border border-border-subtle p-0.5">
                    <button
                      type="button"
                      aria-pressed={bodyUnit === "cm"}
                      onClick={() => patchFashion({ heightDisplayUnit: "cm" })}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${bodyUnit === "cm" ? "bg-brand-blue text-white" : "text-text-muted"}`}
                    >
                      cm
                    </button>
                    <button
                      type="button"
                      aria-pressed={bodyUnit === "inch"}
                      onClick={() => patchFashion({ heightDisplayUnit: "inch" })}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${bodyUnit === "inch" ? "bg-brand-blue text-white" : "text-text-muted"}`}
                    >
                      in
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="profile-m-heightCm"
                    className="mb-1 block text-xs font-medium text-text-muted"
                  >
                    Height {bodyUnit === "inch" ? "(ft / in)" : "(cm)"}
                  </label>
                  {bodyUnit === "cm" ? (
                    <input
                      id="profile-m-heightCm"
                      type="number"
                      min={100}
                      max={250}
                      step={0.1}
                      placeholder="e.g. 170"
                      value={form.measurements.heightCm ?? ""}
                      onChange={(e) => setMeasurement("heightCm", e.target.value)}
                      className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/35"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="profile-h-ft"
                          className="mb-1 block text-xs text-text-muted"
                        >
                          Feet
                        </label>
                        <input
                          id="profile-h-ft"
                          type="number"
                          min={3}
                          max={8}
                          step={1}
                          value={
                            fashion.heightFeet != null
                              ? String(fashion.heightFeet)
                              : ""
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
                        <label
                          htmlFor="profile-h-in"
                          className="mb-1 block text-xs text-text-muted"
                        >
                          Inches
                        </label>
                        <input
                          id="profile-h-in"
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
                <div className="grid gap-3 sm:grid-cols-2">
                  {BODY_LINEAR_FIELDS.map((field) => {
                    const cmVal = form.measurements[field.key];
                    const display =
                      bodyUnit === "inch" &&
                        typeof cmVal === "number" &&
                        Number.isFinite(cmVal) &&
                        cmVal > 0
                        ? cmToLinearIn(cmVal)
                        : cmVal ?? "";
                    const suffix = bodyUnit === "inch" ? " (in)" : " (cm)";
                    return (
                      <div key={field.key}>
                        <label
                          htmlFor={`profile-m-${field.key}`}
                          className="mb-1 block text-xs font-medium text-text-muted"
                        >
                          {field.label}
                          {suffix}
                        </label>
                        <input
                          id={`profile-m-${field.key}`}
                          type="number"
                          min={bodyUnit === "inch" ? 0.5 : 1}
                          max={bodyUnit === "inch" ? 120 : 300}
                          step={0.1}
                          value={display === "" ? "" : display}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = Number(raw);
                            if (!Number.isFinite(num) || num <= 0) {
                              setMeasurement(field.key, "");
                              return;
                            }
                            if (bodyUnit === "inch") {
                              setMeasurement(
                                field.key,
                                String(linearInToCm(num)),
                              );
                            } else {
                              setMeasurement(field.key, raw);
                            }
                          }}
                          className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/35"
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </details>

      <details className="rounded-xl border border-border-subtle bg-surface shadow-sm [&_summary::-webkit-details-marker]:hidden [&[open]>summary>svg]:rotate-180">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-focus/40">
          <span>Try-on reference photos</span>
          <svg
            className="h-5 w-5 shrink-0 text-text-muted transition-transform duration-200"
            aria-hidden
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>
        <div className="space-y-3 border-t border-border-subtle px-4 pb-4 pt-4">
          {tryOnRefSection}
        </div>
      </details>
    </div>
  );
}
