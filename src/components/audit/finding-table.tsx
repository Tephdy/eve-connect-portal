import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { SeverityBadge } from "./severity-badge";
import { StatusBadge } from "./status-badge";
import type { AuditFinding } from "@/lib/audit/types";

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function FindingTable({ findings }: { findings: AuditFinding[] }) {
  if (findings.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No findings match your filters.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH className="w-24">Severity</TH>
              <TH>Finding</TH>
              <TH>Rule</TH>
              <TH className="w-32">Status</TH>
              <TH className="w-32">Detected</TH>
              <TH className="w-20 text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {findings.map((f) => (
              <TR key={f.id}>
                <TD><SeverityBadge severity={f.severity} /></TD>
                <TD>
                  <Link href={"/accounting/audit/findings/" + f.id} className="group block">
                    <p className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">{f.title}</p>
                    {f.summary && (
                      <p className="mt-0.5 max-w-2xl truncate text-xs text-ink-500">{f.summary}</p>
                    )}
                  </Link>
                </TD>
                <TD className="text-xs text-ink-500">{f.rule_name ?? f.rule_key}</TD>
                <TD><StatusBadge status={f.status} /></TD>
                <TD className="text-xs text-ink-500">{timeAgo(f.detected_at)}</TD>
                <TD className="text-right">
                  <Link href={"/accounting/audit/findings/" + f.id} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                    View
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
