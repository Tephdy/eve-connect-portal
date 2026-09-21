#!/usr/bin/env node
/**
 * Units list — filter bar
 * Usage: node scaffold-units-filter.mjs
 *
 * Creates:
 *   src/components/unit/unit-filters.tsx
 *
 * Updates:
 *   src/app/(dashboard)/property/units/page.tsx   (add filter bar + query support)
 *   src/components/unit/unit-table.tsx            (accept pre-filtered list)
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
FILES["src/components/unit/unit-filters.tsx"] =
`"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "maintenance", label: "Maintenance" },
  { value: "unavailable", label: "Unavailable" },
];

export function UnitFilters({
  properties,
  bedroomsOptions,
}: {
  properties: { id: string; name: string }[];
  bedroomsOptions: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const property = searchParams.get("property") ?? "";
  const status = searchParams.get("status") ?? "";
  const bedrooms = searchParams.get("bedrooms") ?? "";

  const [localQ, setLocalQ] = useState(q);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => {
      if (localQ === q) return;
      updateParam("q", localQ || null);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  // Sync localQ when URL changes externally (back button)
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

  function clearAll() {
    setLocalQ("");
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = !!(q || property || status || bedrooms);

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Search unit number…"
            className="h-9 w-full rounded-md border border-ink-200 bg-surface pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
          />
        </div>

        {/* Property */}
        <select
          value={property}
          onChange={(e) => updateParam("property", e.target.value || null)}
          className="h-9 rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

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

      {bedroomsOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-500">Bedrooms:</span>
          <button
            onClick={() => updateParam("bedrooms", null)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              !bedrooms
                ? "bg-brand-500 text-white"
                : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
            )}
          >
            Any
          </button>
          {bedroomsOptions.map((n) => (
            <button
              key={n}
              onClick={() => updateParam("bedrooms", String(n))}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                bedrooms === String(n)
                  ? "bg-brand-500 text-white"
                  : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
              )}
            >
              {n}BR
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
`;

// =============================================================================
// 2. Updated units page — reads searchParams and filters list
// =============================================================================
FILES["src/app/(dashboard)/property/units/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { UnitTable } from "@/components/unit/unit-table";
import { UnitFilters } from "@/components/unit/unit-filters";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    property?: string;
    status?: string;
    bedrooms?: string;
  }>;
}) {
  await requirePagePermission("unit:read");
  const sp = await searchParams;

  const supabase = await createClient();

  const [allUnits, properties] = await Promise.all([
    listUnits(),
    supabase
      .from("property")
      .select("id, name")
      .is("archived_at", null)
      .order("name"),
  ]);

  // ---- Apply filters ----
  const q = (sp.q ?? "").trim().toLowerCase();
  const property = sp.property ?? "";
  const status = sp.status ?? "";
  const bedrooms = sp.bedrooms ?? "";

  const units = allUnits.filter((u) => {
    if (q && !u.unit_number.toLowerCase().includes(q)) return false;
    if (property && u.property_id !== property) return false;
    if (status && u.status !== status) return false;
    if (bedrooms) {
      const b = Number(bedrooms);
      if (Number(u.bedrooms ?? 0) !== b) return false;
    }
    return true;
  });

  // ---- KPI stats (unfiltered, so users see total portfolio) ----
  const total = allUnits.length;
  const vacant = allUnits.filter((u) => u.status === "vacant").length;
  const occupied = allUnits.filter((u) => u.status === "occupied").length;
  const maintenance = allUnits.filter((u) => u.status === "maintenance").length;

  // ---- Bedroom options for filter ----
  const bedroomsOptions = Array.from(
    new Set(
      allUnits
        .map((u) => Number(u.bedrooms ?? 0))
        .filter((n) => Number.isFinite(n) && n >= 0)
    )
  ).sort((a, b) => a - b);

  const hasFilters = !!(q || property || status || bedrooms);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units"
        description="All units across properties."
        action={
          <div className="flex gap-2">
            <Link href="/property/import">
              <Button variant="secondary">Import</Button>
            </Link>
            <Link href="/property/units/new">
              <Button>+ New Unit</Button>
            </Link>
          </div>
        }
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total units" value={total} accent="brand" />
          <StatCard label="Vacant" value={vacant} accent="green" />
          <StatCard label="Occupied" value={occupied} accent="purple" />
          <StatCard label="Maintenance" value={maintenance} accent="yellow" />
        </div>
      )}

      <UnitFilters
        properties={properties.data ?? []}
        bedroomsOptions={bedroomsOptions}
      />

      {hasFilters && (
        <p className="text-sm text-ink-500">
          Showing <strong className="text-ink-900">{units.length}</strong> of{" "}
          {total} units
        </p>
      )}

      {allUnits.length === 0 ? (
        <EmptyState
          title="No units yet"
          description="Create your first unit to get started."
          action={
            <Link href="/property/units/new">
              <Button>+ New Unit</Button>
            </Link>
          }
        />
      ) : units.length === 0 ? (
        <EmptyState
          title="No units match the filters"
          description="Try adjusting or clearing the filters."
        />
      ) : (
        <UnitTable units={units} />
      )}
    </div>
  );
}
`;

// =============================================================================
// 3. Unit table — accept emptyHint prop (no structural change needed but
//    we re-emit to be safe and add an optional footer count)
// =============================================================================
FILES["src/components/unit/unit-table.tsx"] =
`import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { Unit } from "@/lib/db/units";

const STATUS_TONE: Record<string, "green" | "brand" | "yellow" | "red" | "gray"> = {
  vacant: "green",
  occupied: "brand",
  reserved: "yellow",
  maintenance: "red",
  unavailable: "gray",
};

export function UnitTable({
  units,
  showFooterCount,
}: {
  units: Unit[];
  showFooterCount?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Unit</TH>
              <TH>Property</TH>
              <TH>Layout</TH>
              <TH className="text-right">Rent</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {units.map((u) => (
              <TR key={u.id}>
                <TD>
                  <Link
                    href={"/property/units/" + u.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <DoorOpen className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {u.unit_number}
                    </span>
                  </Link>
                </TD>
                <TD className="text-ink-600">{u.property_name ?? "—"}</TD>
                <TD className="text-ink-600">
                  {u.bedrooms != null ? u.bedrooms + "BR" : "—"}
                  {u.area_sqm != null ? " · " + u.area_sqm + " sqm" : ""}
                </TD>
                <TD className="text-right font-medium text-ink-900">
                  {u.base_rent != null ? formatPHP(u.base_rent) : "—"}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[u.status] ?? "gray"} dot>
                    {u.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/property/units/" + u.id}
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
      {showFooterCount && (
        <div className="border-t border-ink-200 px-5 py-3 text-xs text-ink-500 dark:border-white/[0.06]">
          {units.length} row{units.length === 1 ? "" : "s"}
        </div>
      )}
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

  console.log("Units list — filters\n");

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
  console.log("  Visit http://localhost:3000/property/units");
  console.log("\nFilters:");
  console.log("  - Search by unit number (debounced 300ms)");
  console.log("  - Property dropdown");
  console.log("  - Status dropdown");
  console.log("  - Bedroom quick-select");
  console.log("  - Clear all button");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});