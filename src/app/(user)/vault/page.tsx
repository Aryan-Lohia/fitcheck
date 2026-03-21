"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StorageBar } from "@/components/ui/StorageBar";
import { FileUploader } from "@/components/ui/FileUploader";
import { MediaGrid } from "@/components/ui/MediaGrid";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Photos", "Fit Checks"] as const;
const SORT_OPTIONS = ["Newest", "Oldest", "Largest"] as const;

interface MediaItem {
  id: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  category: string;
  mimeType: string;
}

interface MediaResponse {
  media: MediaItem[];
  totalBytes: number;
  maxBytes: number;
}

function categoryToParam(cat: string): string | undefined {
  if (cat === "All") return undefined;
  if (cat === "Photos") return "photos";
  if (cat === "Fit Checks") return "fit-checks";
  return undefined;
}

export default function VaultPage() {
  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]>("Newest");

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<MediaResponse>({
    queryKey: ["media", category],
    queryFn: async () => {
      const param = categoryToParam(category);
      const url = param
        ? `/api/profile/media?category=${param}`
        : "/api/profile/media";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load media");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/profile/media/${id}`, { method: "DELETE" }),
        ),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["media"] }),
  });

  const handleUploadComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["media"] });
  }, [queryClient]);

  const media = data?.media;
  const sortedItems = useMemo(() => {
    if (!media) return [];
    const list = [...media];
    switch (sort) {
      case "Oldest":
        list.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "Largest":
        list.sort((a, b) => b.fileSize - a.fileSize);
        break;
      default:
        list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }
    return list;
  }, [media, sort]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <h1 className="text-xl font-semibold text-text-primary">Media Vault</h1>
      <p className="mt-1 text-sm text-text-muted">
        Upload and manage your photos and fit checks.
      </p>

      <div className="mt-5">
        <StorageBar
          usedBytes={data?.totalBytes ?? 0}
          maxBytes={data?.maxBytes ?? 1073741824}
        />
      </div>

      <div className="mt-5">
        <FileUploader
          onUploadComplete={handleUploadComplete}
          category={categoryToParam(category) ?? "photos"}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "min-h-10 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40",
                category === cat
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1 sm:min-w-[11rem]">
          <Label htmlFor="vault-sort" className="text-xs text-text-muted">
            Sort by
          </Label>
          <Select
            id="vault-sort"
            value={sort}
            onChange={(e) =>
              setSort(e.target.value as (typeof SORT_OPTIONS)[number])
            }
            className="text-sm"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent"
              aria-hidden
            />
          </div>
        ) : (
          <MediaGrid
            items={sortedItems}
            onDelete={(ids) => deleteMutation.mutate(ids)}
          />
        )}
      </div>

      {deleteMutation.isError && (
        <p className="mt-2 text-center text-xs text-brand-primary" role="alert">
          Failed to delete. Please try again.
        </p>
      )}
    </main>
  );
}
