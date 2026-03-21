"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SkinTonePicker } from "./SkinTonePicker";
import { StyleTagPicker } from "./StyleTagPicker";

type ProfileResponse = {
  profile: {
    gender?: string | null;
    skinTone?: string | null;
    preferredFit?: string | null;
    preferredStyle?: string[] | null;
    measurements?: Record<string, number | undefined> | null;
    measurementsJson?: {
      versions?: Array<{ values?: Record<string, number | undefined> }>;
    } | null;
    profileCompletion?: number | null;
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
  { key: "heightCm", label: "Height (cm)" },
  { key: "chestCm", label: "Chest (cm)" },
  { key: "waistCm", label: "Waist (cm)" },
  { key: "hipCm", label: "Hip (cm)" },
  { key: "shoulderCm", label: "Shoulder (cm)" },
  { key: "sleeveCm", label: "Sleeve (cm)" },
  { key: "inseamCm", label: "Inseam (cm)" },
];

function computeCompletion(data: ProfileFormState): number {
  const checks = [
    Boolean(data.gender),
    Boolean(data.skinTone),
    Boolean(data.preferredFit),
    Object.values(data.measurements).some((v) => typeof v === "number"),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function displayInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

export function ProfileWizard() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<ProfileFormState>>({});
  const lastSavedPayloadRef = useRef<string>("");
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const { data: profileRes, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return (await res.json()) as ProfileResponse;
    },
  });

  const { data: mediaRes } = useQuery({
    queryKey: ["profile-media-photos"],
    queryFn: async () => {
      const res = await fetch("/api/profile/media?category=photos");
      if (!res.ok) throw new Error("Failed to load photos");
      return (await res.json()) as { media: MediaItem[] };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ProfileFormState) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: payload.gender || undefined,
          skinTone: payload.skinTone || undefined,
          preferredFit: payload.preferredFit,
          preferredStyle: payload.preferredStyle,
          measurements: payload.measurements,
        }),
      });
      if (!res.ok) throw new Error("Failed to save profile");
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
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (params: { file: File; kind: "front" | "back" }) => {
      const renamedFileName = `${params.kind}-${Date.now()}-${params.file.name}`;
      const presignRes = await fetch("/api/profile/media/presign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: renamedFileName,
          mimeType: params.file.type,
          sizeBytes: params.file.size,
          category: "photos",
        }),
      });
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to get upload URL");
      }
      const { uploadUrl, mediaId } = (await presignRes.json()) as {
        uploadUrl: string;
        mediaId: string;
      };

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": params.file.type },
        body: params.file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      const confirmRes = await fetch("/api/profile/media/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      });
      if (!confirmRes.ok) throw new Error("Upload confirmation failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-media-photos"] });
    },
  });

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
  const serializedForm = useMemo(() => JSON.stringify(form), [form]);

  useEffect(() => {
    if (Object.keys(draft).length === 0) return;
    if (saveMutation.isPending) return;
    if (serializedForm === lastSavedPayloadRef.current) return;
    const timer = setTimeout(() => {
      lastSavedPayloadRef.current = serializedForm;
      saveMutation.mutate(form);
    }, 450);
    return () => clearTimeout(timer);
  }, [draft, form, serializedForm, saveMutation]);

  const completion =
    profileRes?.profile?.profileCompletion ?? computeCompletion(form);

  const accountUser = profileRes?.user;
  const displayName = accountUser?.name?.trim() || "Your profile";
  const memberSince = accountUser?.createdAt
    ? new Date(accountUser.createdAt).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    })
    : null;

  const photos: MediaItem[] = mediaRes?.media ?? [];
  const frontPhoto = photos.find((p) =>
    p.fileName.toLowerCase().startsWith("front-"),
  );
  const backPhoto = photos.find((p) =>
    p.fileName.toLowerCase().startsWith("back-"),
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
        <div className="grid gap-3 border-t border-border-subtle px-4 pb-4 pt-4 sm:grid-cols-2">
          {MEASUREMENT_FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={`profile-m-${field.key}`} className="mb-1 block text-xs font-medium text-text-muted">
                {field.label}
              </label>
              <input
                id={`profile-m-${field.key}`}
                type="number"
                min={1}
                step="0.1"
                value={form.measurements[field.key] ?? ""}
                onChange={(e) => setMeasurement(field.key, e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/35"
              />
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-xl border border-border-subtle bg-surface shadow-sm [&_summary::-webkit-details-marker]:hidden [&[open]>summary>svg]:rotate-180">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-focus/40">
          <span>Front & back photos</span>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => frontInputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-border-subtle px-4 py-4 text-sm text-text-primary hover:border-brand-blue hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40"
            >
              Upload front photo
              <div className="mt-1 text-xs text-text-muted">
                {frontPhoto ? `Current: ${frontPhoto.fileName}` : "Not uploaded"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => backInputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-border-subtle px-4 py-4 text-sm text-text-primary hover:border-brand-blue hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40"
            >
              Upload back photo
              <div className="mt-1 text-xs text-text-muted">
                {backPhoto ? `Current: ${backPhoto.fileName}` : "Not uploaded"}
              </div>
            </button>
          </div>

          <input
            ref={frontInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate({ file, kind: "front" });
              e.currentTarget.value = "";
            }}
          />
          <input
            ref={backInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate({ file, kind: "back" });
              e.currentTarget.value = "";
            }}
          />

          {uploadMutation.isPending && (
            <p className="text-xs text-text-muted">Uploading image...</p>
          )}
          {uploadMutation.isError && (
            <p className="text-xs text-brand-primary">
              {uploadMutation.error instanceof Error
                ? uploadMutation.error.message
                : "Upload failed"}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
