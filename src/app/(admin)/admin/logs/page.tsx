"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payloadJson: unknown;
  createdAt: string;
  actor: { name: string; email: string } | null;
}

const dayOptions = [
  { label: "Today", value: 1 },
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
];

export default function AdminLogsPage() {
  const [days, setDays] = useState(7);
  const [actionFilter, setActionFilter] = useState("");

  const { data, isLoading, error } = useQuery<{ logs: AuditLogRow[] }>({
    queryKey: ["admin", "audit-logs", days, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ days: String(days) });
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error("Failed to load logs");
      return res.json();
    },
  });

  const uniqueActions = data
    ? Array.from(new Set(data.logs.map((l) => l.action))).sort()
    : [];

  if (error) {
    return <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-brand-primary">Failed to load audit logs.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit Logs</h1>
      <p className="mb-4 mt-1 text-sm text-text-muted">
        {data ? `${data.logs.length} entries` : "Loading..."}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {dayOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === opt.value ? "bg-text-primary text-white" : "bg-black/[0.06] text-black/65 hover:bg-black/[0.08]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm focus:border-brand-blue/40 focus:outline-none focus:ring-1 focus:ring-brand-blue/35"
        >
          <option value="">All actions</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

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
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <span className="rounded bg-black/[0.06] px-2 py-0.5 text-xs font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.actor ? (
                        <div>
                          <p className="font-medium">{log.actor.name}</p>
                          <p className="text-xs text-text-muted">{log.actor.email}</p>
                        </div>
                      ) : (
                        <span className="text-text-muted/80">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-black/65">
                      <span className="text-xs">{log.entityType}</span>
                      <span className="ml-1 text-xs text-text-muted/80">{log.entityId.slice(0, 8)}...</span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-text-muted">
                      {log.payloadJson ? JSON.stringify(log.payloadJson).slice(0, 80) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data?.logs.map((log) => (
              <div key={log.id} className="rounded-lg border bg-surface p-4">
                <div className="flex items-start justify-between">
                  <span className="rounded bg-black/[0.06] px-2 py-0.5 text-xs font-medium">
                    {log.action}
                  </span>
                  <span className="text-xs text-text-muted">
                    {new Date(log.createdAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium">
                    {log.actor?.name ?? "System"}
                  </p>
                  {log.actor && <p className="text-xs text-text-muted">{log.actor.email}</p>}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {log.entityType} · {log.entityId.slice(0, 8)}...
                </p>
              </div>
            ))}
          </div>

          {data?.logs.length === 0 && (
            <p className="mt-4 text-center text-sm text-text-muted">No audit logs found for this period.</p>
          )}
        </>
      )}
    </div>
  );
}
