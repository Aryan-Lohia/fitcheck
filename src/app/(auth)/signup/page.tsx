"use client";

import { Suspense } from "react";
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
import { Select } from "@/components/ui/select";
import { signupSchema } from "@/lib/validators/auth";

type SignupForm = z.input<typeof signupSchema>;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const safeNext = safeInternalNextPath(nextRaw);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: "USER" },
  });

  const onSubmit = async (values: SignupForm) => {
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) return;
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (res.ok) {
      const d = await res.json();
      if (safeNext) {
        router.push(safeNext);
        return;
      }
      router.push(
        d.user?.role === "FREELANCE_USER"
          ? "/freelancer/dashboard"
          : "/dashboard",
      );
    }
  };

  return (
    <AuthSplitShell
      eyebrow="Join FitCheck"
      title="Create account"
      description="Set up your account to import looks, run fit checks, and chat with the assistant."
      footer={
        <p className="text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link
            href={
              safeNext
                ? `/login?next=${encodeURIComponent(safeNext)}`
                : "/login"
            }
            className="font-semibold text-brand-blue underline-offset-2 hover:underline"
          >
            Log in
          </Link>
        </p>
      }
    >
      <form
        className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm sm:p-7"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <div>
          <Label htmlFor="signup-name">Full name</Label>
          <Input id="signup-name" className="mt-1.5" {...register("name")} />
          {errors.name?.message ? (
            <p className="mt-1 text-xs text-brand-primary" role="alert">
              {errors.name.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            className="mt-1.5"
            {...register("email")}
          />
          {errors.email?.message ? (
            <p className="mt-1 text-xs text-brand-primary" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            className="mt-1.5"
            {...register("password")}
          />
          {errors.password?.message ? (
            <p className="mt-1 text-xs text-brand-primary" role="alert">
              {errors.password.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="signup-role">Account type</Label>
          <Select id="signup-role" className="mt-1.5" {...register("role")}>
            <option value="USER">User</option>
            <option value="FREELANCE_USER">User + Freelance Expert</option>
          </Select>
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full min-h-11">
          {isSubmitting ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthSplitShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
