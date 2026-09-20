import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils/format-php";
import type { Lease } from "@/lib/db/leases";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red" | "blue"> = {
  draft: "gray", active: "green", expiring: "yellow", ended: "blue", terminated: "red",
};

const INTENT_TONE: Record<string, "blue" | "purple" | "gray"> = {
  new: "blue", renew: "purple", extend: "gray",
};

function depositTotal(l: Lease): number {
  return (Number(l.deposit_1 ?? 0)) + (Number(l.deposit_2 ?? 0));
}

export function LeaseTable({ leases }: { leases: Lease[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH>
            <TH>Tenant</TH>
            <TH>Intent</TH>
            <TH>Term</TH>
            <TH>Move-in</TH>
            <TH className="text-right">Rent</TH>
            <TH className="text-right">Deposits</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {leases.map((l) => (
            <TR key={l.id}>
              <TD className="font-medium">
                <Link href={"/property/leases/" + l.id} className="text-brand-600 hover:underline">
                  {l.unit_number ?? "—"}
                </Link>
              </TD>
              <TD className="text-gray-600">{l.tenant_name ?? "—"}</TD>
              <TD>
                {l.intent ? (
                  <Badge tone={INTENT_TONE[l.intent] ?? "gray"}>{l.intent}</Badge>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </TD>
              <TD className="text-gray-600 text-xs">
                {l.start_date} → {l.end_date}
              </TD>
              <TD className="text-gray-600 text-xs">{l.move_in_date ?? "—"}</TD>
              <TD className="text-right">{formatPHP(l.monthly_rent)}</TD>
              <TD className="text-right text-xs text-gray-600">
                {depositTotal(l) > 0 ? formatPHP(depositTotal(l)) : "—"}
              </TD>
              <TD>
                <Badge tone={STATUS_TONE[l.status] ?? "gray"}>{l.status}</Badge>
              </TD>
              <TD className="text-right">
                <Link href={"/property/leases/" + l.id} className="text-brand-600 hover:underline text-sm">
                  Edit
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}