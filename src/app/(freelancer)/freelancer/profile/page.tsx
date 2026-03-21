"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
interface FreelancerProfile {
  id: string;
  bio: string | null;
  portfolioLinksJson: string[] | null;
  pastWorkLinksJson: string[] | null;
  expertiseTagsJson: string[] | null;
  verificationStatus: string;
  verificationNotes: string | null;
}

const SPECIALIZATIONS = [
  "Styling",
  "Color Analysis",
  "Body Type",
  "Wardrobe Planning",
  "Shopping Assistance",
  "Fit Expert",
  "Bridal",
  "Casual Wear",
  "Formal Wear",
  "Sustainable Fashion",
];

const STATUS_STYLES: Record<string, string> = {
  draft: "border-border-subtle bg-surface-muted text-text-muted",
  submitted: "border-brand-warm/50 bg-brand-warm/15 text-text-primary",
  under_review: "border-brand-warm/50 bg-brand-warm/15 text-text-primary",
  needs_more_info: "border-brand-accent/40 bg-brand-accent/10 text-brand-accent",
  approved: "border-brand-blue/35 bg-brand-blue/8 text-brand-blue",
  rejected: "border-brand-primary/35 bg-brand-primary/8 text-brand-primary",
  suspended: "border-brand-primary/35 bg-brand-primary/8 text-brand-primary",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft — Not Submitted",
  submitted: "Submitted — Under Review",
  under_review: "Under Review",
  needs_more_info: "Needs More Info",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

async function fetchProfile(): Promise<{ profile: FreelancerProfile | null }> {
  const res = await fetch("/api/freelancer/profile");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

async function saveProfile(body: Record<string, unknown>) {
  const res = await fetch("/api/freelancer/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  return res.json();
}

export default function FreelancerProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["freelancer-profile"],
    queryFn: fetchProfile,
  });

  const profile = data?.profile;

  const [bio, setBio] = useState("");
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>([""]);
  const [pastWorkLinks, setPastWorkLinks] = useState<string[]>([""]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  if (profile && !hydrated) {
    setBio(profile.bio || "");
    setPortfolioLinks(
      profile.portfolioLinksJson?.length ? profile.portfolioLinksJson : [""],
    );
    setPastWorkLinks(
      profile.pastWorkLinksJson?.length ? profile.pastWorkLinksJson : [""],
    );
    setSelectedTags(profile.expertiseTagsJson || []);
    setHydrated(true);
  }

  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelancer-profile"] }),
  });

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const updateLink = (
    list: string[],
    setter: (v: string[]) => void,
    idx: number,
    val: string,
  ) => {
    const next = [...list];
    next[idx] = val;
    setter(next);
  };

  const addLink = (list: string[], setter: (v: string[]) => void) => {
    setter([...list, ""]);
  };

  const removeLink = (list: string[], setter: (v: string[]) => void, idx: number) => {
    setter(list.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const canResubmit =
      profile?.verificationStatus === "needs_more_info" ||
      profile?.verificationStatus === "rejected";

    mutation.mutate({
      bio,
      portfolioLinks: portfolioLinks.filter(Boolean),
      pastWorkLinks: pastWorkLinks.filter(Boolean),
      specializations: selectedTags,
      resubmit: canResubmit,
    });
  };

  const status = profile?.verificationStatus || "draft";
  const isLocked = status === "approved" || status === "suspended";

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl p-4 md:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-border-subtle" />
          <div className="h-40 rounded bg-border-subtle" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-4 md:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Profile &amp; Application</h1>

      {/* Status banner */}
      <div
        className={`mb-6 rounded-lg border p-4 ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}
      >
        <p className="text-sm font-medium">
          Application Status:{" "}
          <span className="font-semibold">{STATUS_LABEL[status] || status}</span>
        </p>
      </div>

      {/* Admin feedback */}
      {profile?.verificationNotes && (
        <div className="mb-6 rounded-lg border border-brand-blue/30 bg-brand-blue/8 p-4 text-sm text-brand-blue">
          <p className="font-semibold mb-1">Admin Feedback</p>
          <p>{profile.verificationNotes}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bio */}
        <label className="block">
          <span className="text-sm font-medium text-text-primary">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={isLocked}
            rows={4}
            className="mt-1 block w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/35 disabled:bg-surface-muted"
            placeholder="Tell clients about yourself..."
          />
        </label>

        {/* Portfolio Links */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-primary">
            Portfolio Links
          </legend>
          <div className="space-y-2">
            {portfolioLinks.map((link, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) =>
                    updateLink(portfolioLinks, setPortfolioLinks, i, e.target.value)
                  }
                  disabled={isLocked}
                  placeholder="https://..."
                  className="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/35 disabled:bg-surface-muted"
                />
                {portfolioLinks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLink(portfolioLinks, setPortfolioLinks, i)}
                    disabled={isLocked}
                    className="rounded-lg border border-brand-primary/30 px-3 py-2 text-sm text-brand-primary hover:bg-brand-primary/8 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isLocked && (
            <button
              type="button"
              onClick={() => addLink(portfolioLinks, setPortfolioLinks)}
              className="mt-2 text-sm text-brand-blue hover:underline"
            >
              + Add Link
            </button>
          )}
        </fieldset>

        {/* Past Work Links */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-primary">
            Past Work / Experience Links
          </legend>
          <div className="space-y-2">
            {pastWorkLinks.map((link, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) =>
                    updateLink(pastWorkLinks, setPastWorkLinks, i, e.target.value)
                  }
                  disabled={isLocked}
                  placeholder="https://..."
                  className="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/35 disabled:bg-surface-muted"
                />
                {pastWorkLinks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLink(pastWorkLinks, setPastWorkLinks, i)}
                    disabled={isLocked}
                    className="rounded-lg border border-brand-primary/30 px-3 py-2 text-sm text-brand-primary hover:bg-brand-primary/8 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isLocked && (
            <button
              type="button"
              onClick={() => addLink(pastWorkLinks, setPastWorkLinks)}
              className="mt-2 text-sm text-brand-blue hover:underline"
            >
              + Add Link
            </button>
          )}
        </fieldset>

        {/* Specialization Tags */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-primary">
            Specializations
          </legend>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATIONS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  disabled={isLocked}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active
                      ? "border-brand-accent bg-brand-accent text-white"
                      : "border-border-subtle bg-surface text-text-primary hover:bg-surface-muted"
                    } disabled:opacity-50`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Submit */}
        {!isLocked && (
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-brand-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accent/92 disabled:opacity-50"
          >
            {mutation.isPending
              ? "Saving..."
              : status === "needs_more_info" || status === "rejected"
                ? "Resubmit Application"
                : status === "draft"
                  ? "Submit Application"
                  : "Save Changes"}
          </button>
        )}

        {mutation.isSuccess && (
          <p className="text-sm text-brand-blue">Profile saved successfully.</p>
        )}
        {mutation.isError && (
          <p className="text-sm text-brand-primary">Failed to save. Please try again.</p>
        )}
      </form>
    </main>
  );
}
