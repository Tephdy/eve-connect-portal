import Link from "next/link";
import { CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ImportSummary } from "@/lib/import/types";

const LABEL: Record<string, string> = {
  properties: "Properties",
  units: "Units",
  tenants: "Tenants",
  leases: "Leases",
};

const BACK: Record<string, string> = {
  properties: "/property/properties",
  units: "/property/units",
  tenants: "/property/tenants",
  leases: "/property/leases",
};

export function ImportSummaryCard({ summary }: { summary: ImportSummary }) {
  return (
    <Card>
      <CardHeader
        title="Import complete"
        description={"Imported into " + (LABEL[summary.target] ?? summary.target)}
      />
      <CardBody className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={CheckCircle2} tone="success" label="Created" value={summary.created} />
          <Stat icon={Info} tone="info" label="Updated" value={summary.updated} />
          <Stat icon={AlertCircle} tone="warning" label="Skipped" value={summary.skipped} />
          <Stat icon={XCircle} tone="danger" label="Failed" value={summary.failed} />
        </div>

        {summary.errors.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-ink-800">
              Errors ({summary.errors.length})
            </p>
            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 dark:divide-white/[0.04] dark:border-white/[0.06] max-h-64 overflow-y-auto">
              {summary.errors.slice(0, 100).map((e, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <Badge tone="red">Row {e.rowIndex + 2}</Badge>
                  <span className="min-w-0 flex-1 text-danger-700 dark:text-danger-500">
                    {e.message}
                  </span>
                </li>
              ))}
            </ul>
            {summary.errors.length > 100 && (
              <p className="mt-2 text-xs text-ink-500">
                + {summary.errors.length - 100} more errors
              </p>
            )}
          </div>
        )}
      </CardBody>
      <CardFooter>
        <Link href={BACK[summary.target] ?? "/property/units"}>
          <Button variant="secondary">Back to list</Button>
        </Link>
        <Link href="/property/import">
          <Button>Import another file</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "info" | "warning" | "danger";
  label: string;
  value: number;
}) {
  const colors = {
    success: "text-success-700 dark:text-success-500 bg-success-500/10",
    info: "text-info-700 dark:text-info-500 bg-info-500/10",
    warning: "text-warning-700 dark:text-warning-500 bg-warning-500/10",
    danger: "text-danger-700 dark:text-danger-500 bg-danger-500/10",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-surface p-3 dark:border-white/[0.06]">
      <div className={"flex h-9 w-9 items-center justify-center rounded-lg " + colors[tone]}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-ink-500">{label}</p>
        <p className="text-lg font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}
