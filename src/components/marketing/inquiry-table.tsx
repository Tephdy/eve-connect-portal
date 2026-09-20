import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { Inquiry } from "@/lib/db/inquiries";

const STATUS_TONE: Record<string, "yellow" | "brand" | "green" | "red"> = {
  open: "yellow",
  contacted: "brand",
  converted: "green",
  lost: "red",
};

export function InquiryTable({ inquiries }: { inquiries: Inquiry[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Prospect</TH>
              <TH>Contact</TH>
              <TH>Interested unit</TH>
              <TH>Source</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {inquiries.map((i) => (
              <TR key={i.id}>
                <TD>
                  <Link
                    href={"/marketing/inquiries/" + i.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {i.prospect_name}
                    </span>
                  </Link>
                </TD>
                <TD className="text-sm text-ink-600">{i.contact ?? "—"}</TD>
                <TD className="text-sm text-ink-600">{i.unit_number ?? "—"}</TD>
                <TD className="text-sm text-ink-600">{i.source ?? "—"}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[i.status] ?? "gray"} dot>
                    {i.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/marketing/inquiries/" + i.id}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Edit
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
