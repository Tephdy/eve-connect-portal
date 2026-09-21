import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ImportPreviewRow } from "@/lib/import/types";

export function ValidationSummary({ rows }: { rows: ImportPreviewRow[] }) {
  const valid = rows.filter((r) => r.errors.length === 0 && !r.willSkip);
  const skipped = rows.filter((r) => r.willSkip);
  const invalid = rows.filter((r) => r.errors.length > 0);
  const withWarnings = rows.filter((r) => r.warnings.length > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          icon={CheckCircle2}
          tone="success"
          label="Ready to import"
          value={valid.length}
        />
        <Stat
          icon={Info}
          tone="info"
          label="Duplicates (skip)"
          value={skipped.length}
        />
        <Stat
          icon={AlertCircle}
          tone="danger"
          label="Errors"
          value={invalid.length}
        />
        <Stat
          icon={AlertTriangle}
          tone="warning"
          label="With warnings"
          value={withWarnings.length}
        />
      </div>

      {invalid.length > 0 && (
        <Card>
          <CardBody className="p-0">
            <div className="border-b border-ink-200 px-5 py-3 dark:border-white/[0.06]">
              <p className="text-sm font-medium text-danger-700 dark:text-danger-500">
                {invalid.length} row{invalid.length === 1 ? "" : "s"} have errors and will be skipped
              </p>
            </div>
            <ul className="divide-y divide-ink-100 dark:divide-white/[0.04] max-h-64 overflow-y-auto">
              {invalid.slice(0, 50).map((r) => (
                <li key={r.index} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                  <Badge tone="red">Row {r.index + 2}</Badge>
                  <div className="min-w-0 flex-1">
                    {r.errors.map((e, i) => (
                      <p key={i} className="text-danger-700 dark:text-danger-500">
                        {e.message}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {invalid.length > 50 && (
              <div className="border-t border-ink-200 px-5 py-2 text-center text-xs text-ink-500 dark:border-white/[0.06]">
                + {invalid.length - 50} more
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "info" | "danger" | "warning";
  label: string;
  value: number;
}) {
  const colors = {
    success: "text-success-700 dark:text-success-500",
    info: "text-info-700 dark:text-info-500",
    danger: "text-danger-700 dark:text-danger-500",
    warning: "text-warning-700 dark:text-warning-500",
  };
  const bg = {
    success: "bg-success-500/10",
    info: "bg-info-500/10",
    danger: "bg-danger-500/10",
    warning: "bg-warning-500/10",
  };
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <div className={"flex h-9 w-9 items-center justify-center rounded-lg " + bg[tone] + " " + colors[tone]}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-ink-500">{label}</p>
          <p className="text-lg font-semibold text-ink-900">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
