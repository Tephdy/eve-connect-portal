import { Card, CardBody } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  maya: "Maya",
  check: "Check",
  other: "Other",
};

export function PortalPaymentsTab({ profile }: { profile: TenantProfile }) {
  if (profile.payments.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No payments recorded.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <div className="divide-y divide-ink-100 dark:divide-white/[0.04]">
          {profile.payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums text-ink-900">
                  {formatPHP(p.amount)}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {fmtDate(p.paid_at)} | {METHOD_LABEL[p.method] ?? p.method}
                  {p.receipt_number ? " | " + p.receipt_number : ""}
                </p>
              </div>
              {p.invoice_display && (
                <p className="shrink-0 text-xs font-medium text-ink-500">
                  {p.invoice_display}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
