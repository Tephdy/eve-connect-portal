"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/dashboard/status-pill";
import { useToast } from "@/components/ui/toast";
import { formatPHP } from "@/lib/utils/format-php";
import { approveJobOrderAction, rejectJobOrderAction } from "@/app/(dashboard)/accounting/approvals/actions";
import type { JobOrder } from "@/lib/db/job-orders";

export function ApprovalTable({ jobs }: { jobs: JobOrder[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Unit</TH>
              <TH>Task</TH>
              <TH>Description</TH>
              <TH className="text-right">Cost</TH>
              <TH className="text-right">Decision</TH>
            </TR>
          </THead>
          <TBody>
            {jobs.map((j) => (
              <ApprovalRow key={j.id} job={j} />
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
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
      } catch {
        toast.push("Failed", "error");
      }
    });
  }

  function onReject() {
    if (!rejecting) {
      setRejecting(true);
      return;
    }
    if (!reason.trim()) {
      toast.push("Reason required", "error");
      return;
    }
    start(async () => {
      try {
        await rejectJobOrderAction(job.id, reason.trim());
        toast.push("Rejected", "success");
      } catch {
        toast.push("Failed", "error");
      }
    });
  }

  return (
    <TR>
      <TD>
        <Link
          href={"/maintenance/job-orders/" + job.id}
          className="flex items-center gap-3 group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Wrench className="h-4 w-4" />
          </div>
          <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
            {job.unit_number ?? "—"}
          </span>
        </Link>
      </TD>
      <TD className="text-ink-600">{job.task_type_name ?? "—"}</TD>
      <TD>
        <span className="line-clamp-1 max-w-xs text-sm text-ink-600">
          {job.description ?? ""}
        </span>
      </TD>
      <TD className="text-right font-medium text-ink-900">
        {job.cost_estimate != null ? formatPHP(job.cost_estimate) : "—"}
      </TD>
      <TD className="text-right">
        <div className="flex items-center justify-end gap-2">
          {rejecting && (
            <div className="w-44">
              <Input
                placeholder="Rejection reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          <Button size="sm" onClick={onApprove} loading={pending && !rejecting}>
            Approve
          </Button>
          <Button
            size="sm"
            variant={rejecting ? "danger" : "secondary"}
            onClick={onReject}
            loading={pending && rejecting}
          >
            {rejecting ? "Confirm reject" : "Reject"}
          </Button>
        </div>
      </TD>
    </TR>
  );
}
