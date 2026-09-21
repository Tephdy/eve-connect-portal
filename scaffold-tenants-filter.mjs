#!/usr/bin/env node
/**
 * Tenants list — filter bar
 * Usage: node scaffold-tenants-filter.mjs
 *
 * Creates:
 *   src/components/tenant/tenant-filters.tsx
 *
 * Updates:
 *   src/app/(dashboard)/property/tenants/page.tsx  (add filters + query support)
 *   src/components/tenant/tenant-table.tsx         (accept filtered list)
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// 1. Filter bar component
// =============================================================================
FILES["src/components/tenant/tenant-filters.tsx"] =
`"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "former", label: "Former" },
  { value: "blacklisted", label: "Blacklisted" },
];

export function TenantFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const hasMessenger = searchParams.get("messenger") === "1";
  const hasEmail = searchParams.get("email") === "1";

  const [localQ, setLocalQ] = useState(q);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      if (localQ === q) return;
      updateParam("q", localQ || null);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  // Sync when URL changes externally (back button)
  useEffect(() => {
    if (q !== localQ) setLocalQ(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  function toggleFlag(key: string, current: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (current) params.delete(key);
    else params.set(key, "1");
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  function clearAll() {
    setLocalQ("");
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = !!(q || status || hasMessenger || hasEmail);

  return (
    <div className="space-y-3 rounded-xl border border-ink-200 bg-surface p-4 dark:border-white/[0.06]">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {hasFilters && (
          <button
            onClick={clearAll}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Search name, email, phone…"
            className="h-9 w-full rounded-md border border-ink-200 bg-surface pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
          />
        </div>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => updateParam("status", e.target.value || null)}
          className="h-9 rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Quick toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ink-500">Show:</span>
        <ToggleChip
          active={hasMessenger}
          onClick={() => toggleFlag("messenger", hasMessenger)}
        >
          Has messenger
        </ToggleChip>
        <ToggleChip
          active={hasEmail}
          onClick={() => toggleFlag("email", hasEmail)}
        >
          Has email
        </ToggleChip>
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-brand-500 text-white"
          : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
      )}
    >
      {children}
    </button>
  );
}
`;

// =============================================================================
// 2. Updated tenants page
// =============================================================================
FILES["src/app/(dashboard)/property/tenants/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listTenants } from "@/lib/db/tenants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { TenantTable } from "@/components/tenant/tenant-table";
import { TenantFilters } from "@/components/tenant/tenant-filters";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    messenger?: string;
    email?: string;
  }>;
}) {
  await requirePagePermission("tenant:read");
  const sp = await searchParams;

  const allTenants = await listTenants();

  // ---- Apply filters ----
  const q = (sp.q ?? "").trim().toLowerCase();
  const status = sp.status ?? "";
  const hasMessenger = sp.messenger === "1";
  const hasEmail = sp.email === "1";

  const tenants = allTenants.filter((t) => {
    if (q) {
      const hay = (
        (t.full_name ?? "") +
        " " +
        (t.email ?? "") +
        " " +
        (t.phone ?? "") +
        " " +
        (t.messenger_name ?? "")
      ).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (status && t.status !== status) return false;
    if (hasMessenger && !t.messenger_name) return false;
    if (hasEmail && !t.email) return false;
    return true;
  });

  // ---- KPI stats (unfiltered) ----
  const total = allTenants.length;
  const active = allTenants.filter((t) => t.status === "active").length;
  const prospects = allTenants.filter((t) => t.status === "prospect").length;
  const former = allTenants.filter((t) => t.status === "former").length;

  const hasFilters = !!(q || status || hasMessenger || hasEmail);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="All tenants and prospects."
        action={
          <div className="flex gap-2">
            <Link href="/property/import">
              <Button variant="secondary">Import</Button>
            </Link>
            <Link href="/property/tenants/new">
              <Button>+ New Tenant</Button>
            </Link>
          </div>
        }
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total tenants" value={total} accent="brand" />
          <StatCard label="Active" value={active} accent="green" />
          <StatCard label="Prospects" value={prospects} accent="yellow" />
          <StatCard label="Former" value={former} accent="purple" />
        </div>
      )}

      <TenantFilters />

      {hasFilters && (
        <p className="text-sm text-ink-500">
          Showing <strong className="text-ink-900">{tenants.length}</strong> of{" "}
          {total} tenants
        </p>
      )}

      {allTenants.length === 0 ? (
        <EmptyState
          title="No tenants yet"
          description="Add your first tenant to get started."
          action={
            <Link href="/property/tenants/new">
              <Button>+ New Tenant</Button>
            </Link>
          }
        />
      ) : tenants.length === 0 ? (
        <EmptyState
          title="No tenants match the filters"
          description="Try adjusting or clearing the filters."
        />
      ) : (
        <TenantTable tenants={tenants} />
      )}
    </div>
  );
}
`;

// =============================================================================
// 3. Tenant table — re-emit (structure unchanged, only for consistency)
// =============================================================================
FILES["src/components/tenant/tenant-table.tsx"] =
`import Link from "next/link";
import { User } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { Tenant } from "@/lib/db/tenants";

const STATUS_TONE: Record<string, "brand" | "green" | "gray" | "red" | "yellow"> = {
  prospect: "yellow",
  active: "green",
  former: "gray",
  blacklisted: "red",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TenantTable({ tenants }: { tenants: Tenant[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Tenant</TH>
              <TH>Contact</TH>
              <TH>Messenger</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {tenants.map((t) => (
              <TR key={t.id}>
                <TD>
                  <Link
                    href={"/property/tenants/" + t.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-semibold text-white">
                      {initials(t.full_name) || <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {t.full_name}
                      </p>
                      {t.email && (
                        <p className="truncate text-xs text-ink-500">{t.email}</p>
                      )}
                    </div>
                  </Link>
                </TD>
                <TD className="text-sm text-ink-600">{t.phone ?? "—"}</TD>
                <TD className="text-sm text-ink-600">{t.messenger_name ?? "—"}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[t.status] ?? "gray"} dot>
                    {t.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/property/tenants/" + t.id}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Edit
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
`;

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Tenants list — filters\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\nDone — " + count + " file(s) written.\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("  Visit http://localhost:3000/property/tenants");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});