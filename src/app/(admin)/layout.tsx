"use client";

import { RoleGuard } from "@/components/layout/RoleGuard";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard roles={["ADMIN"]}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </RoleGuard>
  );
}
