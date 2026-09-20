import Link from "next/link";
import { Wrench } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { JobOrder } from "@/lib/db/job-orders";

const STATUS_TONE: Record<string, "gray" | "yellow" | "brand" | "green" | "red" | "purple"> = {
  open: "gray",
  pending_approval: "yellow",
  assigned: "brand",
  in_progress: "purple",
  done: "green",
  cancelled: "red",
};

const PRIORITY_TONE: Record<string, "gray" | "brand" | "yellow" | "red"> = {
  low: "gray",
  normal: "brand",
  high: "yellow",
  urgent: "red",
};

export function JobOrderTable({ jobs }: { jobs: JobOrder[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Job order</TH>
              <TH>Task</TH>
              <TH>Priority</TH>
              <TH className="text-right">Cost</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {jobs.map((j) => (
              <TR key={j.id}>
                <TD>
                  <Link
                    href={"/maintenance/job-orders/" + j.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {j.unit_number ?? "—"}
                      </p>
                      {j.property_name && (
                        <p className="truncate text-xs text-ink-500">
                          {j.property_name}
                        </p>
                      )}
                    </div>
                  </Link>
                </TD>
                <TD className="text-ink-600">{j.task_type_name ?? "—"}</TD>
                <TD>
                  <StatusPill tone={PRIORITY_TONE[j.priority] ?? "gray"}>
                    {j.priority}
                  </StatusPill>
                </TD>
                <TD className="text-right font-medium text-ink-900">
                  {j.cost_estimate != null ? formatPHP(j.cost_estimate) : "—"}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[j.status] ?? "gray"} dot>
                    {j.status.replace("_", " ")}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/maintenance/job-orders/" + j.id}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
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
