"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type VerificationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_more_info"
  | "approved"
  | "rejected"
  | "suspended";

interface Freelancer {
  id: string;
  userId: string;
  bio: string | null;
  portfolioLinksJson: string[] | null;
  pastWorkLinksJson: string[] | null;
  expertiseTagsJson: string[] | null;
  verificationStatus: VerificationStatus;
  verificationNotes: string | null;
  approvedAt: string | null;
  user: { name: string; email: string; createdAt: string };
}

const statusTabs: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "submitted" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const statusColors: Record<string, string> = {
  draft: "bg-black/[0.06] text-black/65",
  submitted: "bg-brand-warm/20 text-brand-accent",
  under_review: "bg-brand-blue/15 text-brand-blue",
  needs_more_info: "bg-brand-warm/25 text-brand-accent",
  approved: "bg-brand-blue/12 text-brand-blue",
  rejected: "bg-brand-primary/12 text-brand-primary",
  suspended: "bg-brand-primary/15 text-brand-primary",
};

export default function AdminFreelancersPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{ id: string; action: "reject" | "request-info" } | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading, error } = useQuery<{ freelancers: Freelancer[] }>({
    queryKey: ["admin", "freelancers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/freelancers");
      if (!res.ok) throw new Error("Failed to load freelancers");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/freelancer/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Approve failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "freelancers"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes: n }: { id: string; notes: string }) => {
      const res = await fetch(`/api/admin/freelancer/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: n }),
      });
      if (!res.ok) throw new Error("Reject failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "freelancers"] });
      setNotesModal(null);
      setNotes("");
    },
  });

  const requestInfoMutation = useMutation({
    mutationFn: async ({ id, notes: n }: { id: string; notes: string }) => {
      const res = await fetch(`/api/admin/freelancer/${id}/request-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: n }),
      });
      if (!res.ok) throw new Error("Request info failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "freelancers"] });
      setNotesModal(null);
      setNotes("");
    },
  });

  const filtered =
    tab === "all"
      ? data?.freelancers
      : data?.freelancers.filter((f) => f.verificationStatus === tab);

  function handleNotesSubmit() {
    if (!notesModal) return;
    if (notesModal.action === "reject") {
      rejectMutation.mutate({ id: notesModal.id, notes });
    } else {
      requestInfoMutation.mutate({ id: notesModal.id, notes });
    }
  }

  if (error) {
    return <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-brand-primary">Failed to load freelancers.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Freelancers</h1>
      <p className="mb-4 mt-1 text-sm text-text-muted">
        {data ? `${data.freelancers.length} total` : "Loading..."}
      </p>

      <div className="mb-4 flex gap-2">
        {statusTabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.value ? "bg-text-primary text-white" : "bg-black/[0.06] text-black/65 hover:bg-black/[0.08]"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-black/[0.06]" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-surface-muted text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Specializations</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered?.map((f) => (
                  <FreelancerRow
                    key={f.id}
                    f={f}
                    expanded={expanded === f.id}
                    onToggle={() => setExpanded(expanded === f.id ? null : f.id)}
                    onApprove={() => approveMutation.mutate(f.id)}
                    onReject={() => { setNotesModal({ id: f.id, action: "reject" }); setNotes(""); }}
                    onRequestInfo={() => { setNotesModal({ id: f.id, action: "request-info" }); setNotes(""); }}
                    isPending={approveMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered?.map((f) => (
              <div key={f.id} className="rounded-lg border bg-surface p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{f.user.name}</p>
                    <p className="text-xs text-text-muted">{f.user.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[f.verificationStatus]}`}>
                    {f.verificationStatus}
                  </span>
                </div>
                {f.expertiseTagsJson && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(f.expertiseTagsJson as string[]).map((tag) => (
                      <span key={tag} className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {(f.verificationStatus === "submitted" || f.verificationStatus === "under_review") && (
                    <>
                      <button
                        onClick={() => approveMutation.mutate(f.id)}
                        className="rounded bg-brand-blue px-3 py-1 text-xs text-white hover:bg-brand-blue/90"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setNotesModal({ id: f.id, action: "reject" });
                          setNotes("");
                        }}
                        className="rounded bg-brand-primary px-3 py-1 text-xs text-white hover:bg-brand-primary/92"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filtered?.length === 0 && (
            <p className="mt-4 text-center text-sm text-text-muted">No freelancers in this category.</p>
          )}
        </>
      )}

      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">
              {notesModal.action === "reject" ? "Reject Freelancer" : "Request More Info"}
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={4}
              className="w-full rounded-md border border-border-subtle p-2 text-sm focus:border-brand-blue/40 focus:outline-none focus:ring-1 focus:ring-brand-blue/35"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setNotesModal(null)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleNotesSubmit}
                disabled={rejectMutation.isPending || requestInfoMutation.isPending}
                className="rounded-md bg-text-primary px-4 py-2 text-sm text-white hover:bg-black/85 disabled:opacity-50"
              >
                {rejectMutation.isPending || requestInfoMutation.isPending ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FreelancerRow({
  f,
  expanded,
  onToggle,
  onApprove,
  onReject,
  onRequestInfo,
  isPending,
}: {
  f: Freelancer;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestInfo: () => void;
  isPending: boolean;
}) {
  const tags = f.expertiseTagsJson as string[] | null;
  const canAct = f.verificationStatus === "submitted" || f.verificationStatus === "under_review";

  return (
    <>
      <tr className="cursor-pointer hover:bg-surface-muted" onClick={onToggle}>
        <td className="px-4 py-3">
          <p className="font-medium">{f.user.name}</p>
          <p className="text-xs text-text-muted">{f.user.email}</p>
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[f.verificationStatus]}`}>
            {f.verificationStatus}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">{tag}</span>
            ))}
            {tags && tags.length > 3 && (
              <span className="text-xs text-text-muted/80">+{tags.length - 3}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-text-muted">
          {new Date(f.user.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3">
          {canAct && (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onApprove}
                disabled={isPending}
                className="rounded bg-brand-blue px-2.5 py-1 text-xs text-white hover:bg-brand-blue/90 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={onReject}
                className="rounded bg-brand-primary px-2.5 py-1 text-xs text-white hover:bg-brand-primary/92"
              >
                Reject
              </button>
              <button
                onClick={onRequestInfo}
                className="rounded border border-border-subtle px-2.5 py-1 text-xs hover:bg-surface-muted"
              >
                Info
              </button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="border-t bg-surface-muted px-6 py-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium text-text-primary">Bio</p>
                <p className="text-black/65">{f.bio || "—"}</p>
              </div>
              <div>
                <p className="font-medium text-text-primary">Portfolio Links</p>
                {f.portfolioLinksJson ? (
                  <ul className="list-inside list-disc text-black/65">
                    {(f.portfolioLinksJson as string[]).map((link) => (
                      <li key={link}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-blue underline"
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted/80">None</p>
                )}
              </div>
              <div>
                <p className="font-medium text-text-primary">Past Work</p>
                {f.pastWorkLinksJson ? (
                  <ul className="list-inside list-disc text-black/65">
                    {(f.pastWorkLinksJson as string[]).map((link) => (
                      <li key={link}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-blue underline"
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted/80">None</p>
                )}
              </div>
              {f.verificationNotes && (
                <div>
                  <p className="font-medium text-text-primary">Notes</p>
                  <p className="text-black/65">{f.verificationNotes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
