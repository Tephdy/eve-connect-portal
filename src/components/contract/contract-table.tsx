import Link from "next/link";
import { FileSignature } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { Contract } from "@/lib/db/contracts";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  draft: "gray",
  sent: "yellow",
  signed: "green",
  void: "red",
};

export function ContractTable({ contracts }: { contracts: Contract[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Contract</TH>
              <TH>Tenant</TH>
              <TH>Template</TH>
              <TH>Status</TH>
              <TH>Created</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {contracts.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link
                    href={"/property/contracts/" + c.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <FileSignature className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      Unit {c.unit_number ?? "—"}
                    </span>
                  </Link>
                </TD>
                <TD className="text-ink-600">{c.tenant_name ?? "—"}</TD>
                <TD className="text-ink-600">{c.template_name ?? "—"}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[c.status] ?? "gray"} dot>
                    {c.status}
                  </StatusPill>
                </TD>
                <TD className="text-xs text-ink-500">
                  {new Date(c.created_at).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/property/contracts/" + c.id}
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
