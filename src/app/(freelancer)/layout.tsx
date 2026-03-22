"use client";

import { FreelancerAppShell } from "@/components/layout/freelancer-app-shell";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function FreelancerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard roles={["FREELANCE_USER", "ADMIN"]}>
      <OnboardingGate mode="freelancer">
        <ErrorBoundary>
          <FreelancerAppShell>{children}</FreelancerAppShell>
        </ErrorBoundary>
      </OnboardingGate>
    </RoleGuard>
  );
}
