"use client";

import { FreelancerHeader } from "@/components/layout/freelancer-header";

export function FreelancerAppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <FreelancerHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
