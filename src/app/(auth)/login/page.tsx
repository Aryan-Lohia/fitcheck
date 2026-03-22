"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import { safeInternalNextPath } from "@/lib/auth/safe-next-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postLoginPathForRole } from "@/lib/auth/post-login-path";
import { loginSchema } from "@/lib/validators/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const safeNext = safeInternalNextPath(nextRaw);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setFormError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        const d = await res.json();
        const role = d.user?.role;
        if (safeNext) {
          router.push(safeNext);
          return;
        }
        router.push(postLoginPathForRole(role));
        return;
      }
      let message = "Something went wrong. Please try again.";
      try {
        const data: unknown = await res.json();
        if (
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
        ) {
          const err = (data as { error: string }).error.trim();
          if (err) message = err;
        }
      } catch {
        /* non-JSON response */
      }
      setFormError(message);
    } catch {
      setFormError(
        "Network error. Check your connection and try again.",
      );
    }
  };

  return (
    <AuthSplitShell
      eyebrow="Welcome back"
      title="Log in"
      description="Sign in to FitCheck with your email and password."
      footer={
        <p className="text-center text-sm text-text-muted">
          New here?{" "}
          <Link
            href={
              safeNext
                ? `/signup?next=${encodeURIComponent(safeNext)}`
                : "/signup"
            }
            className="font-semibold text-brand-blue underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form
        className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm sm:p-7"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        {formError ? (
          <p
            className="rounded-lg border border-brand-primary/25 bg-brand-primary/5 px-3 py-2 text-sm text-brand-primary"
            role="alert"
          >
            {formError}
          </p>
        ) : null}
        <div>
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            className="mt-1.5"
            aria-invalid={errors.email ? true : undefined}
            {...register("email")}
          />
          {errors.email?.message ? (
            <p className="mt-1 text-xs text-brand-primary" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="mt-1.5"
            aria-invalid={errors.password ? true : undefined}
            {...register("password")}
          />
          {errors.password?.message ? (
            <p className="mt-1 text-xs text-brand-primary" role="alert">
              {errors.password.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full min-h-11">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthSplitShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
