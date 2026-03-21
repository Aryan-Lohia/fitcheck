"use client";

import { ProfileWizard } from "@/components/profile/ProfileWizard";

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-text-primary">
        Profile
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Your account and fit preferences — expand sections below to edit.
      </p>
      <div className="mt-6">
        <ProfileWizard />
      </div>
    </main>
  );
}
