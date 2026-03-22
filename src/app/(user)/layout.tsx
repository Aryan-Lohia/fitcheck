"use client";

import { UserAppShell } from "@/components/layout/user-app-shell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <OnboardingGate>
        <ErrorBoundary>
          <UserAppShell>{children}</UserAppShell>
        </ErrorBoundary>
      </OnboardingGate>
    </ProtectedRoute>
  );
}
