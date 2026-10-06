// apply-chunk-3-portal.mjs
// Writes the 8 NEW portal files. Safe to re-run.
// Never edits existing files — if a path exists, it skips.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const FILES = [
  // ============================================================
  {
    path: "src/app/portal/layout.tsx",
    content: `import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { PortalShell } from "@/components/portal/portal-shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/portal/login");

  const roles = await getUserRoles();
  if (roles.length === 0) redirect("/portal/login");

  return (
    <PortalShell email={session.email ?? ""}>{children}</PortalShell>
  );
}
`,
  },

  // ============================================================
  {
    path: "src/app/portal/page.tsx",
    content: `import { requireTenantSelf } from "@/lib/auth/require-tenant-self";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const { tenant, session } = await requireTenantSelf();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">
          Welcome, {tenant.full_name}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Signed in as {session.email ?? ""}
        </p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-ink-200 bg-surface p-4 dark:border-white/[0.06]">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Tenant
          </p>
          <p className="mt-1 text-sm text-ink-800">{tenant.full_name}</p>
          {tenant.email && (
            <p className="text-xs text-ink-500">{tenant.email}</p>
          )}
        </div>

        <div className="rounded-xl border border-ink-200 bg-surface p-4 dark:border-white/[0.06]">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Status
          </p>
          <p className="mt-1 text-sm capitalize text-ink-800">{tenant.status}</p>
        </div>
      </div>

      <p className="text-xs text-ink-400">
        More sections coming soon - Lease, Invoices, Payments, Utilities.
      </p>
    </div>
  );
}
`,
  },

  // ============================================================
  {
    path: "src/components/portal/portal-shell.tsx",
    content: `import Link from "next/link";
import { Home, FileText, Receipt, CreditCard, Droplet, LogOut } from "lucide-react";

const NAV = [
  { href: "/portal",           label: "Home",      icon: Home },
  { href: "/portal/lease",     label: "Lease",     icon: FileText },
  { href: "/portal/invoices",  label: "Invoices",  icon: Receipt },
  { href: "/portal/payments",  label: "Payments",  icon: CreditCard },
  { href: "/portal/utilities", label: "Utilities", icon: Droplet },
];

export function PortalShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface pb-20">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-surface/95 backdrop-blur dark:border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/portal" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient">
              <span className="text-xs font-bold text-white">E</span>
            </div>
            <span className="text-sm font-semibold text-ink-900">
              Eve's Residences
            </span>
          </Link>
          <span className="truncate text-xs text-ink-500">{email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-200 bg-surface/95 backdrop-blur dark:border-white/[0.06]">
        <div className="mx-auto flex max-w-2xl items-center justify-around">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-ink-600 hover:text-brand-600 dark:hover:text-brand-400"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <form action="/portal/logout" method="post" className="flex-1">
            <button
              type="submit"
              className="flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-ink-600 hover:text-danger-600 dark:hover:text-danger-500"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </div>
  );
}
`,
  },

  // ============================================================
  {
    path: "src/lib/auth/require-tenant-self.ts",
    content: `import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";

export type SelfTenant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  messenger_name: string | null;
  status: string;
};

export async function requireTenantSelf(): Promise<{
  session: { id: string; email: string | null };
  tenant: SelfTenant;
}> {
  const session = await getSession();
  if (!session) redirect("/portal/login");

  const admin = createAdminClient();

  const { data: link } = await admin
    .schema("core")
    .from("tenant_user")
    .select("tenant_id")
    .eq("auth_user_id", session.id)
    .eq("relationship", "self")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!link) {
    redirect("/portal/not-linked");
  }

  const { data: tenant } = await admin
    .schema("core")
    .from("tenant")
    .select("id, full_name, email, phone, messenger_name, status")
    .eq("id", (link as { tenant_id: string }).tenant_id)
    .maybeSingle();

  if (!tenant) redirect("/portal/not-linked");

  return {
    session: { id: session.id, email: session.email ?? null },
    tenant: tenant as SelfTenant,
  };
}
`,
  },

  // ============================================================
  {
    path: "src/app/portal/not-linked/page.tsx",
    content: `export default function NotLinkedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="max-w-md space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <h1 className="text-lg font-semibold text-amber-800 dark:text-amber-400">
          Account not yet linked
        </h1>
        <p className="text-sm text-ink-600">
          Your account exists but isn't linked to a tenant record yet.
          Please contact the management office and ask them to link your account.
        </p>
      </div>
    </div>
  );
}
`,
  },

  // ============================================================
  {
    path: "src/app/portal/login/page.tsx",
    content: `import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { PortalLoginForm } from "./portal-login-form";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  const session = await getSession();
  if (session) redirect("/portal");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm dark:border-white/[0.06]">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-ink-900">
            Tenant portal
          </h1>
          <p className="text-sm text-ink-500">
            Sign in to view your lease, invoices, and payments.
          </p>
        </div>
        <PortalLoginForm />
      </div>
    </div>
  );
}
`,
  },

  // ============================================================
  {
    path: "src/app/portal/login/portal-login-form.tsx",
    content: `"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export function PortalLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    start(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (err) {
        setError(err.message);
        toast.push(err.message, "error");
        return;
      }
      toast.push("Welcome back", "success");
      router.push("/portal");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />

      {error && (
        <div className="rounded-md border border-danger-500/30 bg-danger-500/5 px-3 py-2 text-xs text-danger-700 dark:text-danger-500">
          {error}
        </div>
      )}

      <Button type="submit" loading={pending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
`,
  },

  // ============================================================
  {
    path: "src/app/portal/logout/route.ts",
    content: `import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.redirect(new URL("/portal/login", base), { status: 303 });
}
`,
  },
];

function ensureDir(p) {
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

console.log("=== apply-chunk-3-portal.mjs ===\\n");
let written = 0;
let skipped = 0;

for (const f of FILES) {
  if (existsSync(f.path)) {
    console.log("SKIP  " + f.path + "  (already exists)");
    skipped++;
    continue;
  }
  ensureDir(f.path);
  writeFileSync(f.path, f.content, "utf8");
  console.log("WRITE " + f.path);
  written++;
}

console.log("");
console.log("Done. Written: " + written + ", Skipped: " + skipped);
console.log("");
console.log("Next: manual edits (see chat)");