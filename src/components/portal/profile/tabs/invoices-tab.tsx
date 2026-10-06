import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  unpaid: "yellow",
  paid: "green",
  overdue: "red",
  void: "gray",
};

const TYPE_LABEL: Record<string, string> = {
  rent: "Rent",
  deposit: "Deposit",
  penalty: "Penalty",
  "add-ons": "Add-ons",
  electricity: "Electricity",
  water: "Water",
  utility: "Utility",
  reservation_fee: "Reservation",
  other: "Other",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PortalInvoicesTab({ profile }: { profile: TenantProfile }) {
  if (profile.invoices.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No invoices on file.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <div className="divide-y divide-ink-100 dark:divide-white/[0.04]">
          {profile.invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">
                  {inv.display_number ?? inv.id.slice(0, 8)}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Due {fmtDate(inv.due_date)} | {TYPE_LABEL[inv.type] ?? inv.type}
                  {inv.unit_number ? " | Unit " + inv.unit_number : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-ink-900">
                  {formatPHP(inv.amount)}
                </p>
                <StatusPill tone={STATUS_TONE[inv.status] ?? "gray"} dot>
                  {inv.status}
                </StatusPill>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
