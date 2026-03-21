"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type User = { userId: string; role: string; email: string | null } | null;

export function useAuth() {
  const qc = useQueryClient();
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      qc.setQueryData(["auth"], null);
      window.location.href = "/login";
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
