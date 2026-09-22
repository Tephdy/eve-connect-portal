#!/usr/bin/env node
/**
 * scaffold-audit-pass3.mjs
 * Pass 3 — Automation + Reports
 * Usage: node scaffold-audit-pass3.mjs [--dry]
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

const j = (lines) => lines.join("\n") + "\n";

// ===========================================================================
// 1. MIGRATION
// ===========================================================================

FILES["supabase/migrations/20260922000000_add_audit_manage_permission.sql"] = j([
  "-- Adds audit:manage and grants it to accounting + executive roles.",
  "-- Schema: core.user_role, core.role_permission, core.permission, core.role",
  "",
  "insert into core.permission (key, description)",
  "values ('audit:manage', 'Run audits, resolve and dismiss findings')",
  "on conflict (key) do nothing;",
  "",
  "insert into core.role_permission (role_id, permission_id)",
  "select r.id, p.id",
  "from core.role r",
  "cross join core.permission p",
  "where r.key in ('accounting', 'executive')",
  "  and p.key = 'audit:manage'",
  "on conflict do nothing;",
]);

// ===========================================================================
// 2. CRON ROUTE
// ===========================================================================

FILES["src/app/api/cron/audit/route.ts"] = j([
  'import { NextResponse } from "next/server";',
  'import { runAudit } from "@/lib/audit/engine";',
  '',
  'export const runtime = "nodejs";',
  'export const dynamic = "force-dynamic";',
  '',
  'export async function POST(req: Request) {',
  '  const secret = process.env.CRON_SECRET;',
  '  if (!secret) {',
  '    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });',
  '  }',
  '  if (req.headers.get("authorization") !== `Bearer ${secret}`) {',
  '    return NextResponse.json({ error: "unauthorized" }, { status: 401 });',
  '  }',
  '',
  '  try {',
  '    const result = await runAudit();',
  '    return NextResponse.json({ ok: true, ...result });',
  '  } catch (err) {',
  '    return NextResponse.json(',
  '      { ok: false, error: err instanceof Error ? err.message : "run failed" },',
  '      { status: 500 }',
  '    );',
  '  }',
  '}',
]);

// ===========================================================================
// 3. CSV EXPORT ROUTE
// ===========================================================================

FILES["src/app/(dashboard)/accounting/audit/export/route.ts"] = j([
  'import { NextResponse } from "next/server";',
  'import { requirePagePermission } from "@/lib/auth/guard";',
  'import { listFindings } from "@/lib/db/audit";',
  'import type { AuditFinding } from "@/lib/audit/types";',
  '',
  'export const runtime = "nodejs";',
  'export const dynamic = "force-dynamic";',
  '',
  'const COLUMNS: (keyof AuditFinding)[] = [',
  '  "id",',
  '  "severity",',
  '  "status",',
  '  "title",',
  '  "summary",',
  '  "rule_key",',
  '  "rule_name",',
  '  "detected_at",',
  '];',
  '',
  'function csvCell(v: unknown): string {',
  '  if (v === null || v === undefined) return "";',
  '  const s = String(v);',
  '  return /[",\\n\\r]/.test(s) ? `"${s.replace(/"/g, \'""\')}"` : s;',
  '}',
  '',
  'export async function GET(req: Request) {',
  '  await requirePagePermission("audit:read");',
  '',
  '  const url = new URL(req.url);',
  '  const status = url.searchParams.get("status") ?? undefined;',
  '  const severity = url.searchParams.get("severity") ?? undefined;',
  '',
  '  const findings = await listFindings({',
  '    status: status as never,',
  '    severity: severity as never,',
  '  });',
  '',
  '  const header = COLUMNS.join(",");',
  '  const rows = findings.map((f) => COLUMNS.map((c) => csvCell(f[c])).join(","));',
  '  const body = [header, ...rows].join("\\n");',
  '',
  '  const stamp = new Date().toISOString().slice(0, 10);',
  '  return new NextResponse(body, {',
  '    headers: {',
  '      "Content-Type": "text/csv; charset=utf-8",',
  '      "Content-Disposition": `attachment; filename="audit-findings-${stamp}.csv"`,',
  '      "Cache-Control": "no-store",',
  '    },',
  '  });',
  '}',
]);

// ===========================================================================
// 4. RECONCILIATION LIB
// ===========================================================================

FILES["src/lib/audit/reconciliation.ts"] = j([
  'import { listFindings } from "@/lib/db/audit";',
  'import type { AuditFinding } from "@/lib/audit/types";',
  '',
  'export type ReconRow = {',
  '  ruleKey: string;',
  '  ruleName: string;',
  '  severity: AuditFinding["severity"];',
  '  open: number;',
  '  resolved: number;',
  '  dismissed: number;',
  '  oldestOpenDays: number | null;',
  '};',
  '',
  'export type ReconResult = {',
  '  rows: ReconRow[];',
  '  totals: { open: number; resolved: number; dismissed: number };',
  '  generatedAt: string;',
  '};',
  '',
  'export async function buildReconciliation(): Promise<ReconResult> {',
  '  const findings = await listFindings({});',
  '',
  '  const byRule = new Map<string, ReconRow>();',
  '  for (const f of findings) {',
  '    const key = f.rule_key;',
  '    let row = byRule.get(key);',
  '    if (!row) {',
  '      row = {',
  '        ruleKey: key,',
  '        ruleName: f.rule_name ?? key,',
  '        severity: f.severity,',
  '        open: 0,',
  '        resolved: 0,',
  '        dismissed: 0,',
  '        oldestOpenDays: null,',
  '      };',
  '      byRule.set(key, row);',
  '    }',
  '    if (f.status === "open" || f.status === "investigating") {',
  '      row.open++;',
  '      const age = Math.floor((Date.now() - new Date(f.detected_at).getTime()) / 86400000);',
  '      if (row.oldestOpenDays === null || age > row.oldestOpenDays) {',
  '        row.oldestOpenDays = age;',
  '      }',
  '    } else if (f.status === "resolved") row.resolved++;',
  '    else if (f.status === "dismissed") row.dismissed++;',
  '  }',
  '',
  '  const rows = [...byRule.values()].sort((a, b) => b.open - a.open);',
  '  const totals = rows.reduce(',
  '    (t, r) => ({',
  '      open: t.open + r.open,',
  '      resolved: t.resolved + r.resolved,',
  '      dismissed: t.dismissed + r.dismissed,',
  '    }),',
  '    { open: 0, resolved: 0, dismissed: 0 }',
  '  );',
  '',
  '  return { rows, totals, generatedAt: new Date().toISOString() };',
  '}',
]);

// ===========================================================================
// 5. RECONCILIATION PAGE
// ===========================================================================

FILES["src/app/(dashboard)/accounting/audit/reconciliation/page.tsx"] = j([
  'import { requirePagePermission } from "@/lib/auth/guard";',
  'import { buildReconciliation } from "@/lib/audit/reconciliation";',
  'import { PageHeader } from "@/components/layout/page-header";',
  'import { Card, CardBody, CardHeader } from "@/components/ui/card";',
  'import { SeverityBadge } from "@/components/audit/severity-badge";',
  '',
  'export default async function ReconciliationPage() {',
  '  await requirePagePermission("audit:read");',
  '  const { rows, totals, generatedAt } = await buildReconciliation();',
  '',
  '  return (',
  '    <div className="space-y-6">',
  '      <PageHeader',
  '        title="Reconciliation"',
  '        description={"Snapshot generated " + new Date(generatedAt).toLocaleString("en-PH")}',
  '      />',
  '      <div className="grid grid-cols-3 gap-4">',
  '        <Card><CardBody>',
  '          <p className="text-xs font-semibold uppercase text-ink-500">Open</p>',
  '          <p className="mt-1 text-2xl font-bold tabular-nums">{totals.open}</p>',
  '        </CardBody></Card>',
  '        <Card><CardBody>',
  '          <p className="text-xs font-semibold uppercase text-ink-500">Resolved</p>',
  '          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{totals.resolved}</p>',
  '        </CardBody></Card>',
  '        <Card><CardBody>',
  '          <p className="text-xs font-semibold uppercase text-ink-500">Dismissed</p>',
  '          <p className="mt-1 text-2xl font-bold tabular-nums text-ink-500">{totals.dismissed}</p>',
  '        </CardBody></Card>',
  '      </div>',
  '',
  '      <Card>',
  '        <CardHeader title="By rule" />',
  '        <CardBody className="p-0">',
  '          <table className="w-full text-sm">',
  '            <thead className="border-b border-white/40 text-left text-xs uppercase text-ink-500 dark:border-white/[0.06]">',
  '              <tr>',
  '                <th className="px-6 py-3">Rule</th>',
  '                <th className="px-4 py-3">Severity</th>',
  '                <th className="px-4 py-3 text-right">Open</th>',
  '                <th className="px-4 py-3 text-right">Resolved</th>',
  '                <th className="px-4 py-3 text-right">Dismissed</th>',
  '                <th className="px-6 py-3 text-right">Oldest open</th>',
  '              </tr>',
  '            </thead>',
  '            <tbody className="divide-y divide-white/40 dark:divide-white/[0.06]">',
  '              {rows.map((r) => (',
  '                <tr key={r.ruleKey}>',
  '                  <td className="px-6 py-3 font-medium">{r.ruleName}</td>',
  '                  <td className="px-4 py-3"><SeverityBadge severity={r.severity} /></td>',
  '                  <td className="px-4 py-3 text-right tabular-nums">{r.open}</td>',
  '                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{r.resolved}</td>',
  '                  <td className="px-4 py-3 text-right tabular-nums text-ink-500">{r.dismissed}</td>',
  '                  <td className="px-6 py-3 text-right tabular-nums text-ink-500">',
  '                    {r.oldestOpenDays === null ? "\\u2014" : r.oldestOpenDays + "d"}',
  '                  </td>',
  '                </tr>',
  '              ))}',
  '            </tbody>',
  '          </table>',
  '        </CardBody>',
  '      </Card>',
  '    </div>',
  '  );',
  '}',
]);

// ===========================================================================
// 6. EMAIL DIGEST
// ===========================================================================

FILES["src/lib/audit/email-digest.ts"] = j([
  'import { listFindings } from "@/lib/db/audit";',
  'import type { AuditFinding } from "@/lib/audit/types";',
  '',
  'export type DigestPayload = {',
  '  subject: string;',
  '  html: string;',
  '  count: number;',
  '};',
  '',
  'export async function buildDailyDigest(): Promise<DigestPayload | null> {',
  '  if (process.env.AUDIT_DIGEST_ENABLED !== "true") return null;',
  '',
  '  const findings = await listFindings({ status: "open" });',
  '  const critical = findings.filter((f) => f.severity === "critical");',
  '  const high = findings.filter((f) => f.severity === "high");',
  '  if (critical.length === 0 && high.length === 0) return null;',
  '',
  '  const section = (label: string, items: AuditFinding[]) =>',
  '    items.length === 0',
  '      ? ""',
  '      : "<h3>" + label + " (" + items.length + ")</h3><ul>" +',
  '        items.map((f) => "<li><strong>" + escapeHtml(f.title) + "</strong> \\u2014 " + escapeHtml(f.rule_name ?? f.rule_key) + "</li>").join("") +',
  '        "</ul>";',
  '',
  '  const html =',
  '    "<!doctype html><html><body style=\\"font-family:system-ui,sans-serif\\">" +',
  '    "<h2>Audit digest \\u2014 " + new Date().toLocaleDateString("en-PH") + "</h2>" +',
  '    section("Critical", critical) +',
  '    section("High", high) +',
  '    "<p style=\\"color:#666;font-size:12px\\">Generated automatically by the audit engine.</p>" +',
  '    "</body></html>";',
  '',
  '  return {',
  '    subject: "Audit digest: " + critical.length + " critical, " + high.length + " high",',
  '    html,',
  '    count: critical.length + high.length,',
  '  };',
  '}',
  '',
  'function escapeHtml(s: string): string {',
  '  const map: Record<string, string> = {',
  '    "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;", "\'": "&#39;",',
  '  };',
  '  return s.replace(/[&<>"\']/g, (c) => map[c] ?? c);',
  '}',
]);

// ===========================================================================
// 7. WRITE + PATCH
// ===========================================================================

async function writeAll() {
  let created = 0;
  let skipped = 0;
  for (const [rel, content] of Object.entries(FILES)) {
    const full = join(ROOT, rel);
    if (await exists(full)) {
      console.log("  = skip (exists): " + rel);
      skipped++;
      continue;
    }
    if (DRY) {
      console.log("  ~ would create: " + rel);
      continue;
    }
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    console.log("  + created: " + rel);
    created++;
  }
  console.log("");
  console.log("Files: " + created + " created, " + skipped + " skipped.");
}

async function patchActions() {
  const rel = "src/app/(dashboard)/accounting/audit/actions.ts";
  const full = join(ROOT, rel);
  if (!(await exists(full))) {
    console.log("  ! missing: " + rel + " (skip patch)");
    return;
  }
  let src = await readFile(full, "utf8");

  // Ensure import
  if (!src.includes("assertPermission")) {
    const guardImportRe = /import\s*\{([^}]+)\}\s*from\s*["']@\/lib\/auth\/guard["'];?/;
    const m = src.match(guardImportRe);
    if (m) {
      const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (!names.includes("assertPermission")) names.push("assertPermission");
      src = src.replace(guardImportRe, `import { ${names.join(", ")} } from "@/lib/auth/guard";`);
    } else {
      // Insert new import after the first import line
      const lines = src.split("\n");
      let inserted = false;
      for (let i = 0; i < lines.length; i++) {
        if (/^import\s/.test(lines[i])) {
          lines.splice(i + 1, 0, 'import { assertPermission } from "@/lib/auth/guard";');
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        lines.unshift('import { assertPermission } from "@/lib/auth/guard";');
      }
      src = lines.join("\n");
    }
  }

  // Inject assertPermission into the three write actions
  const targets = ["runAuditAction", "setFindingStatusAction", "updateRuleAction"];
  for (const fn of targets) {
    // Matches: export async function fnName(...) {\n
    const re = new RegExp(
      `(export\\s+async\\s+function\\s+${fn}\\s*\\([^)]*\\)\\s*\\{\\s*\\n)`,
      "m"
    );
    if (re.test(src) && !new RegExp(`${fn}[\\s\\S]{0,300}assertPermission\\("audit:manage"\\)`).test(src)) {
      src = src.replace(
        re,
        `$1  await assertPermission("audit:manage");\n`
      );
      console.log("  + gated " + fn + " with audit:manage");
    }
  }

  if (DRY) {
    console.log("  ~ would patch: " + rel);
    return;
  }
  await writeFile(full, src, "utf8");
  console.log("  + patched: " + rel);
}

async function patchVercelJson() {
  const rel = "vercel.json";
  const full = join(ROOT, rel);
  let json = {};
  if (await exists(full)) {
    try { json = JSON.parse(await readFile(full, "utf8")); } catch {}
  }
  json.crons = json.crons ?? [];
  const has = json.crons.some((c) => c.path === "/api/cron/audit");
  if (has) {
    console.log("  = vercel.json already has /api/cron/audit");
    return;
  }
  json.crons.push({ path: "/api/cron/audit", schedule: "0 2 * * *" });
  if (DRY) {
    console.log("  ~ would patch: vercel.json");
    return;
  }
  await writeFile(full, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log("  + patched: vercel.json (added cron)");
}

console.log("\nAudit Pass 3 scaffold" + (DRY ? " (dry run)" : "") + "\n");
console.log("[1/3] Creating files ...");
await writeAll();
console.log("\n[2/3] Patching audit actions ...");
await patchActions();
console.log("\n[3/3] Patching vercel.json ...");
await patchVercelJson();
console.log("\nDone. Next steps:");
console.log("  1. Review the ADJUST comments if typecheck complains.");
console.log("  2. Run: npm run typecheck");
console.log("  3. Set CRON_SECRET in env.");
console.log("  4. Apply migration: supabase/migrations/20260922000000_add_audit_manage_permission.sql");
console.log("");
