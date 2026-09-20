"use client";

import { useState, useTransition } from "react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatPHP } from "@/lib/utils/format-php";
import { refundDepositAction } from "@/app/(dashboard)/accounting/actions";
import type { Deposit } from "@/lib/db/deposits";

const STATUS_TONE: Record<string, "yellow" | "blue" | "green" | "red"> = {
  held: "yellow", partial: "blue", returned: "green", forfeited: "red",
};

export function DepositTable({ deposits }: { deposits: Deposit[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Tenant</TH><TH>Unit</TH>
            <TH className="text-right">Held</TH>
            <TH className="text-right">Refunded</TH>
            <TH>Status</TH>
            <TH className="text-right">Action</TH>
          </TR>
        </THead>
        <TBody>
          {deposits.map((d) => <DepositRow key={d.id} deposit={d} />)}
        </TBody>
      </Table>
    </div>
  );
}

function DepositRow({ deposit }: { deposit: Deposit }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(deposit.amount));
  const [forfeit, setForfeit] = useState(false);
  const toast = useToast();

  const canAct = deposit.status === "held" || deposit.status === "partial";

  function submit() {
    start(async () => {
      try {
        await refundDepositAction(deposit.id, Number(amount), forfeit);
        toast.push("Deposit settled", "success");
        setOpen(false);
      } catch { toast.push("Failed", "error"); }
    });
  }

  return (
    <>
      <TR>
        <TD className="font-medium">{deposit.tenant_name ?? "—"}</TD>
        <TD className="text-gray-600">{deposit.unit_number ?? "—"}</TD>
        <TD className="text-right">{formatPHP(deposit.amount)}</TD>
        <TD className="text-right">{formatPHP(deposit.refunded_amount)}</TD>
        <TD><Badge tone={STATUS_TONE[deposit.status] ?? "gray"}>{deposit.status}</Badge></TD>
        <TD className="text-right">
          {canAct && (
            <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
              {open ? "Cancel" : "Settle"}
            </Button>
          )}
        </TD>
      </TR>
      {open && (
        <TR>
          <TD colSpan={6}>
            <div className="bg-gray-50 rounded p-3 space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={forfeit} onChange={(e) => setForfeit(e.target.checked)} />
                  Forfeit (no refund)
                </label>
                {!forfeit && (
                  <input
                    type="number" step="0.01" min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
                  />
                )}
                <Button size="sm" onClick={submit} loading={pending}>Confirm</Button>
              </div>
            </div>
          </TD>
        </TR>
      )}
    </>
  );
}
