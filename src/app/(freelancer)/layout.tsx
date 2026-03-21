"use client";

import { FreelancerAppShell } from "@/components/layout/freelancer-app-shell";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function FreelancerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard roles={["FREELANCE_USER", "ADMIN"]}>
      <ErrorBoundary>
        <FreelancerAppShell>{children}</FreelancerAppShell>
      </ErrorBoundary>
    </RoleGuard>
  );
}
