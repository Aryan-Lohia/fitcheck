"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "USER" | "FREELANCE_USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: string;
  profile: { profileCompletion: number } | null;
  _count: { media: number };
}

const roleBadge: Record<string, string> = {
  USER: "bg-black/[0.06] text-text-primary",
  FREELANCE_USER: "bg-brand-warm/20 text-brand-accent",
  ADMIN: "bg-brand-primary/12 text-brand-primary",
};

const statusBadge: Record<string, string> = {
  ACTIVE: "bg-brand-blue/12 text-brand-blue",
  SUSPENDED: "bg-brand-warm/22 text-brand-accent",
  DELETED: "bg-brand-primary/12 text-brand-primary",
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<{ users: UserRow[] }>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  const filtered = data?.users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  if (error) {
    return <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-brand-primary">Failed to load users.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mb-4 mt-1 text-sm text-text-muted">
        {data ? `${data.users.length} total` : "Loading..."}
      </p>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-md rounded-md border border-border-subtle px-3 py-2 text-sm focus:border-brand-blue/40 focus:outline-none focus:ring-1 focus:ring-brand-blue/35"
      />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-surface-muted text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered?.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-black/65">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[u.status]}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered?.map((u) => (
              <div key={u.id} className="rounded-lg border bg-surface p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-text-muted">{u.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge[u.role]}`}>
                    {u.role}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${statusBadge[u.status]}`}>
                    {u.status}
                  </span>
                  <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {filtered?.length === 0 && (
            <p className="mt-4 text-center text-sm text-text-muted">No users match your search.</p>
          )}
        </>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-black/[0.06]" />
      ))}
    </div>
  );
}
