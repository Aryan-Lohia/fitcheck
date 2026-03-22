"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { freelancerNeedsProfileSetup } from "@/lib/freelancer/freelancer-needs-profile-setup";

type ProfilePayload = {
  profile: {
    onboardingProfileCompletedAt?: string | null;
    onboardingFeaturesSeenAt?: string | null;
  } | null;
};

type FreelancerProfilePayload = {
  profile: {
    verificationStatus: string;
  } | null;
};

type OnboardingGateProps = {
  children: React.ReactNode;
  /** `user`: consumer fit profile + features intro. `freelancer`: application profile until submitted. */
  mode?: "user" | "freelancer";
};

export function OnboardingGate({ children, mode = "user" }: OnboardingGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading: profileLoading } = useQuery<ProfilePayload>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!user && user.role !== "ADMIN" && mode === "user",
  });

  const { data: freelancerData, isLoading: freelancerProfileLoading } =
    useQuery<FreelancerProfilePayload>({
      queryKey: ["freelancer-profile"],
      queryFn: async () => {
        const res = await fetch("/api/freelancer/profile");
        if (!res.ok) throw new Error("Failed to load freelancer profile");
        return res.json();
      },
      enabled: !!user && user.role === "FREELANCE_USER" && mode === "freelancer",
    });

  const p = data?.profile;
  const needsUserOnboarding = useMemo(
    () =>
      mode === "user" &&
      user?.role !== "ADMIN" &&
      !!p &&
      (!p.onboardingProfileCompletedAt || !p.onboardingFeaturesSeenAt),
    [mode, user?.role, p],
  );

  const needsFreelancerSetup = useMemo(() => {
    if (mode !== "freelancer" || user?.role !== "FREELANCE_USER") return false;
    return freelancerNeedsProfileSetup(freelancerData?.profile);
  }, [mode, user?.role, freelancerData?.profile]);

  const needsOnboarding = needsUserOnboarding || needsFreelancerSetup;

  useEffect(() => {
    if (authLoading || user?.role === "ADMIN") return;

    if (mode === "freelancer") {
      if (user?.role !== "FREELANCE_USER") return;
      if (freelancerProfileLoading || !needsFreelancerSetup) return;
      if (pathname === "/freelancer/profile") return;

      const returnTo =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : pathname;
      const q = new URLSearchParams({ onboarding: "1", next: returnTo });
      router.replace(`/freelancer/profile?${q.toString()}`);
      return;
    }

    if (profileLoading || !needsUserOnboarding) return;
    router.replace("/onboarding");
  }, [
    authLoading,
    user?.role,
    mode,
    freelancerProfileLoading,
    needsFreelancerSetup,
    needsUserOnboarding,
    profileLoading,
    pathname,
    router,
  ]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (user?.role === "ADMIN") {
    return <>{children}</>;
  }

  if (mode === "freelancer" && user?.role === "FREELANCE_USER") {
    if (freelancerProfileLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
        </div>
      );
    }
    if (needsFreelancerSetup && pathname !== "/freelancer/profile") {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
        </div>
      );
    }
    return <>{children}</>;
  }

  if (mode === "user" && profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (needsUserOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
