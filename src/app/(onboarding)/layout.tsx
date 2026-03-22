"use client";

import { Suspense } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <div className="min-h-screen bg-surface-muted">
          <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 md:px-6 md:py-12">
            <div className="flex justify-center">
              <BrandLogo priority variant="wordmark" />
            </div>
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
                </div>
              }
            >
              {children}
            </Suspense>
          </div>
        </div>
      </ErrorBoundary>
    </ProtectedRoute>
  );
}
