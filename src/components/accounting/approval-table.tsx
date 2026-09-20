"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatPHP } from "@/lib/utils/format-php";
import { approveJobOrderAction, rejectJobOrderAction } from "@/app/(dashboard)/accounting/approvals/actions";
import type { JobOrder } from "@/lib/db/job-orders";

export function ApprovalTable({ jobs }: { jobs: JobOrder[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH><TH>Task</TH><TH>Description</TH>
            <TH className="text-right">Cost</TH>
            <TH className="text-right">Decision</TH>
          </TR>
        </THead>
        <TBody>
          {jobs.map((j) => <ApprovalRow key={j.id} job={j} />)}
        </TBody>
      </Table>
    </div>
  );
}

function ApprovalRow({ job }: { job: JobOrder }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const toast = useToast();

  function onApprove() {
    start(async () => {
      try {
        await approveJobOrderAction(job.id);
        toast.push("Approved", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  function onReject() {
    if (!rejecting) { setRejecting(true); return; }
    if (!reason.trim()) { toast.push("Reason required", "error"); return; }
    start(async () => {
      try {
        await rejectJobOrderAction(job.id, reason.trim());
        toast.push("Rejected", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  return (
    <TR>
      <TD className="font-medium">
        <Link href={"/maintenance/job-orders/" + job.id} className="text-brand-600 hover:underline">
          {job.unit_number ?? "—"}
        </Link>
      </TD>
      <TD className="text-gray-600">{job.task_type_name ?? "—"}</TD>
      <TD className="text-gray-600 text-xs max-w-xs truncate">{job.description ?? ""}</TD>
      <TD className="text-right font-medium">
        {job.cost_estimate != null ? formatPHP(job.cost_estimate) : "—"}
      </TD>
      <TD className="text-right">
        <div className="flex items-center justify-end gap-2">
          {rejecting && (
            <input
              type="text"
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs w-40"
            />
          )}
          <Button size="sm" onClick={onApprove} loading={pending && !rejecting}>Approve</Button>
          <Button size="sm" variant={rejecting ? "danger" : "secondary"} onClick={onReject} loading={pending && rejecting}>
            {rejecting ? "Confirm reject" : "Reject"}
          </Button>
        </div>
      </TD>
    </TR>
  );
}
