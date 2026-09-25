"use client";

import { useToast } from "@/components/ui/toast";
import { FolderOpen, Copy } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import type { TenantReceipt } from "@/lib/db/receipts";

const TAG_LABEL: Record<string, string> = {
  rent: "Rent", utility: "Utility", deposits: "Deposits",
  overdue: "Overdue", "add-ons": "Add-ons",
  "reservation-fee": "Reservation fee", all: "All", others: "Others",
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function ReceiptTable({ rows }: { rows: TenantReceipt[] }) {
  const toast = useToast();
  if (rows.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No receipts yet.
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
              <TH>Date</TH>
              <TH>Tenant</TH>
              <TH>Unit</TH>
              <TH>Property</TH>
              <TH>For month</TH>
              <TH>Reference</TH>
              <TH>Payment for</TH>
              <TH>Files</TH>
              <TH className="text-right">Drive</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs text-ink-500">{shortDate(r.uploaded_at)}</TD>
                <TD className="font-medium text-ink-900">{r.tenant_name ?? "-"}</TD>
                <TD className="text-ink-600">{r.unit_number ?? "-"}</TD>
                <TD className="text-ink-600">{r.property_name ?? "-"}</TD>
                <TD className="text-sm text-ink-700">{r.payment_month ?? "-"}</TD>
                <TD className="text-xs text-ink-500">

                  {r.reference_no ? (

                    <button

                      type="button"

                      onClick={() => {

                        navigator.clipboard.writeText(r.reference_no ?? "");

                        toast.push("Reference copied", "success");

                      }}

                      title="Click to copy"

                      className="group -mx-1 inline-flex items-center gap-1 rounded px-1 font-mono transition-colors hover:bg-brand-500/10 hover:text-brand-700 dark:hover:text-brand-400"

                    >

                      <span className="underline decoration-dotted underline-offset-2">

                        {r.reference_no}

                      </span>

                      <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />

                    </button>

                  ) : (

                    "—"

                  )}

                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {r.payment_for.map((t) => (
                      <span key={t} className="rounded-lg bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-400">
                        {TAG_LABEL[t] ?? t}
                      </span>
                    ))}
                    {r.custom_label && (
                      <span className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        {r.custom_label}
                      </span>
                    )}
                  </div>
                </TD>
                <TD className="text-xs text-ink-500">
                  {Array.isArray(r.drive_file_ids) ? r.drive_file_ids.length : 0} file(s)
                </TD>
                <TD className="text-right">
                  <a
                    href={r.drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open
                  </a>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
