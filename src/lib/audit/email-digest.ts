import { listFindings } from "@/lib/db/audit";
import type { AuditFinding } from "@/lib/audit/types";

export type DigestPayload = {
  subject: string;
  html: string;
  count: number;
};

export async function buildDailyDigest(): Promise<DigestPayload | null> {
  if (process.env.AUDIT_DIGEST_ENABLED !== "true") return null;

  const findings = await listFindings({ status: "open" });
  const critical = findings.filter((f) => f.severity === "critical");
  const high = findings.filter((f) => f.severity === "high");
  if (critical.length === 0 && high.length === 0) return null;

  const section = (label: string, items: AuditFinding[]) =>
    items.length === 0
      ? ""
      : "<h3>" + label + " (" + items.length + ")</h3><ul>" +
        items.map((f) => "<li><strong>" + escapeHtml(f.title) + "</strong> \u2014 " + escapeHtml(f.rule_name ?? f.rule_key) + "</li>").join("") +
        "</ul>";

  const html =
    "<!doctype html><html><body style=\"font-family:system-ui,sans-serif\">" +
    "<h2>Audit digest \u2014 " + new Date().toLocaleDateString("en-PH") + "</h2>" +
    section("Critical", critical) +
    section("High", high) +
    "<p style=\"color:#666;font-size:12px\">Generated automatically by the audit engine.</p>" +
    "</body></html>";

  return {
    subject: "Audit digest: " + critical.length + " critical, " + high.length + " high",
    html,
    count: critical.length + high.length,
  };
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}
