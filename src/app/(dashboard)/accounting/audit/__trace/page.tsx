// AUDIT_TRACE - diagnostic only, safe to delete
import { getUserRoles } from "@/lib/auth/get-user-roles";
import { hasPermission } from "@/lib/auth/require-permission";
import * as db from "@/lib/db/audit";

export const dynamic = "force-dynamic";

type Step = { name: string; ok: boolean; error?: string; detail?: unknown };

export default async function TracePage() {
  const steps: Step[] = [];

  async function run(name: string, fn: () => Promise<unknown>) {
    try {
      const detail = await fn();
      steps.push({ name, ok: true, detail });
    } catch (err) {
      steps.push({
        name,
        ok: false,
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      });
    }
  }

  await run("getUserRoles", async () => await getUserRoles());
  await run("hasPermission(audit:read)", async () => await hasPermission("audit:read"));
  await run("hasPermission(audit:manage)", async () => await hasPermission("audit:manage"));

  await run("db.getAuditStats", async () => {
    if (typeof (db as Record<string, unknown>).getAuditStats !== "function") {
      throw new Error("getAuditStats is not exported from @/lib/db/audit");
    }
    return await (db as { getAuditStats: () => Promise<unknown> }).getAuditStats();
  });

  await run("db.listFindings({status:'open'})", async () => {
    if (typeof (db as Record<string, unknown>).listFindings !== "function") {
      throw new Error("listFindings is not exported from @/lib/db/audit");
    }
    const rows = await (db as { listFindings: (a: unknown) => Promise<unknown[]> }).listFindings({
      status: "open",
    });
    return { count: Array.isArray(rows) ? rows.length : "not-an-array", sample: Array.isArray(rows) ? rows.slice(0, 1) : null };
  });

  await run("db.listRules", async () => {
    if (typeof (db as Record<string, unknown>).listRules !== "function") {
      throw new Error("listRules is not exported from @/lib/db/audit");
    }
    const rows = await (db as { listRules: () => Promise<unknown[]> }).listRules();
    return { count: Array.isArray(rows) ? rows.length : "not-an-array" };
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Audit trace</h1>
      <p className="text-sm text-ink-500">
        Each step below runs the corresponding call from the audit pages.
        The first failing step is the cause of the redirect.
      </p>
      {steps.map((s) => (
        <details
          key={s.name}
          open={!s.ok}
          className={
            "rounded-xl border p-3 " +
            (s.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5")
          }
        >
          <summary className="cursor-pointer text-sm font-semibold">
            {s.ok ? "[ok] " : "[FAIL] "} {s.name}
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">
            {s.ok
              ? JSON.stringify(s.detail, null, 2)
              : s.error}
          </pre>
        </details>
      ))}
    </div>
  );
}
