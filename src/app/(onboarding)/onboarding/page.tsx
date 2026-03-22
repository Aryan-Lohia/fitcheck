"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileWizard } from "@/components/profile/ProfileWizard";
import { FeaturesIntro } from "@/components/onboarding/FeaturesIntro";
import { safeInternalNextPath } from "@/lib/auth/safe-next-path";
import { useAuth } from "@/hooks/use-auth";

type ProfilePayload = {
  profile: {
    onboardingProfileCompletedAt?: string | null;
    onboardingFeaturesSeenAt?: string | null;
  } | null;
};

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const safeNext = safeInternalNextPath(nextRaw);
  const { user, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== "FREELANCE_USER") return;
    const q = new URLSearchParams({ onboarding: "1" });
    if (safeNext) q.set("next", safeNext);
    router.replace(`/freelancer/profile?${q.toString()}`);
  }, [authLoading, user, router, safeNext]);

  const { data: profileRes, isLoading: profileLoading } = useQuery<ProfilePayload>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!user && user.role !== "FREELANCE_USER",
  });

  const defaultDest = useMemo(() => {
    if (user?.role === "ADMIN") return "/admin";
    if (user?.role === "FREELANCE_USER") return "/freelancer/dashboard";
    return "/dashboard";
  }, [user?.role]);

  const p = profileRes?.profile;

  useEffect(() => {
    if (authLoading || profileLoading || !p || !user) return;
    if (p.onboardingProfileCompletedAt && p.onboardingFeaturesSeenAt) {
      router.replace(safeNext || defaultDest);
    }
  }, [
    authLoading,
    profileLoading,
    p,
    user,
    router,
    safeNext,
    defaultDest,
  ]);

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (user.role === "FREELANCE_USER") {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (!p) {
    return (
      <p className="text-center text-sm text-text-muted">
        Could not load your profile. Please refresh the page.
      </p>
    );
  }

  if (p.onboardingProfileCompletedAt && p.onboardingFeaturesSeenAt) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (!p.onboardingProfileCompletedAt) {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className="text-center text-xl font-semibold tracking-tight text-text-primary">
          Set up your profile
        </h1>
        <p className="mt-2 text-center text-sm text-text-muted">
          A few quick steps so FitCheck can tailor fit checks and picks to you.
        </p>
        <div className="mt-8 flex-1">
          <ProfileWizard onboarding />
        </div>
      </div>
    );
  }

  return (
    <FeaturesIntro
      onComplete={async () => {
        const res = await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase: "features" }),
        });
        if (!res.ok) throw new Error("complete failed");
        await qc.refetchQueries({ queryKey: ["profile"] });
        router.replace(safeNext || defaultDest);
      }}
    />
  );
}

export default function OnboardingPage() {
  return <OnboardingContent />;
}
