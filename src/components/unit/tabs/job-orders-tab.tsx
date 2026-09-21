import Link from "next/link";
import { Wrench } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils/format-php";
import type { UnitProfile } from "@/lib/db/unit-profile";

const STATUS_TONE: Record<string, "gray" | "yellow" | "brand" | "green" | "red" | "purple"> = {
  open: "gray",
  pending_approval: "yellow",
  assigned: "brand",
  in_progress: "purple",
  done: "green",
  cancelled: "red",
};

export function UnitJobOrdersTab({ profile }: { profile: UnitProfile }) {
  if (profile.jobOrders.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No job orders for this unit.
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
              <TH>Task</TH>
              <TH>Priority</TH>
              <TH className="text-right">Cost</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.jobOrders.map((j) => (
              <TR key={j.id}>
                <TD>
                  <Link href={"/maintenance/job-orders/" + j.id} className="flex items-center gap-3 group">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {j.task_type_name ?? "Task"}
                      </p>
                      {j.description && (
                        <p className="truncate text-xs text-ink-500 max-w-xs">{j.description}</p>
                      )}
                    </div>
                  </Link>
                </TD>
                <TD className="text-sm capitalize text-ink-600">{j.priority}</TD>
                <TD className="text-right font-medium text-ink-900">
                  {j.cost_estimate != null ? formatPHP(j.cost_estimate) : "—"}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[j.status] ?? "gray"} dot>
                    {j.status.replace("_", " ")}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link href={"/maintenance/job-orders/" + j.id} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
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
