"use client";

import { useQuery } from "@tanstack/react-query";

interface StorageRow {
  id: string;
  userId: string;
  date: string;
  bytesUsed: string;
  fileCount: number;
  user: { name: string; email: string };
}

const QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB default quota

function formatMB(bytesStr: string) {
  const bytes = Number(bytesStr);
  return (bytes / (1024 * 1024)).toFixed(2);
}

function quotaPct(bytesStr: string) {
  return (Number(bytesStr) / QUOTA_BYTES) * 100;
}

function quotaColor(bytesStr: string) {
  const pct = quotaPct(bytesStr);
  if (pct >= 90) return "bg-brand-primary/8 text-brand-primary";
  if (pct >= 80) return "bg-brand-warm/15 text-brand-accent";
  return "";
}

export default function AdminStoragePage() {
  const { data, isLoading, error } = useQuery<{ usage: StorageRow[] }>({
    queryKey: ["admin", "storage"],
    queryFn: async () => {
      const res = await fetch("/api/admin/storage-usage");
      if (!res.ok) throw new Error("Failed to load storage usage");
      return res.json();
    },
  });

  if (error) {
    return <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-brand-primary">Failed to load storage data.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Storage</h1>
      <p className="mb-4 mt-1 text-sm text-text-muted">Per-user storage breakdown</p>

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
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Files</th>
                  <th className="px-4 py-3">Size (MB)</th>
                  <th className="px-4 py-3">Quota Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.usage.map((row) => (
                  <tr key={row.id} className={`hover:bg-surface-muted ${quotaColor(row.bytesUsed)}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.user.name}</p>
                      <p className="text-xs text-text-muted">{row.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{row.fileCount}</td>
                    <td className="px-4 py-3">{formatMB(row.bytesUsed)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-black/[0.1]">
                          <div
                            className={`h-full rounded-full ${quotaPct(row.bytesUsed) >= 90
                                ? "bg-brand-primary"
                                : quotaPct(row.bytesUsed) >= 80
                                  ? "bg-brand-accent"
                                  : "bg-brand-blue"
                              }`}
                            style={{ width: `${Math.min(quotaPct(row.bytesUsed), 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {quotaPct(row.bytesUsed).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data?.usage.map((row) => (
              <div key={row.id} className={`rounded-lg border bg-surface p-4 ${quotaColor(row.bytesUsed)}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{row.user.name}</p>
                    <p className="text-xs text-text-muted">{row.user.email}</p>
                  </div>
                  <span className="text-sm font-medium">{quotaPct(row.bytesUsed).toFixed(1)}%</span>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-text-muted">
                  <span>{row.fileCount} files</span>
                  <span>{formatMB(row.bytesUsed)} MB</span>
                  <span>{new Date(row.date).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.1]">
                  <div
                    className={`h-full rounded-full ${quotaPct(row.bytesUsed) >= 90
                        ? "bg-brand-primary"
                        : quotaPct(row.bytesUsed) >= 80
                          ? "bg-brand-accent"
                          : "bg-brand-blue"
                      }`}
                    style={{ width: `${Math.min(quotaPct(row.bytesUsed), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {data?.usage.length === 0 && (
            <p className="mt-4 text-center text-sm text-text-muted">No storage data available.</p>
          )}
        </>
      )}
    </div>
  );
}
