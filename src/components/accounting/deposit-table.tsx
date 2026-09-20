"use client";

import { useState, useTransition } from "react";
import { Wallet } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatPHP } from "@/lib/utils/format-php";
import { refundDepositAction } from "@/app/(dashboard)/accounting/actions";
import type { Deposit } from "@/lib/db/deposits";

const STATUS_TONE: Record<string, "yellow" | "brand" | "green" | "red"> = {
  held: "yellow",
  partial: "brand",
  returned: "green",
  forfeited: "red",
};

export function DepositTable({ deposits }: { deposits: Deposit[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Tenant</TH>
              <TH>Unit</TH>
              <TH className="text-right">Held</TH>
              <TH className="text-right">Refunded</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {deposits.map((d) => (
              <DepositRow key={d.id} deposit={d} />
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
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
      } catch {
        toast.push("Failed", "error");
      }
    });
  }

  return (
    <>
      <TR>
        <TD>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-500/10 text-warning-700 dark:text-warning-500">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="font-medium text-ink-900">{deposit.tenant_name ?? "—"}</span>
          </div>
        </TD>
        <TD className="text-ink-600">{deposit.unit_number ?? "—"}</TD>
        <TD className="text-right font-medium text-ink-900">
          {formatPHP(deposit.amount)}
        </TD>
        <TD className="text-right text-ink-600">
          {formatPHP(deposit.refunded_amount)}
        </TD>
        <TD>
          <StatusPill tone={STATUS_TONE[deposit.status] ?? "gray"} dot>
            {deposit.status}
          </StatusPill>
        </TD>
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
            <div className="rounded-lg border border-ink-200 bg-surface-muted p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={forfeit}
                    onChange={(e) => setForfeit(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
                  />
                  Forfeit (no refund)
                </label>
                {!forfeit && (
                  <div className="w-48">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      label="Refund amount"
                    />
                  </div>
                )}
                <Button size="sm" onClick={submit} loading={pending}>
                  Confirm
                </Button>
              </div>
            </div>
          </TD>
        </TR>
      )}
    </>
  );
}
