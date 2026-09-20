import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { JobOrder } from "@/lib/db/job-orders";

const STATUS_TONE: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  open: "gray",
  pending_approval: "yellow",
  assigned: "blue",
  in_progress: "blue",
  done: "green",
  cancelled: "red",
};

export function JobOrderTable({ jobs }: { jobs: JobOrder[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH><TH>Task</TH><TH>Priority</TH>
            <TH className="text-right">Cost</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {jobs.map((j) => (
            <TR key={j.id}>
              <TD className="font-medium">
                <Link href={"/maintenance/job-orders/" + j.id} className="text-brand-600 hover:underline">
                  {j.unit_number ?? "—"}
                </Link>
              </TD>
              <TD className="text-gray-600">{j.task_type_name ?? "—"}</TD>
              <TD className="capitalize text-gray-600">{j.priority}</TD>
              <TD className="text-right">{j.cost_estimate != null ? formatPHP(j.cost_estimate) : "—"}</TD>
              <TD><Badge tone={STATUS_TONE[j.status] ?? "gray"}>{j.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/maintenance/job-orders/" + j.id} className="text-brand-600 hover:underline text-sm">
                  View
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
