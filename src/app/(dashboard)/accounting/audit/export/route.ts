import { NextResponse } from "next/server";
import { requirePagePermission } from "@/lib/auth/guard";
import { listFindings } from "@/lib/db/audit";
import type { AuditFinding } from "@/lib/audit/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS: (keyof AuditFinding)[] = [
  "id",
  "severity",
  "status",
  "title",
  "summary",
  "rule_key",
  "rule_name",
  "detected_at",
];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  await requirePagePermission("audit:read");

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const severity = url.searchParams.get("severity") ?? undefined;

  const findings = await listFindings({
    status: status as never,
    severity: severity as never,
  });

  const header = COLUMNS.join(",");
  const rows = findings.map((f) => COLUMNS.map((c) => csvCell(f[c])).join(","));
  const body = [header, ...rows].join("\n");

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-findings-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
