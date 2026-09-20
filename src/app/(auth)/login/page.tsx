"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-lg border border-ink-200 bg-surface p-8 shadow-sm"
    >
      <h1 className="mb-1 text-xl font-semibold text-brand-600 dark:text-brand-400">
        Apartment Portal
      </h1>
      <p className="mb-6 text-sm text-ink-500">
        Sign in to access your department workspace.
      </p>

      {error && (
        <div className="mb-4 rounded border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </div>
      )}

      <label className="mb-1 block text-sm font-medium text-ink-700">Email</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-4 w-full rounded border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
        autoComplete="email"
      />

      <label className="mb-1 block text-sm font-medium text-ink-700">Password</label>
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-6 w-full rounded border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
        autoComplete="current-password"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function LoginFallback() {
  return (
    <div className="w-full max-w-sm rounded-lg border border-ink-200 bg-surface p-8 shadow-sm">
      <div className="h-6 w-32 animate-pulse rounded bg-ink-100" />
      <div className="mt-2 h-4 w-48 animate-pulse rounded bg-ink-100" />
      <div className="mt-6 h-9 animate-pulse rounded bg-ink-100" />
      <div className="mt-3 h-9 animate-pulse rounded bg-ink-100" />
      <div className="mt-6 h-9 animate-pulse rounded bg-ink-100" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}