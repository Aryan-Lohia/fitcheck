"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface ApiUsageRow {
  id: string;
  userId: string;
  date: string;
  geminiRequests: number;
  geminiTokensIn: number;
  geminiTokensOut: number;
  imageAnalysisCount: number;
  estimatedCost: number;
  user: { name: string; email: string };
}

type SortField = "date" | "geminiRequests" | "geminiTokensIn" | "geminiTokensOut" | "estimatedCost";

export default function AdminApiUsagePage() {
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error } = useQuery<{ usage: ApiUsageRow[] }>({
    queryKey: ["admin", "api-usage"],
    queryFn: async () => {
      const res = await fetch("/api/admin/api-usage");
      if (!res.ok) throw new Error("Failed to load API usage");
      return res.json();
    },
  });

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  const sorted = data?.usage.slice().sort((a, b) => {
    const aVal = sortBy === "date" ? new Date(a.date).getTime() : a[sortBy];
    const bVal = sortBy === "date" ? new Date(b.date).getTime() : b[sortBy];
    return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  });

  function sortIcon(field: SortField) {
    if (sortBy !== field) return <span className="ml-1 text-text-muted/40">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  if (error) {
    return <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-brand-primary">Failed to load API usage.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">API Usage</h1>
      <p className="mb-4 mt-1 text-sm text-text-muted">Gemini API usage per user per day</p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-black/[0.06]" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-surface-muted text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="cursor-pointer px-4 py-3 select-none" onClick={() => toggleSort("date")}>
                    Date {sortIcon("date")}
                  </th>
                  <th className="cursor-pointer px-4 py-3 select-none" onClick={() => toggleSort("geminiRequests")}>
                    Requests {sortIcon("geminiRequests")}
                  </th>
                  <th className="cursor-pointer px-4 py-3 select-none" onClick={() => toggleSort("geminiTokensIn")}>
                    Tokens In {sortIcon("geminiTokensIn")}
                  </th>
                  <th className="cursor-pointer px-4 py-3 select-none" onClick={() => toggleSort("geminiTokensOut")}>
                    Tokens Out {sortIcon("geminiTokensOut")}
                  </th>
                  <th className="cursor-pointer px-4 py-3 select-none" onClick={() => toggleSort("estimatedCost")}>
                    Cost ($) {sortIcon("estimatedCost")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted?.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.user.name}</p>
                      <p className="text-xs text-text-muted">{row.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{row.geminiRequests.toLocaleString()}</td>
                    <td className="px-4 py-3">{row.geminiTokensIn.toLocaleString()}</td>
                    <td className="px-4 py-3">{row.geminiTokensOut.toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium">${row.estimatedCost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {sorted?.map((row) => (
              <div key={row.id} className="rounded-lg border bg-surface p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{row.user.name}</p>
                    <p className="text-xs text-text-muted">{row.user.email}</p>
                  </div>
                  <span className="text-sm font-medium">${row.estimatedCost.toFixed(4)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-muted">
                  <span>Date: {new Date(row.date).toLocaleDateString()}</span>
                  <span>Requests: {row.geminiRequests}</span>
                  <span>Tokens In: {row.geminiTokensIn.toLocaleString()}</span>
                  <span>Tokens Out: {row.geminiTokensOut.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {sorted?.length === 0 && (
            <p className="mt-4 text-center text-sm text-text-muted">No API usage data.</p>
          )}
        </>
      )}
    </div>
  );
}
