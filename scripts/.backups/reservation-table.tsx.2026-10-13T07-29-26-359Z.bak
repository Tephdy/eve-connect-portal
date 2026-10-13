"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { KeyRound, X, Copy } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/dashboard/status-pill";
import { useToast } from "@/components/ui/toast";
import { releaseReservationAction } from "@/app/(dashboard)/accounting/reservations/actions";
import type { ReservationRow } from "@/lib/db/unit-reservations";

function php(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return "\u20b1" + Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(iso: string | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ReservationTable({
  rows,
  readOnly = false,
}: {
  rows: ReservationRow[];
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const [releasing, setReleasing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const toast = useToast();

  function submitRelease(unit_id: string) {
    start(async () => {
      const r = await releaseReservationAction({ unit_id, reason: reason || null });
      if (!r.ok) {
        toast.push(r.error, "error");
        return;
      }
      toast.push("Reservation released", "success");
      setReleasing(null);
      setReason("");
    });
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No reservations match your filters.
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Unit</TH>
                <TH>Property</TH>
                <TH>Client</TH>
                <TH>Contact</TH>
                <TH className="text-right">Fee</TH>
                <TH>Payment</TH>
                <TH>Reference</TH>
                <TH>Reserved</TH>
                <TH>Verification</TH>
                <TH>Status</TH>
                <TH className="text-right"></TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const active = !r.released_at;
                return (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.unit_number ?? "\u2014"}</TD>
                    <TD className="text-ink-600">{r.property_name ?? "\u2014"}</TD>
                    <TD className="font-medium text-ink-900">{r.client_name}</TD>
                    <TD className="text-xs text-ink-500">
                      {r.client_phone ? <div>{r.client_phone}</div> : null}
                      {r.client_email ? (
                        <div className="text-ink-400">{r.client_email}</div>
                      ) : null}
                      {!r.client_phone && !r.client_email ? "\u2014" : null}
                    </TD>
                    <TD className="text-right tabular-nums">{php(r.reservation_fee)}</TD>
                    <TD className="capitalize text-ink-600">
                      {r.payment_mode ?? "\u2014"}
                    </TD>
                    <TD className="text-xs text-ink-500">
                      {r.reference_number ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(r.reference_number ?? "");
                            toast.push("Reference copied", "success");
                          }}
                          title="Click to copy"
                          className="group -mx-1 inline-flex items-center gap-1 rounded px-1 font-mono transition-colors hover:bg-brand-500/10 hover:text-brand-700 dark:hover:text-brand-400"
                        >
                          <span className="underline decoration-dotted underline-offset-2">
                            {r.reference_number}
                          </span>
                          <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                        </button>
                      ) : (
                        "\u2014"
                      )}
                    </TD>
                    <TD className="text-xs text-ink-500">
                      {shortDate(r.reserved_at)}
                    </TD>
                    <TD>
                      <StatusPill
                        tone={
                          r.verification_status === "verified"
                            ? "green"
                            : r.verification_status === "discrepancy"
                            ? "red"
                            : "yellow"
                        }
                        dot
                      >
                        {r.verification_status}
                      </StatusPill>
                    </TD>
                    <TD>
                      {active ? (
                        <StatusPill tone="yellow" dot>Active</StatusPill>
                      ) : (
                        <StatusPill tone="gray" dot>Released</StatusPill>
                      )}
                    </TD>
                    <TD className="text-right">
                      {active && !readOnly && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setReleasing(r.unit_id)}
                        >
                          Release
                        </Button>
                      )}
                      <Link
                          href={"/accounting/reservations/" + r.id}
                          className="ml-3 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Review
                        </Link>
                      </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      {releasing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReleasing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl dark:bg-surface-raised"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Release reservation</h2>
              <button
                onClick={() => setReleasing(null)}
                className="rounded p-1 text-ink-400 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-ink-600">
              This will mark the reservation as released and set the unit back to
              vacant.
            </p>
            <label className="mb-1 block text-xs font-semibold text-ink-500">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Client cancelled"
              className="mb-4 w-full rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setReleasing(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => submitRelease(releasing)}
                loading={pending}
              >
                Confirm release
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
