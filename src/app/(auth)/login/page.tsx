"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Users,
  Wrench,
  Receipt,
  BarChart3,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  {
    icon: Building2,
    title: "Property & Lease Management",
    description: "Manage properties, units, tenants, and leases in one place.",
  },
  {
    icon: Receipt,
    title: "Automated Accounting",
    description: "Invoices, payments, deposits, and receipts generated automatically.",
  },
  {
    icon: Wrench,
    title: "Maintenance Workflow",
    description: "Job orders with per-task approval thresholds and work logs.",
  },
  {
    icon: Users,
    title: "Marketing & Inquiries",
    description: "Track listings, availability forecasts, and prospective tenants.",
  },
  {
    icon: BarChart3,
    title: "Executive Dashboard",
    description: "Cross-department KPIs, revenue trends, and portfolio health.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Six departments, scoped permissions, and full audit trail.",
  },
];

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
    <form onSubmit={onSubmit} className="w-full max-w-sm">
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow-sm">
          <span className="text-sm font-bold text-white">A</span>
        </div>
        <span className="text-base font-semibold tracking-tight text-ink-900">
          Apartment Portal
        </span>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">
          Welcome back
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Sign in to access your department workspace.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-800 backdrop-blur-sm dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 w-full rounded-xl border border-white/60 bg-white/60 px-3.5 text-sm text-ink-900 placeholder:text-ink-400 backdrop-blur-sm transition-all outline-none focus:border-brand-500 focus:bg-white/90 focus:ring-4 focus:ring-brand-500/15 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100 dark:focus:bg-white/[0.08]"
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border border-white/60 bg-white/60 px-3.5 text-sm text-ink-900 placeholder:text-ink-400 backdrop-blur-sm transition-all outline-none focus:border-brand-500 focus:bg-white/90 focus:ring-4 focus:ring-brand-500/15 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100 dark:focus:bg-white/[0.08]"
            autoComplete="current-password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition-all hover:shadow-xl hover:shadow-brand-500/40 active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>

      <p className="mt-6 text-center text-xs text-ink-400">
        Access is managed by your system administrator.
        <br />
        Contact IT if you need credentials.
      </p>
    </form>
  );
}

function LoginFallback() {
  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="h-8 w-40 animate-pulse rounded-xl bg-ink-100" />
      <div className="h-4 w-56 animate-pulse rounded bg-ink-100" />
      <div className="h-11 animate-pulse rounded-xl bg-ink-100" />
      <div className="h-11 animate-pulse rounded-xl bg-ink-100" />
      <div className="h-11 animate-pulse rounded-xl bg-ink-100" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* LEFT: brand + features on gradient */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-10 text-white lg:flex">
        {/* Decorative blurred circles */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-brand-400/25 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 rounded-full bg-vivid-lavender/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/25">
              <span className="text-base font-bold text-white">A</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Apartment Portal
            </span>
          </div>

          <div className="mt-16 max-w-lg">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Operations for modern property management.
            </h1>
            <p className="mt-4 text-base text-white/80">
              A unified portal for property, accounting, marketing,
              maintenance, and executive oversight — built for the way
              real estate teams actually work.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/12 backdrop-blur-md ring-1 ring-white/20">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{f.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/70">
                      {f.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 mt-16 flex items-center justify-between text-xs text-white/60">
          <span>© {new Date().getFullYear()} Apartment Portal</span>
          <span>Internal use only</span>
        </div>
      </div>

      {/* RIGHT: glass card with the form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="glass-strong w-full max-w-md rounded-3xl p-8 shadow-2xl sm:p-10">
          <Suspense fallback={<LoginFallback />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
